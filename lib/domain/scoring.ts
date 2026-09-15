import type { ResourceType } from "@/types/domain";

/**
 * Resource compatibility matrix. 1 = fully compatible, 0.5 = partial
 * (usable in a pinch, e.g. police as first-on-scene for a medical call),
 * 0 = incompatible. Kept explicit and data-driven rather than inferred so
 * it's auditable during a decision review.
 */
const COMPATIBILITY: Record<string, number> = {
  "MEDICAL:AMBULANCE": 1,
  "MEDICAL:RESCUE": 0.6,
  "MEDICAL:POLICE": 0.3,
  "FIRE:FIRE_ENGINE": 1,
  "FIRE:RESCUE": 0.5,
  "TRAFFIC_COLLISION:AMBULANCE": 1,
  "TRAFFIC_COLLISION:POLICE": 0.8,
  "TRAFFIC_COLLISION:FIRE_ENGINE": 0.6,
  "TRAFFIC_COLLISION:RESCUE": 0.7,
  "STRUCTURAL:RESCUE": 1,
  "STRUCTURAL:FIRE_ENGINE": 0.8,
  "HAZMAT:HAZMAT": 1,
  "HAZMAT:FIRE_ENGINE": 0.4,
  "PUBLIC_SAFETY:POLICE": 1,
  "MASS_CASUALTY:AMBULANCE": 1,
  "MASS_CASUALTY:RESCUE": 0.7,
  "MASS_CASUALTY:FIRE_ENGINE": 0.5,
};

export function compatibility(incidentType: string, resourceType: ResourceType): number {
  return COMPATIBILITY[`${incidentType}:${resourceType}`] ?? 0;
}

export interface PriorityInput {
  severity: number;
  casualties: number;
  waitingMinutes: number;
}

/**
 * Weighted urgency score used to sort the incident queue and to weight
 * response-time metrics. Severity dominates (it encodes deadline pressure),
 * casualties scale sub-linearly (sqrt) so a 20-casualty MCI doesn't fully
 * drown out other critical incidents, and wait time grows the score the
 * longer an incident goes unserved.
 */
export function priorityScore({ severity, casualties, waitingMinutes }: PriorityInput): number {
  const severityWeight = severity ** 2 * 10;
  const casualtyWeight = Math.sqrt(Math.max(casualties, 0)) * 8;
  const waitWeight = Math.min(waitingMinutes, 60) * 0.6;
  return round(severityWeight + casualtyWeight + waitWeight);
}

export interface AssignmentCostInput {
  severity: number;
  casualties: number;
  waitingMinutes: number;
  etaMinutes: number;
  compatibilityScore: number;
  hospitalRequired: boolean;
  hospitalAvailable: boolean;
  resourceCurrentLoad: number;
}

/**
 * Cost for a single (incident, resource) pairing — lower is better. This is
 * the objective the assignment solver minimizes.
 *
 * `urgencyDiscount` is constant across every resource considered for a given
 * incident — it doesn't distinguish resources from each other. Its job is to
 * make assigning *any* resource to a high-urgency incident cheaper than
 * assigning to a low-urgency one, so the global solver "steals" a resource
 * toward the more urgent incident when resources are scarce. Because it's
 * incident-constant, per-resource ranking (which resource is best for THIS
 * incident) is driven entirely by the other terms — travel time,
 * compatibility, hospital fit, current load — regardless of how large the
 * discount gets. Costs are intentionally allowed to go negative (the
 * Hungarian solver only needs relative ordering); do not floor/clamp this
 * value, since clamping a very negative sum to a fixed floor would collapse
 * every candidate to the same cost and make ranking arbitrary.
 *
 * Incompatible pairings are penalized to near-infeasibility rather than
 * hard-excluded so the solver can still produce a "least bad" plan when
 * nothing compatible is free.
 */
export function assignmentCost(input: AssignmentCostInput): number {
  const {
    severity,
    casualties,
    waitingMinutes,
    etaMinutes,
    compatibilityScore,
    hospitalRequired,
    hospitalAvailable,
    resourceCurrentLoad,
  } = input;

  if (compatibilityScore <= 0) return 1_000_000;

  const urgency = priorityScore({ severity, casualties, waitingMinutes });
  const travelCost = etaMinutes * 6;
  const urgencyDiscount = urgency * 1.4;
  const compatibilityPenalty = (1 - compatibilityScore) * 250;
  const hospitalPenalty = hospitalRequired && !hospitalAvailable ? 180 : 0;
  const loadPenalty = resourceCurrentLoad * 40;

  const cost = travelCost - urgencyDiscount + compatibilityPenalty + hospitalPenalty + loadPenalty;
  return round(cost);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
