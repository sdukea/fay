import type { PrismaClient } from "@prisma/client";
import { haversineKm, etaMinutes } from "@/lib/domain/geo";
import { compatibility, priorityScore } from "@/lib/domain/scoring";
import { casualtiesFor, severityFor, weightedIncidentType } from "@/lib/domain/incidentGenerator";

// Deterministic PRNG (mulberry32) so every "Load Demo" / reset produces the
// same realistic world — required for reproducible demos in front of judges.
function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ZoneSeed {
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  riskLevel: number;
}

const ZONES: ZoneSeed[] = [
  { name: "Central Business Zone", latitude: 12.9716, longitude: 77.5946, radiusKm: 2.2, riskLevel: 3 },
  { name: "Richmond District", latitude: 12.9611, longitude: 77.5988, radiusKm: 1.8, riskLevel: 3 },
  { name: "Koramangala Corridor", latitude: 12.9352, longitude: 77.6146, radiusKm: 2.0, riskLevel: 2 },
  { name: "Indiranagar Heights", latitude: 12.9784, longitude: 77.6408, radiusKm: 1.7, riskLevel: 2 },
  { name: "Whitefield Tech Park", latitude: 12.9698, longitude: 77.75, radiusKm: 2.6, riskLevel: 2 },
  { name: "Electronic City South", latitude: 12.8452, longitude: 77.6602, radiusKm: 2.4, riskLevel: 2 },
  { name: "Jayanagar Residential", latitude: 12.9308, longitude: 77.5838, radiusKm: 1.9, riskLevel: 1 },
  { name: "North Industrial Corridor", latitude: 13.0284, longitude: 77.554, radiusKm: 2.8, riskLevel: 4 },
  { name: "Hebbal Junction", latitude: 13.0358, longitude: 77.597, radiusKm: 1.6, riskLevel: 3 },
  { name: "East Medical District", latitude: 12.96, longitude: 77.655, radiusKm: 1.5, riskLevel: 2 },
  { name: "Malleshwaram West", latitude: 13.0067, longitude: 77.573, radiusKm: 1.6, riskLevel: 1 },
  { name: "HSR Layout", latitude: 12.9116, longitude: 77.6389, radiusKm: 1.9, riskLevel: 2 },
  { name: "Marathahalli Bridge", latitude: 12.9569, longitude: 77.7011, radiusKm: 1.7, riskLevel: 4 },
  { name: "Banashankari South", latitude: 12.9081, longitude: 77.557, radiusKm: 1.8, riskLevel: 1 },
  { name: "Yelahanka New Town", latitude: 13.1007, longitude: 77.5963, radiusKm: 2.3, riskLevel: 2 },
];

const HOSPITALS = [
  { name: "Central Medical Center", latitude: 12.9736, longitude: 77.5958, capacity: 40, traumaCenter: true },
  { name: "North General Hospital", latitude: 13.0338, longitude: 77.5991, capacity: 30, traumaCenter: false },
  { name: "East Trauma Center", latitude: 12.9615, longitude: 77.6531, capacity: 35, traumaCenter: true },
  { name: "Koramangala Community Hospital", latitude: 12.9368, longitude: 77.6169, capacity: 20, traumaCenter: false },
  { name: "Whitefield Health Institute", latitude: 12.9705, longitude: 77.7478, capacity: 25, traumaCenter: false },
  { name: "Electronic City Medical", latitude: 12.847, longitude: 77.6584, capacity: 22, traumaCenter: false },
  { name: "Jayanagar General", latitude: 12.9291, longitude: 77.5822, capacity: 18, traumaCenter: false },
  { name: "Yelahanka District Hospital", latitude: 13.0989, longitude: 77.5942, capacity: 15, traumaCenter: false },
];

