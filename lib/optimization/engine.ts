import { etaMinutes, haversineKm } from "@/lib/domain/geo";
import { assignmentCost, compatibility, priorityScore } from "@/lib/domain/scoring";
import { solveAssignment } from "./hungarian";
import type { ComparisonMetrics, DecisionDrivers, ResourceType } from "@/types/domain";

export interface OptIncident {
  id: string;
  code: string;
  type: string;
  severity: number;
  casualties: number;
  waitingMinutes: number;
  latitude: number;
  longitude: number;
  hospitalRequired: boolean;
  requiredResourceType: ResourceType;
  currentResourceId: string | null;
}

export interface OptResource {
  id: string;
  code: string;
  type: ResourceType;
  latitude: number;
  longitude: number;
  /** True if this resource is currently committed to an incident (any incident). */
  currentLoad: number;
  /** The incident id this resource is currently committed to, if any. */
  currentIncidentId: string | null;
}

export interface OptHospital {
  latitude: number;
  longitude: number;
  capacity: number;
  currentLoad: number;
}

export interface PairEvaluation {
  incidentId: string;
  resourceId: string;
  distanceKm: number;
  etaMinutes: number;
  compatibilityScore: number;
  hospitalAvailable: boolean;
  cost: number;
}

export interface OptimizationInput {
  incidents: OptIncident[];
  resources: OptResource[];
  hospitals: OptHospital[];
  congestionMultiplier?: number;
}

export interface Proposal {
  incidentId: string;
  incidentCode: string;
  resourceId: string;
  resourceCode: string;
  previousResourceId: string | null;
  etaMinutes: number;
  distanceKm: number;
  drivers: DecisionDrivers;
  cost: number;
}

export interface OptimizationOutcome {
  baselineAssignments: Map<string, string>;
  optimizedAssignments: Map<string, string>;
  baselineMetrics: ComparisonMetrics;
  optimizedMetrics: ComparisonMetrics;
  improvementPct: number;
  proposals: Proposal[];
  pairEvaluations: PairEvaluation[];
}

function nearestHospitalAvailable(point: { latitude: number; longitude: number }, hospitals: OptHospital[]): boolean {
  if (hospitals.length === 0) return false;
  const sorted = [...hospitals].sort(
    (a, b) => haversineKm(point, a) - haversineKm(point, b),
  );
  const nearest = sorted[0];
  return nearest.currentLoad < nearest.capacity;
}

function evaluatePair(
  incident: OptIncident,
  resource: OptResource,
  hospitals: OptHospital[],
  congestionMultiplier: number,
): PairEvaluation {
  const distanceKm = haversineKm(incident, resource);
  const eta = etaMinutes(distanceKm, congestionMultiplier);
  const compat = compatibility(incident.type, resource.type);
  const hospitalAvailable = incident.hospitalRequired
    ? nearestHospitalAvailable(incident, hospitals)
    : true;
  // A resource already committed to THIS incident isn't "extra" load for this
  // pairing — only count load when the resource is busy with a different one.
  const effectiveLoad = resource.currentIncidentId && resource.currentIncidentId !== incident.id ? resource.currentLoad : 0;
  const cost = assignmentCost({
    severity: incident.severity,
    casualties: incident.casualties,
    waitingMinutes: incident.waitingMinutes,
    etaMinutes: eta,
    compatibilityScore: compat,
    hospitalRequired: incident.hospitalRequired,
    hospitalAvailable,
    resourceCurrentLoad: effectiveLoad,
  });
  return {
    incidentId: incident.id,
    resourceId: resource.id,
    distanceKm: Math.round(distanceKm * 100) / 100,
    etaMinutes: eta,
    compatibilityScore: compat,
    hospitalAvailable,
    cost,
  };
}

/** Naive baseline: process incidents by priority, greedily grab nearest still-free compatible resource. */
function baselineAllocate(
  incidents: OptIncident[],
  resources: OptResource[],
  evalMap: Map<string, PairEvaluation>,
): Map<string, string> {
  const sortedIncidents = [...incidents].sort(
    (a, b) =>
      priorityScore({ severity: b.severity, casualties: b.casualties, waitingMinutes: b.waitingMinutes }) -
      priorityScore({ severity: a.severity, casualties: a.casualties, waitingMinutes: a.waitingMinutes }),
  );
  const free = new Set(resources.map((r) => r.id));
  const result = new Map<string, string>();

  for (const incident of sortedIncidents) {
    let best: PairEvaluation | null = null;
    for (const resourceId of free) {
      const evalKey = `${incident.id}::${resourceId}`;
      const pair = evalMap.get(evalKey);
      if (!pair || pair.compatibilityScore <= 0) continue;
      if (!best || pair.distanceKm < best.distanceKm) best = pair;
    }
    if (best) {
      result.set(incident.id, best.resourceId);
      free.delete(best.resourceId);
    }
  }
  return result;
}

