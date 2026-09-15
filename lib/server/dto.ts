import type {
  Assignment,
  Hospital,
  Incident,
  Resource,
  Event as EventModel,
} from "@prisma/client";
import type {
  AssignmentDTO,
  EventDTO,
  HospitalDTO,
  IncidentDTO,
  ResourceDTO,
} from "@/types/domain";

type IncidentWithRelations = Incident & {
  zone?: { name: string } | null;
  assignments?: Array<Assignment & { resource: Resource }>;
};

export function toIncidentDTO(incident: IncidentWithRelations): IncidentDTO {
  const activeAssignment = incident.assignments?.find((a) => a.status === "ACTIVE" || a.status === "PROPOSED");
  return {
    id: incident.id,
    code: incident.code,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    latitude: incident.latitude,
    longitude: incident.longitude,
    casualties: incident.casualties,
    requiredResourceType: incident.requiredResourceType,
    hospitalRequired: incident.hospitalRequired,
    hospitalId: incident.hospitalId,
    zoneId: incident.zoneId,
    zoneName: incident.zone?.name ?? null,
    description: incident.description,
    createdAt: incident.createdAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    waitingSinceMinutes: liveWaitingMinutes(incident),
    scenarioTag: incident.scenarioTag,
    assignedResourceCode: activeAssignment?.resource.code ?? null,
    assignedEtaMinutes: activeAssignment?.etaMinutes ?? null,
    assignedAt: activeAssignment?.assignedAt.toISOString() ?? null,
  };
}

export function liveWaitingMinutes(incident: Incident): number {
  if (incident.status === "RESOLVED") return incident.waitingSinceMinutes;
  const elapsedMs = Date.now() - incident.createdAt.getTime();
  const elapsedMinutes = elapsedMs / 60000;
  return Math.round((incident.waitingSinceMinutes + elapsedMinutes) * 10) / 10;
}

type ResourceWithAssignment = Resource & { currentAssignment?: (Assignment & { incident: Incident }) | null };

export function toResourceDTO(resource: ResourceWithAssignment): ResourceDTO {
  return {
    id: resource.id,
    code: resource.code,
    type: resource.type,
    status: resource.status,
    latitude: resource.latitude,
    longitude: resource.longitude,
    homeLatitude: resource.homeLatitude,
    homeLongitude: resource.homeLongitude,
    capacity: resource.capacity,
    specialization: resource.specialization,
    currentAssignmentId: resource.currentAssignmentId,
    currentIncidentCode: resource.currentAssignment?.incident.code ?? null,
  };
}

export function toHospitalDTO(hospital: Hospital): HospitalDTO {
  return {
    id: hospital.id,
    name: hospital.name,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
    capacity: hospital.capacity,
    currentLoad: hospital.currentLoad,
    traumaCenter: hospital.traumaCenter,
    utilizationPct: Math.round((hospital.currentLoad / hospital.capacity) * 100),
  };
}

type AssignmentWithRelations = Assignment & { incident: Incident; resource: Resource };

export function toAssignmentDTO(assignment: AssignmentWithRelations): AssignmentDTO {
  return {
    id: assignment.id,
    incidentId: assignment.incidentId,
    incidentCode: assignment.incident.code,
    resourceId: assignment.resourceId,
    resourceCode: assignment.resource.code,
    status: assignment.status,
    etaMinutes: assignment.etaMinutes,
    distanceKm: assignment.distanceKm,
    assignedAt: assignment.assignedAt.toISOString(),
    isOverride: assignment.isOverride,
    overrideReason: assignment.overrideReason,
    recommendedResourceId: assignment.recommendedResourceId,
  };
}

type EventWithIncident = EventModel & { incident?: Incident | null };

export function toEventDTO(event: EventWithIncident): EventDTO {
  return {
    id: event.id,
    timestamp: event.timestamp.toISOString(),
    type: event.type,
    message: event.message,
    incidentCode: event.incident?.code ?? null,
    payload: safeParse(event.payloadJson),
  };
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