const RESOURCE_PLAN: Array<{ type: "AMBULANCE" | "FIRE_ENGINE" | "POLICE" | "HAZMAT" | "RESCUE"; prefix: string; count: number; capacity: number }> = [
  { type: "AMBULANCE", prefix: "AMB", count: 18, capacity: 2 },
  { type: "FIRE_ENGINE", prefix: "FIRE", count: 8, capacity: 6 },
  { type: "POLICE", prefix: "POL", count: 8, capacity: 4 },
  { type: "RESCUE", prefix: "RESCUE", count: 4, capacity: 5 },
  { type: "HAZMAT", prefix: "HAZMAT", count: 2, capacity: 3 },
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export interface SeedOptions {
  seed?: number;
  incidentCount?: number;
}

export async function seedWorld(prisma: PrismaClient, options: SeedOptions = {}) {
  const rand = mulberry32(options.seed ?? 20260915);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const jitter = (spread: number) => (rand() - 0.5) * 2 * spread;
  const incidentCount = options.incidentCount ?? 30;

  await prisma.event.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.optimizationRun.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.systemState.deleteMany();
  // Operators are deliberately NOT reset here — they're signed-in identities,
  // not part of the simulated world, and resetting the demo must not log
  // anyone out.

  const zones = [];
  for (const z of ZONES) zones.push(await prisma.zone.create({ data: z }));

  const hospitals = [];
  for (const h of HOSPITALS) {
    hospitals.push(
      await prisma.hospital.create({ data: { ...h, currentLoad: Math.floor(h.capacity * (0.35 + rand() * 0.3)) } }),
    );
  }

  const resources = [];
  for (const plan of RESOURCE_PLAN) {
    for (let i = 1; i <= plan.count; i++) {
      const zone = pick(zones);
      resources.push(
        await prisma.resource.create({
          data: {
            code: `${plan.prefix}-${String(i).padStart(2, "0")}`,
            type: plan.type,
            status: "AVAILABLE",
            latitude: zone.latitude + jitter(0.01),
            longitude: zone.longitude + jitter(0.01),
            homeLatitude: zone.latitude,
            homeLongitude: zone.longitude,
            capacity: plan.capacity,
            specialization: null,
          },
        }),
      );
    }
  }

  const incidents = [];
  for (let i = 1; i <= incidentCount; i++) {
    const zone = pick(zones);
    const typeDef = weightedIncidentType(rand);
    const severity = severityFor(rand, typeDef.weight);
    const casualties = casualtiesFor(rand, severity);
    const waitingSinceMinutes = round1(1 + rand() * 18);
    const nearestHospital = typeDef.hospitalRequired
      ? [...hospitals].sort((a, b) => haversineKm(zone, a) - haversineKm(zone, b))[0]
      : null;

    incidents.push(
      await prisma.incident.create({
        data: {
          code: `INC-${100 + i}`,
          type: typeDef.type as never,
          severity,
          status: "UNASSIGNED",
          latitude: zone.latitude + jitter(zone.radiusKm / 100),
          longitude: zone.longitude + jitter(zone.radiusKm / 100),
          casualties,
          requiredResourceType: typeDef.requiredResourceType,
          hospitalRequired: typeDef.hospitalRequired,
          hospitalId: nearestHospital?.id ?? null,
          zoneId: zone.id,
          description: `${pick(typeDef.descriptions)} — ${zone.name}`,
          waitingSinceMinutes,
        },
      }),
    );
  }

  const sortedByPriority = [...incidents].sort(
    (a, b) =>
      priorityScore({ severity: b.severity, casualties: b.casualties, waitingMinutes: b.waitingSinceMinutes }) -
      priorityScore({ severity: a.severity, casualties: a.casualties, waitingMinutes: a.waitingSinceMinutes }),
  );
  const freeResources = new Set(resources.map((r) => r.id));
  const preAssignCount = Math.round(incidents.length * 0.55);
  let assignedSoFar = 0;

  for (const incident of sortedByPriority) {
    if (assignedSoFar >= preAssignCount) break;
    let best: { id: string; distanceKm: number } | null = null;
    for (const resourceId of freeResources) {
      const resource = resources.find((r) => r.id === resourceId)!;
      const compat = compatibility(incident.type, resource.type);
      if (compat <= 0) continue;
      const distanceKm = haversineKm(incident, resource);
      if (!best || distanceKm < best.distanceKm) best = { id: resourceId, distanceKm };
    }
    if (!best) continue;

    const resource = resources.find((r) => r.id === best!.id)!;
    const eta = etaMinutes(best.distanceKm);
    const assignment = await prisma.assignment.create({
      data: {
        incidentId: incident.id,
        resourceId: resource.id,
        status: "ACTIVE",
        etaMinutes: eta,
        distanceKm: round1(best.distanceKm),
      },
    });
    await prisma.incident.update({ where: { id: incident.id }, data: { status: "ASSIGNED" } });
    await prisma.resource.update({
      where: { id: resource.id },
      data: { status: "EN_ROUTE", currentAssignmentId: assignment.id },
    });
    await prisma.event.create({
      data: {
        incidentId: incident.id,
        type: "RESOURCE_ASSIGNED",
        message: `${resource.code} dispatched to ${incident.code}`,
        payloadJson: JSON.stringify({ resourceCode: resource.code, incidentCode: incident.code, etaMinutes: eta }),
      },
    });
    freeResources.delete(resource.id);
    assignedSoFar++;
  }

  const scenarioDefs = [
    { key: "NORMAL", name: "Normal Operations", description: "Baseline steady-state operations." },
    { key: "MASS_CASUALTY", name: "Mass Casualty Event", description: "A large-scale incident generates a surge of simultaneous casualties." },
    { key: "RESOURCE_FAILURE", name: "Resource Failure", description: "Multiple emergency resources unexpectedly go offline." },
    { key: "TRAFFIC_DISRUPTION", name: "Traffic Disruption", description: "City-wide congestion multiplies travel times." },
    { key: "HOSPITAL_OVERLOAD", name: "Hospital Overload", description: "Hospitals approach or exceed capacity, degrading transport options." },
    { key: "MULTI_INCIDENT", name: "Multiple Simultaneous Incidents", description: "Several unrelated incidents occur in immediate succession." },
  ];
  for (const s of scenarioDefs) await prisma.scenario.create({ data: s });

  await prisma.systemState.create({
    data: { id: "singleton", dispatchMode: "HUMAN_APPROVAL", activeScenarioKey: "NORMAL" },
  });

  return {
    zones: zones.length,
    hospitals: hospitals.length,
    resources: resources.length,
    incidents: incidents.length,
    preAssigned: assignedSoFar,
  };
}
