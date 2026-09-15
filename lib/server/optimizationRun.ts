import { prisma } from "@/lib/db/client";
import { computeMetrics, runOptimization, type OptHospital, type OptIncident, type OptResource } from "@/lib/optimization/engine";
import { dispatchResource, logEvent } from "./dispatch";
import { liveWaitingMinutes } from "./dto";
import type { OptimizationResultDTO } from "@/types/domain";

export async function buildOptimizationInputs() {
  const [incidents, resources, hospitals, systemState] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { not: "RESOLVED" } },
      include: { assignments: { where: { status: "ACTIVE" } } },
    }),
    prisma.resource.findMany({ where: { status: { not: "OFFLINE" } } }),
    prisma.hospital.findMany(),
    prisma.systemState.findUnique({ where: { id: "singleton" } }),
  ]);

  const optIncidents: OptIncident[] = incidents.map((incident) => ({
    id: incident.id,
    code: incident.code,
    type: incident.type,
    severity: incident.severity,
    casualties: incident.casualties,
    waitingMinutes: liveWaitingMinutes(incident),
    latitude: incident.latitude,
    longitude: incident.longitude,
    hospitalRequired: incident.hospitalRequired,
    requiredResourceType: incident.requiredResourceType,
    currentResourceId: incident.assignments[0]?.resourceId ?? null,
  }));

  const currentIncidentByResource = new Map(
    incidents.flatMap((incident) => incident.assignments.map((a) => [a.resourceId, incident.id] as const)),
  );

  const optResources: OptResource[] = resources.map((resource) => ({
    id: resource.id,
    code: resource.code,
    type: resource.type,
    latitude: resource.latitude,
    longitude: resource.longitude,
    currentLoad: resource.currentAssignmentId ? 1 : 0,
    currentIncidentId: currentIncidentByResource.get(resource.id) ?? null,
  }));

  const optHospitals: OptHospital[] = hospitals.map((h) => ({
    latitude: h.latitude,
    longitude: h.longitude,
    capacity: h.capacity,
    currentLoad: h.currentLoad,
  }));

  return {
    optIncidents,
    optResources,
    optHospitals,
    congestionMultiplier: systemState?.trafficMultiplier ?? 1,
  };
}

export async function computeOptimizationPreview(): Promise<OptimizationResultDTO & { raw: Awaited<ReturnType<typeof runOptimization>> }> {
  const { optIncidents, optResources, optHospitals, congestionMultiplier } = await buildOptimizationInputs();

  const outcome = runOptimization({
    incidents: optIncidents,
    resources: optResources,
    hospitals: optHospitals,
    congestionMultiplier,
  });

  const evalMap = new Map(outcome.pairEvaluations.map((p) => [`${p.incidentId}::${p.resourceId}`, p]));
  const currentAllocation = new Map(
    optIncidents.filter((i) => i.currentResourceId).map((i) => [i.id, i.currentResourceId as string]),
  );
  const currentMetrics = computeMetrics(optIncidents, optResources, currentAllocation, evalMap);

  const improvementPct =
    currentMetrics.weightedResponseMinutes > 0
      ? Math.round(
          ((currentMetrics.weightedResponseMinutes - outcome.optimizedMetrics.weightedResponseMinutes) /
            currentMetrics.weightedResponseMinutes) *
            1000,
        ) / 10
      : 0;

  return {
    id: "preview",
    createdAt: new Date().toISOString(),
    baseline: currentMetrics,
    optimized: outcome.optimizedMetrics,
    improvementPct,
    proposals: outcome.proposals.map((p) => ({
      incidentId: p.incidentId,
      incidentCode: p.incidentCode,
      resourceId: p.resourceId,
      resourceCode: p.resourceCode,
      previousResourceCode: optResources.find((r) => r.id === p.previousResourceId)?.code ?? null,
      etaMinutes: p.etaMinutes,
      distanceKm: p.distanceKm,
      drivers: p.drivers,
      expectedImpactMinutes:
        Math.round((currentMetrics.weightedResponseMinutes - outcome.optimizedMetrics.weightedResponseMinutes) * 10) / 10,
    })),
    raw: outcome,
  };
}

export interface ApplyOptimizationResult {
  applied: number;
  optimizationRunId: string | null;
  improvementPct: number;
  baseline?: OptimizationResultDTO["baseline"];
  optimized?: OptimizationResultDTO["optimized"];
}

/** Persists an optimization run and actually dispatches every proposed reassignment. */
export async function applyOptimizationPlan(triggeredBy: "OPERATOR" | "AUTO" = "OPERATOR"): Promise<ApplyOptimizationResult> {
  const preview = await computeOptimizationPreview();

  if (preview.proposals.length === 0) {
    return { applied: 0, optimizationRunId: null, improvementPct: 0 };
  }

  const run = await prisma.optimizationRun.create({
    data: {
      objective: "weighted_response_time",
      baselineScore: preview.baseline.weightedResponseMinutes,
      optimizedScore: preview.optimized.weightedResponseMinutes,
      improvementPct: preview.improvementPct,
      baselineJson: JSON.stringify(preview.baseline),
      allocationJson: JSON.stringify(preview.proposals),
    },
  });

  await logEvent({
    type: triggeredBy === "AUTO" ? "AUTO_DISPATCH" : "OPTIMIZATION_TRIGGERED",
    message:
      triggeredBy === "AUTO"
        ? `AUTO DISPATCH — Fay applied ${preview.proposals.length} reassignment(s) automatically, ${preview.improvementPct}% improvement`
        : `Fay optimization applied — ${preview.proposals.length} reassignment(s), ${preview.improvementPct}% improvement`,
    payload: { optimizationRunId: run.id, improvementPct: preview.improvementPct, triggeredBy },
  });

  let applied = 0;
  for (const proposal of preview.proposals) {
    try {
      await dispatchResource({
        incidentId: proposal.incidentId,
        resourceId: proposal.resourceId,
        recommendedResourceId: proposal.resourceId,
        optimizationRunId: run.id,
      });
      applied++;
    } catch (err) {
      console.error(`Failed to apply proposal for ${proposal.incidentCode}`, err);
    }
  }

  return {
    applied,
    optimizationRunId: run.id,
    improvementPct: preview.improvementPct,
    baseline: preview.baseline,
    optimized: preview.optimized,
  };
}
