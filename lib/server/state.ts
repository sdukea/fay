import { prisma } from "@/lib/db/client";
import { toAssignmentDTO, toEventDTO, toHospitalDTO, toIncidentDTO, toResourceDTO } from "./dto";
import type { AssignmentDTO, EventDTO, HospitalDTO, IncidentDTO, ResourceDTO, SystemMetrics } from "@/types/domain";

export async function getIncidents(): Promise<IncidentDTO[]> {
  const incidents = await prisma.incident.findMany({
    where: { status: { not: "RESOLVED" } },
    include: { zone: true, assignments: { include: { resource: true } } },
    orderBy: { createdAt: "asc" },
  });
  return incidents.map(toIncidentDTO);
}

export async function getResources(): Promise<ResourceDTO[]> {
  const resources = await prisma.resource.findMany({
    include: { currentAssignment: { include: { incident: true } } },
    orderBy: { code: "asc" },
  });
  return resources.map(toResourceDTO);
}

export async function getHospitals(): Promise<HospitalDTO[]> {
  const hospitals = await prisma.hospital.findMany({ orderBy: { name: "asc" } });
  return hospitals.map(toHospitalDTO);
}

export async function getAssignments(): Promise<AssignmentDTO[]> {
  const assignments = await prisma.assignment.findMany({
    where: { status: "ACTIVE" },
    include: { incident: true, resource: true },
    orderBy: { assignedAt: "desc" },
  });
  return assignments.map(toAssignmentDTO);
}

export async function getEvents(limit = 100): Promise<EventDTO[]> {
  const events = await prisma.event.findMany({
    include: { incident: true },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return events.map(toEventDTO).reverse();
}

export function computeSystemMetrics(incidents: IncidentDTO[], resources: ResourceDTO[]): SystemMetrics {
  const activeIncidents = incidents.length;
  const criticalIncidents = incidents.filter((i) => i.severity >= 4).length;
  const assigned = incidents.filter((i) => i.assignedEtaMinutes !== null);
  const avgEtaMinutes = assigned.length
    ? round1(assigned.reduce((sum, i) => sum + (i.assignedEtaMinutes ?? 0), 0) / assigned.length)
    : 0;
  const coveragePct = activeIncidents ? round1((assigned.length / activeIncidents) * 100) : 100;
  const availableResources = resources.filter((r) => r.status === "AVAILABLE").length;

  return {
    activeIncidents,
    criticalIncidents,
    avgEtaMinutes,
    coveragePct,
    availableResources,
    totalResources: resources.length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
