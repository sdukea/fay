import { prisma } from "@/lib/db/client";
import { logEvent } from "@/lib/server/dispatch";
import type { ScenarioKey } from "@/types/domain";

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

const INCIDENT_DESCRIPTIONS: Record<string, string[]> = {
  MASS_CASUALTY: ["Multi-vehicle pileup with mass casualties", "Building collapse — multiple trapped", "Crowd crush incident"],
  TRAFFIC_COLLISION: ["Secondary collision from congestion", "Multi-vehicle collision"],
  MEDICAL: ["Medical emergency reported", "Mass casualty triage case"],
  STRUCTURAL: ["Structural failure reported"],
};

async function countCriticalAtRisk(): Promise<number> {
  const incidents = await prisma.incident.findMany({
    where: { status: { not: "RESOLVED" }, severity: { gte: 4 } },
    include: { assignments: { where: { status: "ACTIVE" } } },
  });
  return incidents.filter((i) => i.assignments.length === 0 || i.assignments[0].etaMinutes > 10).length;
}

export async function runMassCasualtyScenario(seed = Date.now()) {
  const rand = mulberry32(seed);
  const zones = await prisma.zone.findMany();
  const epicenter = zones[Math.floor(rand() * zones.length)];
  const hospitals = await prisma.hospital.findMany();

  const existing = await prisma.incident.count();
  const newIncidentCount = 10 + Math.floor(rand() * 3);
  const created: string[] = [];

  await logEvent({
    type: "SCENARIO_TRIGGERED",
    message: `Mass casualty event triggered near ${epicenter.name}`,
    payload: { scenario: "MASS_CASUALTY", zone: epicenter.name },
  });

  for (let i = 0; i < newIncidentCount; i++) {
    const severity = i < 3 ? 5 : 3 + Math.floor(rand() * 2);
    const casualties = 4 + Math.floor(rand() * 12);
    const nearestHospital = [...hospitals].sort(
      (a, b) =>
        (a.latitude - epicenter.latitude) ** 2 + (a.longitude - epicenter.longitude) ** 2 -
        ((b.latitude - epicenter.latitude) ** 2 + (b.longitude - epicenter.longitude) ** 2),
    )[0];

    const incident = await prisma.incident.create({
      data: {
        code: `INC-${100 + existing + i + 1}`,
        type: "MASS_CASUALTY",
        severity,
        status: "UNASSIGNED",
        latitude: epicenter.latitude + (rand() - 0.5) * 0.01,
        longitude: epicenter.longitude + (rand() - 0.5) * 0.01,
        casualties,
        requiredResourceType: "AMBULANCE",
        hospitalRequired: true,
        hospitalId: nearestHospital?.id ?? null,
        zoneId: epicenter.id,
        description: `${INCIDENT_DESCRIPTIONS.MASS_CASUALTY[i % INCIDENT_DESCRIPTIONS.MASS_CASUALTY.length]} — ${epicenter.name}`,
        waitingSinceMinutes: 0,
        scenarioTag: "MASS_CASUALTY",
      },
    });
    created.push(incident.code);
  }

  await logEvent({
    type: "INCIDENTS_DETECTED",
    message: `${newIncidentCount} additional incidents detected near ${epicenter.name}`,
    payload: { scenario: "MASS_CASUALTY", codes: created },
  });

  const atRisk = await countCriticalAtRisk();
  await logEvent({
    type: "BOTTLENECK_DETECTED",
    message: `${atRisk} critical incidents currently at risk`,
    payload: { scenario: "MASS_CASUALTY", criticalAtRisk: atRisk },
  });

  return { newIncidentCount, epicenter: epicenter.name, createdCodes: created, criticalAtRisk: atRisk };
}

export async function runResourceFailureScenario(seed = Date.now()) {
  const rand = mulberry32(seed);
  const candidates = await prisma.resource.findMany({
    where: { status: { in: ["AVAILABLE", "EN_ROUTE"] } },
  });
  const shuffled = [...candidates].sort(() => rand() - 0.5);
  const toFail = shuffled.slice(0, Math.min(3, shuffled.length));
  const affectedIncidents: string[] = [];

  for (const resource of toFail) {
    if (resource.currentAssignmentId) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: resource.currentAssignmentId },
        include: { incident: true },
      });
      if (assignment) {
        await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "CANCELLED", completedAt: new Date() } });
        await prisma.incident.update({ where: { id: assignment.incidentId }, data: { status: "UNASSIGNED" } });
        affectedIncidents.push(assignment.incident.code);
      }
    }
    await prisma.resource.update({ where: { id: resource.id }, data: { status: "OFFLINE", currentAssignmentId: null } });
  }

  await logEvent({
    type: "SCENARIO_TRIGGERED",
    message: `Resource failure — ${toFail.map((r) => r.code).join(", ")} went offline`,
    payload: { scenario: "RESOURCE_FAILURE", resources: toFail.map((r) => r.code), affectedIncidents },
  });

  const atRisk = await countCriticalAtRisk();
  await logEvent({
    type: "BOTTLENECK_DETECTED",
    message: `${atRisk} critical incidents currently at risk`,
    payload: { scenario: "RESOURCE_FAILURE", criticalAtRisk: atRisk },
  });

  return { offlineResources: toFail.map((r) => r.code), affectedIncidents, criticalAtRisk: atRisk };
}