/** Globally optimal allocation via minimum-cost bipartite matching. */
function optimizedAllocate(
  incidents: OptIncident[],
  resources: OptResource[],
  evalMap: Map<string, PairEvaluation>,
): Map<string, string> {
  if (incidents.length === 0 || resources.length === 0) return new Map();

  const matrix = incidents.map((incident) =>
    resources.map((resource) => {
      const pair = evalMap.get(`${incident.id}::${resource.id}`)!;
      return pair.cost;
    }),
  );

  const rowToCol = solveAssignment(matrix);
  const result = new Map<string, string>();
  rowToCol.forEach((colIdx, rowIdx) => {
    if (colIdx < 0 || colIdx >= resources.length) return;
    const pair = evalMap.get(`${incidents[rowIdx].id}::${resources[colIdx].id}`)!;
    if (pair.compatibilityScore <= 0) return;
    result.set(incidents[rowIdx].id, resources[colIdx].id);
  });
  return result;
}

export function computeMetrics(
  incidents: OptIncident[],
  resources: OptResource[],
  allocation: Map<string, string>,
  evalMap: Map<string, PairEvaluation>,
): ComparisonMetrics {
  if (incidents.length === 0) {
    return {
      avgResponseMinutes: 0,
      weightedResponseMinutes: 0,
      worstResponseMinutes: 0,
      criticalAtRiskCount: 0,
      coveragePct: 100,
      unservedIncidents: 0,
      resourceUtilizationPct: 0,
    };
  }

  const UNSERVED_PENALTY_MINUTES = 45;
  let totalEta = 0;
  let totalWeighted = 0;
  let totalWeight = 0;
  let worst = 0;
  let criticalAtRisk = 0;
  let unserved = 0;

  for (const incident of incidents) {
    const resourceId = allocation.get(incident.id);
    const pair = resourceId ? evalMap.get(`${incident.id}::${resourceId}`) : undefined;
    const eta = pair ? pair.etaMinutes : UNSERVED_PENALTY_MINUTES;
    if (!pair) unserved += 1;

    const weight = priorityScore({
      severity: incident.severity,
      casualties: incident.casualties,
      waitingMinutes: incident.waitingMinutes,
    });

    totalEta += eta;
    totalWeighted += eta * weight;
    totalWeight += weight;
    worst = Math.max(worst, eta);

    if (incident.severity >= 4 && eta > 10) criticalAtRisk += 1;
  }

  const utilizedResources = new Set(allocation.values()).size;

  return {
    avgResponseMinutes: round1(totalEta / incidents.length),
    weightedResponseMinutes: round1(totalWeight > 0 ? totalWeighted / totalWeight : 0),
    worstResponseMinutes: round1(worst),
    criticalAtRiskCount: criticalAtRisk,
    coveragePct: round1(((incidents.length - unserved) / incidents.length) * 100),
    unservedIncidents: unserved,
    resourceUtilizationPct: round1(resources.length > 0 ? (utilizedResources / resources.length) * 100 : 0),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function runOptimization(input: OptimizationInput): OptimizationOutcome {
  const { incidents, resources, hospitals, congestionMultiplier = 1 } = input;

  const evalMap = new Map<string, PairEvaluation>();
  const pairEvaluations: PairEvaluation[] = [];
  for (const incident of incidents) {
    for (const resource of resources) {
      const pair = evaluatePair(incident, resource, hospitals, congestionMultiplier);
      evalMap.set(`${incident.id}::${resource.id}`, pair);
      pairEvaluations.push(pair);
    }
  }

  const baselineAssignments = baselineAllocate(incidents, resources, evalMap);
  const optimizedAssignments = optimizedAllocate(incidents, resources, evalMap);

  const baselineMetrics = computeMetrics(incidents, resources, baselineAssignments, evalMap);
  const optimizedMetrics = computeMetrics(incidents, resources, optimizedAssignments, evalMap);

  const improvementPct =
    baselineMetrics.weightedResponseMinutes > 0
      ? round1(
          ((baselineMetrics.weightedResponseMinutes - optimizedMetrics.weightedResponseMinutes) /
            baselineMetrics.weightedResponseMinutes) *
            100,
        )
      : 0;

  const proposals: Proposal[] = [];
  for (const incident of incidents) {
    const resourceId = optimizedAssignments.get(incident.id);
    if (!resourceId) continue;
    const resource = resources.find((r) => r.id === resourceId)!;
    const pair = evalMap.get(`${incident.id}::${resourceId}`)!;
    const previousResourceId = incident.currentResourceId;
    if (previousResourceId === resourceId) continue;

    proposals.push({
      incidentId: incident.id,
      incidentCode: incident.code,
      resourceId,
      resourceCode: resource.code,
      previousResourceId,
      etaMinutes: pair.etaMinutes,
      distanceKm: pair.distanceKm,
      drivers: {
        severity: incident.severity,
        casualties: incident.casualties,
        waitMinutes: round1(incident.waitingMinutes),
        distanceKm: pair.distanceKm,
        compatibilityPct: Math.round(pair.compatibilityScore * 100),
        hospitalAvailable: pair.hospitalAvailable,
      },
      cost: pair.cost,
    });
  }

  return {
    baselineAssignments,
    optimizedAssignments,
    baselineMetrics,
    optimizedMetrics,
    improvementPct,
    proposals,
    pairEvaluations,
  };
}
