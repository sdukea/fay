/**
 * Shared incident-generation model: the same type/severity distribution used
 * both to seed the initial world (lib/server/seedWorld.ts) and to keep new
 * incidents streaming in during a live session (lib/server/incidentStream.ts).
 * Kept dependency-free (no Prisma) so it's trivially unit-testable.
 */

export type GeneratedResourceType = "AMBULANCE" | "FIRE_ENGINE" | "POLICE" | "HAZMAT" | "RESCUE";

export interface IncidentTypeDef {
  type: string;
  requiredResourceType: GeneratedResourceType;
  hospitalRequired: boolean;
  weight: number;
  descriptions: string[];
}

export const INCIDENT_TYPES: IncidentTypeDef[] = [
  { type: "MEDICAL", requiredResourceType: "AMBULANCE", hospitalRequired: true, weight: 9, descriptions: ["Cardiac emergency", "Severe fall injury", "Respiratory distress", "Diabetic emergency"] },
  { type: "TRAFFIC_COLLISION", requiredResourceType: "AMBULANCE", hospitalRequired: true, weight: 8, descriptions: ["Two-vehicle collision", "Motorcycle collision", "Multi-vehicle pileup", "Pedestrian struck"] },
  { type: "FIRE", requiredResourceType: "FIRE_ENGINE", hospitalRequired: false, weight: 4, descriptions: ["Structure fire", "Vehicle fire", "Electrical fire", "Warehouse fire"] },
  { type: "STRUCTURAL", requiredResourceType: "RESCUE", hospitalRequired: true, weight: 2, descriptions: ["Partial building collapse", "Scaffolding collapse", "Trapped construction worker"] },
  { type: "HAZMAT", requiredResourceType: "HAZMAT", hospitalRequired: false, weight: 1, descriptions: ["Chemical spill", "Gas leak"] },
  { type: "PUBLIC_SAFETY", requiredResourceType: "POLICE", hospitalRequired: false, weight: 4, descriptions: ["Crowd disturbance", "Armed altercation report", "Suspicious package"] },
];

export function weightedIncidentType(rand: () => number): IncidentTypeDef {
  const total = INCIDENT_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = rand() * total;
  for (const t of INCIDENT_TYPES) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return INCIDENT_TYPES[0];
}

/** Rarer incident types (mass casualty, hazmat, structural) skew severe. */
export function severityFor(rand: () => number, typeWeight: number): number {
  const roll = rand();
  if (typeWeight <= 2) return roll < 0.5 ? 5 : roll < 0.85 ? 4 : 3;
  if (roll < 0.08) return 5;
  if (roll < 0.28) return 4;
  if (roll < 0.62) return 3;
  if (roll < 0.87) return 2;
  return 1;
}

export function casualtiesFor(rand: () => number, severity: number): number {
  if (severity >= 4) return Math.floor(rand() * 6);
  if (rand() < 0.4) return Math.floor(rand() * 2);
  return 0;
}
