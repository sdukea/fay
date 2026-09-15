import { prisma } from "@/lib/db/client";
import { arrivalTimeMs, resolveTimeMs } from "@/lib/domain/lifecycle";
import { logEvent } from "./dispatch";

export interface LifecycleTickResult {
  arrived: string[];
  returnedToService: string[];
}

/**
 * Advances every in-progress assignment's physical state: a resource that
 * has traveled long enough EN_ROUTE arrives ON_SCENE, and one that has been
 * ON_SCENE long enough completes — the incident resolves and the resource
 * becomes AVAILABLE again automatically, with no operator click required.
 * This is pure physical simulation (arrival/completion timing), never a
 * dispatch decision, so it runs regardless of Human Approval / Auto Dispatch
 * mode.
 */
export async function runLifecycleTick(): Promise<LifecycleTickResult> {
  const now = Date.now();
  const arrived: string[] = [];
  const returnedToService: string[] = [];

  const enRoute = await prisma.resource.findMany({
    where: { status: "EN_ROUTE", currentAssignmentId: { not: null } },
    include: { currentAssignment: { include: { incident: true } } },
  });

  for (const resource of enRoute) {
    const assignment = resource.currentAssignment;
    if (!assignment) continue;
    if (now < arrivalTimeMs(assignment.assignedAt.getTime(), assignment.etaMinutes)) continue;

    await prisma.resource.update({ where: { id: resource.id }, data: { status: "ON_SCENE" } });
    await prisma.incident.update({ where: { id: assignment.incidentId }, data: { status: "ON_SCENE" } });
    await logEvent({
      incidentId: assignment.incidentId,
      type: "RESOURCE_ARRIVED",
      message: `${resource.code} arrived on scene at ${assignment.incident.code}`,
      payload: { resourceCode: resource.code, incidentCode: assignment.incident.code },
    });
    arrived.push(resource.code);
  }

  const onScene = await prisma.resource.findMany({
    where: { status: "ON_SCENE", currentAssignmentId: { not: null } },
    include: { currentAssignment: { include: { incident: true } } },
  });

  for (const resource of onScene) {
    const assignment = resource.currentAssignment;
    if (!assignment) continue;
    if (now < resolveTimeMs(assignment.assignedAt.getTime(), assignment.etaMinutes)) continue;

    await prisma.incident.update({
      where: { id: assignment.incidentId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await prisma.resource.update({ where: { id: resource.id }, data: { status: "AVAILABLE", currentAssignmentId: null } });
    await logEvent({
      incidentId: assignment.incidentId,
      type: "RESOURCE_RETURNED",
      message: `${resource.code} completed response to ${assignment.incident.code} — back in service`,
      payload: { resourceCode: resource.code, incidentCode: assignment.incident.code },
    });
    returnedToService.push(resource.code);
  }

  return { arrived, returnedToService };
}
