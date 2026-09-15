import { prisma } from "@/lib/db/client";
import { haversineKm, etaMinutes } from "@/lib/domain/geo";

export async function logEvent(params: {
  type: string;
  message: string;
  payload?: Record<string, unknown>;
  incidentId?: string;
  simulationRunId?: string;
}) {
  return prisma.event.create({
    data: {
      type: params.type,
      message: params.message,
      payloadJson: JSON.stringify(params.payload ?? {}),
      incidentId: params.incidentId,
      simulationRunId: params.simulationRunId,
    },
  });
}

/** Releases a resource's current active assignment, if any, back to AVAILABLE. */
async function releaseResourceAssignment(resourceId: string) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource?.currentAssignmentId) return;

  await prisma.assignment.update({
    where: { id: resource.currentAssignmentId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await prisma.resource.update({
    where: { id: resourceId },
    data: { currentAssignmentId: null, status: "AVAILABLE" },
  });
}

export interface DispatchParams {
  incidentId: string;
  resourceId: string;
  recommendedResourceId?: string | null;
  optimizationRunId?: string | null;
  reason?: string;
  operatorName?: string | null;
}

export async function dispatchResource(params: DispatchParams) {
  const { incidentId, resourceId, recommendedResourceId, optimizationRunId, reason, operatorName } = params;

  const [incident, resource] = await Promise.all([
    prisma.incident.findUniqueOrThrow({ where: { id: incidentId } }),
    prisma.resource.findUniqueOrThrow({ where: { id: resourceId } }),
  ]);

  if (resource.status === "OFFLINE") {
    throw new Error(`${resource.code} is offline and cannot be dispatched.`);
  }

  // Free any existing assignment on this incident before assigning anew.
  const existing = await prisma.assignment.findFirst({
    where: { incidentId, status: "ACTIVE" },
  });
  if (existing) {
    await prisma.assignment.update({ where: { id: existing.id }, data: { status: "CANCELLED", completedAt: new Date() } });
    await prisma.resource.updateMany({
      where: { currentAssignmentId: existing.id },
      data: { currentAssignmentId: null, status: "AVAILABLE" },
    });
  }
  // Free the target resource if it was already committed elsewhere.
  await releaseResourceAssignment(resourceId);

  const distanceKm = haversineKm(incident, resource);
  const eta = etaMinutes(distanceKm);
  const isOverride = Boolean(recommendedResourceId && recommendedResourceId !== resourceId);

  const assignment = await prisma.assignment.create({
    data: {
      incidentId,
      resourceId,
      status: "ACTIVE",
      etaMinutes: eta,
      distanceKm: Math.round(distanceKm * 100) / 100,
      isOverride,
      overrideReason: isOverride ? (reason ?? "Manual dispatch") : null,
      recommendedResourceId: recommendedResourceId ?? null,
      optimizationRunId: optimizationRunId ?? null,
    },
  });

  await prisma.incident.update({ where: { id: incidentId }, data: { status: "ASSIGNED" } });
  await prisma.resource.update({
    where: { id: resourceId },
    data: { status: "EN_ROUTE", currentAssignmentId: assignment.id },
  });

  await logEvent({
    incidentId,
    type: isOverride ? "OPERATOR_OVERRIDE" : "RESOURCE_ASSIGNED",
    message: isOverride
      ? `${operatorName ?? "Operator"} overrode Fay's recommendation — dispatched ${resource.code} to ${incident.code}`
      : operatorName
        ? `${operatorName} dispatched ${resource.code} to ${incident.code}`
        : `${resource.code} dispatched to ${incident.code}`,
    payload: { resourceCode: resource.code, incidentCode: incident.code, etaMinutes: eta, isOverride, operatorName: operatorName ?? null },
  });

  return assignment;
}

export async function resolveIncident(incidentId: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const assignment = await prisma.assignment.findFirst({ where: { incidentId, status: "ACTIVE" }, include: { resource: true } });

  await prisma.incident.update({ where: { id: incidentId }, data: { status: "RESOLVED", resolvedAt: new Date() } });

  if (assignment) {
    await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await prisma.resource.update({ where: { id: assignment.resourceId }, data: { status: "AVAILABLE", currentAssignmentId: null } });
  }

  await logEvent({
    incidentId,
    type: "INCIDENT_RESOLVED",
    message: `${incident.code} marked resolved`,
    payload: { incidentCode: incident.code },
  });
}
