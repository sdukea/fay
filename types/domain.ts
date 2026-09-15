export type IncidentType =
  | "MEDICAL"
  | "FIRE"
  | "TRAFFIC_COLLISION"
  | "STRUCTURAL"
  | "HAZMAT"
  | "PUBLIC_SAFETY"
  | "MASS_CASUALTY";

export type IncidentStatus = "UNASSIGNED" | "ASSIGNED" | "ON_SCENE" | "RESOLVED";

export type ResourceType = "AMBULANCE" | "FIRE_ENGINE" | "POLICE" | "HAZMAT" | "RESCUE";

export type ResourceStatus = "AVAILABLE" | "EN_ROUTE" | "ON_SCENE" | "RETURNING" | "OFFLINE";

export type AssignmentStatus = "PROPOSED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type DispatchMode = "HUMAN_APPROVAL" | "AUTO_DISPATCH";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface IncidentDTO extends GeoPoint {
  id: string;
  code: string;
  type: IncidentType;
  severity: number;
  status: IncidentStatus;
  casualties: number;
  requiredResourceType: ResourceType;
  hospitalRequired: boolean;
  hospitalId: string | null;
  zoneId: string | null;
  zoneName: string | null;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  waitingSinceMinutes: number;
  scenarioTag: string | null;
  assignedResourceCode: string | null;
  assignedEtaMinutes: number | null;
  /** When the active assignment was made — the anchor for the map's travel-progress animation. */
  assignedAt: string | null;
}

export interface ResourceDTO extends GeoPoint {
  id: string;
  code: string;
  type: ResourceType;
  status: ResourceStatus;
  homeLatitude: number;
  homeLongitude: number;
  capacity: number;
  specialization: string | null;
  currentAssignmentId: string | null;
  currentIncidentCode: string | null;
}

export interface HospitalDTO extends GeoPoint {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  traumaCenter: boolean;
  utilizationPct: number;
}

export interface AssignmentDTO {
  id: string;
  incidentId: string;
  incidentCode: string;
  resourceId: string;
  resourceCode: string;
  status: AssignmentStatus;
  etaMinutes: number;
  distanceKm: number;
  assignedAt: string;
  isOverride: boolean;
  overrideReason: string | null;
  recommendedResourceId: string | null;
}

export interface EventDTO {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  incidentCode: string | null;
  payload: Record<string, unknown>;
}

export interface DecisionDrivers {
  severity: number;
  casualties: number;
  waitMinutes: number;
  distanceKm: number;
  compatibilityPct: number;
  hospitalAvailable: boolean;
}

export interface CandidateResource {
  resourceId: string;
  resourceCode: string;
  resourceType: ResourceType;
  etaMinutes: number;
  distanceKm: number;
  compatible: boolean;
  currentWorkload: number;
  cost: number;
  isRecommended: boolean;
}

export interface DecisionExplanation {
  incidentId: string;
  incidentCode: string;
  recommendedResourceCode: string | null;
  etaMinutes: number | null;
  drivers: DecisionDrivers | null;
  expectedImpactMinutes: number | null;
  narrative: string;
  candidates: CandidateResource[];
}

export interface SystemMetrics {
  activeIncidents: number;
  criticalIncidents: number;
  avgEtaMinutes: number;
  coveragePct: number;
  availableResources: number;
  totalResources: number;
}

export interface ComparisonMetrics {
  avgResponseMinutes: number;
  weightedResponseMinutes: number;
  worstResponseMinutes: number;
  criticalAtRiskCount: number;
  coveragePct: number;
  unservedIncidents: number;
  resourceUtilizationPct: number;
}

export interface OptimizationResultDTO {
  id: string;
  createdAt: string;
  baseline: ComparisonMetrics;
  optimized: ComparisonMetrics;
  improvementPct: number;
  proposals: Array<{
    incidentId: string;
    incidentCode: string;
    resourceId: string;
    resourceCode: string;
    previousResourceCode: string | null;
    etaMinutes: number;
    distanceKm: number;
    drivers: DecisionDrivers;
    expectedImpactMinutes: number;
  }>;
}

export const SCENARIO_KEYS = [
  "NORMAL",
  "MASS_CASUALTY",
  "RESOURCE_FAILURE",
  "TRAFFIC_DISRUPTION",
  "HOSPITAL_OVERLOAD",
  "MULTI_INCIDENT",
] as const;

export type ScenarioKey = (typeof SCENARIO_KEYS)[number];