export async function runTrafficDisruptionScenario() {
  const multiplier = 1.9;
  await prisma.systemState.upsert({
    where: { id: "singleton" },
    update: { trafficMultiplier: multiplier },
    create: { id: "singleton", trafficMultiplier: multiplier },
  });

  await logEvent({
    type: "SCENARIO_TRIGGERED",
    message: `Traffic disruption — city-wide travel time multiplier raised to ${multiplier}x`,
    payload: { scenario: "TRAFFIC_DISRUPTION", multiplier },
  });

  return { trafficMultiplier: multiplier };
}

export async function runHospitalOverloadScenario(seed = Date.now()) {
  const rand = mulberry32(seed);
  const hospitals = await prisma.hospital.findMany();
  const shuffled = [...hospitals].sort(() => rand() - 0.5);
  const affected = shuffled.slice(0, Math.min(3, shuffled.length));

  for (const hospital of affected) {
    await prisma.hospital.update({ where: { id: hospital.id }, data: { currentLoad: hospital.capacity } });
  }

  await logEvent({
    type: "SCENARIO_TRIGGERED",
    message: `Hospital overload — ${affected.map((h) => h.name).join(", ")} at full capacity`,
    payload: { scenario: "HOSPITAL_OVERLOAD", hospitals: affected.map((h) => h.name) },
  });

  return { overloadedHospitals: affected.map((h) => h.name) };
}

export async function runMultiIncidentScenario(seed = Date.now()) {
  const rand = mulberry32(seed);
  const zones = await prisma.zone.findMany();
  const hospitals = await prisma.hospital.findMany();
  const existing = await prisma.incident.count();
  const count = 5 + Math.floor(rand() * 2);
  const created: string[] = [];
  const types: Array<{ type: string; requiredResourceType: string; hospitalRequired: boolean }> = [
    { type: "TRAFFIC_COLLISION", requiredResourceType: "AMBULANCE", hospitalRequired: true },
    { type: "FIRE", requiredResourceType: "FIRE_ENGINE", hospitalRequired: false },
    { type: "PUBLIC_SAFETY", requiredResourceType: "POLICE", hospitalRequired: false },
    { type: "MEDICAL", requiredResourceType: "AMBULANCE", hospitalRequired: true },
  ];

  for (let i = 0; i < count; i++) {
    const zone = zones[Math.floor(rand() * zones.length)];
    const def = types[Math.floor(rand() * types.length)];
    const severity = 2 + Math.floor(rand() * 3);
    const nearestHospital = def.hospitalRequired
      ? [...hospitals].sort(
          (a, b) =>
            (a.latitude - zone.latitude) ** 2 + (a.longitude - zone.longitude) ** 2 -
            ((b.latitude - zone.latitude) ** 2 + (b.longitude - zone.longitude) ** 2),
        )[0]
      : null;

    const incident = await prisma.incident.create({
      data: {
        code: `INC-${100 + existing + i + 1}`,
        type: def.type as never,
        severity,
        status: "UNASSIGNED",
        latitude: zone.latitude + (rand() - 0.5) * (zone.radiusKm / 60),
        longitude: zone.longitude + (rand() - 0.5) * (zone.radiusKm / 60),
        casualties: severity >= 4 ? Math.floor(rand() * 4) : 0,
        requiredResourceType: def.requiredResourceType as never,
        hospitalRequired: def.hospitalRequired,
        hospitalId: nearestHospital?.id ?? null,
        zoneId: zone.id,
        description: `${INCIDENT_DESCRIPTIONS[def.type]?.[0] ?? "Incident reported"} — ${zone.name}`,
        waitingSinceMinutes: 0,
        scenarioTag: "MULTI_INCIDENT",
      },
    });
    created.push(incident.code);
  }

  await logEvent({
    type: "INCIDENTS_DETECTED",
    message: `${count} simultaneous incidents reported across the city`,
    payload: { scenario: "MULTI_INCIDENT", codes: created },
  });

  return { createdCodes: created };
}

export async function runScenario(key: ScenarioKey) {
  await prisma.systemState.upsert({
    where: { id: "singleton" },
    update: { activeScenarioKey: key },
    create: { id: "singleton", activeScenarioKey: key },
  });

  switch (key) {
    case "MASS_CASUALTY":
      return runMassCasualtyScenario();
    case "RESOURCE_FAILURE":
      return runResourceFailureScenario();
    case "TRAFFIC_DISRUPTION":
      return runTrafficDisruptionScenario();
    case "HOSPITAL_OVERLOAD":
      return runHospitalOverloadScenario();
    case "MULTI_INCIDENT":
      return runMultiIncidentScenario();
    case "NORMAL":
    default:
      await prisma.systemState.upsert({
        where: { id: "singleton" },
        update: { trafficMultiplier: 1 },
        create: { id: "singleton", trafficMultiplier: 1 },
      });
      await logEvent({ type: "SCENARIO_TRIGGERED", message: "Returned to normal operations", payload: { scenario: "NORMAL" } });
      return {};
  }
}
