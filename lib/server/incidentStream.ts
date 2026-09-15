import { prisma } from "@/lib/db/client";
import { haversineKm } from "@/lib/domain/geo";
import { casualtiesFor, severityFor, weightedIncidentType } from "@/lib/domain/incidentGenerator";
import { logEvent } from "./dispatch";

const MIN_ACTIVE = 18;
const MAX_ACTIVE = 40;

/**
 * Keeps the board alive: a real operations center never goes quiet, so
 * incidents keep arriving on their own rather than only through Simulate.
 * Self-regulating by a target band rather than a fixed rate — spawns
 * aggressively when the active count drops low, rarely once it's already
 * busy, so the world breathes instead of growing without bound or ever
 * running dry.
 */
export async function runIncidentStreamTick(seed = Date.now()): Promise<{ created: string[] }> {
  const activeCount = await prisma.incident.count({ where: { status: { not: "RESOLVED" } } });

  let spawnChance: number;
  if (activeCount < MIN_ACTIVE) spawnChance = 0.75;
  else if (activeCount < MAX_ACTIVE) spawnChance = 0.25;
  else spawnChance = 0;

  if (spawnChance === 0 || Math.random() > spawnChance) {
    return { created: [] };
  }

  const [zones, hospitals, existingCount] = await Promise.all([
    prisma.zone.findMany(),
    prisma.hospital.findMany(),
    prisma.incident.count(),
  ]);
  if (zones.length === 0) return { created: [] };

  // Cheap local PRNG (mulberry32) seeded from Date.now() by default — a
  // caller can pass a fixed seed to make one tick reproducible in tests.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const zone = zones[Math.floor(rand() * zones.length)];
  const typeDef = weightedIncidentType(rand);
  const severity = severityFor(rand, typeDef.weight);
  const casualties = casualtiesFor(rand, severity);
  const nearestHospital = typeDef.hospitalRequired
    ? [...hospitals].sort((a, b) => haversineKm(zone, a) - haversineKm(zone, b))[0]
    : null;

  const incident = await prisma.incident.create({
    data: {
      code: `INC-${100 + existingCount + 1}`,
      type: typeDef.type as never,
      severity,
      status: "UNASSIGNED",
      latitude: zone.latitude + (rand() - 0.5) * (zone.radiusKm / 50),
      longitude: zone.longitude + (rand() - 0.5) * (zone.radiusKm / 50),
      casualties,
      requiredResourceType: typeDef.requiredResourceType,
      hospitalRequired: typeDef.hospitalRequired,
      hospitalId: nearestHospital?.id ?? null,
      zoneId: zone.id,
      description: `${typeDef.descriptions[Math.floor(rand() * typeDef.descriptions.length)]} — ${zone.name}`,
      waitingSinceMinutes: 0,
    },
  });

  await logEvent({
    incidentId: incident.id,
    type: "INCIDENTS_DETECTED",
    message: `New incident reported — ${incident.description}`,
    payload: { incidentCode: incident.code, severity },
  });

  return { created: [incident.code] };
}
