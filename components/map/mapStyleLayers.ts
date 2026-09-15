import type { HospitalDTO, IncidentDTO, ResourceDTO } from "@/types/domain";

export const SOURCE_IDS = {
  incidents: "fay-incidents",
  resources: "fay-resources",
  hospitals: "fay-hospitals",
  route: "fay-route",
  coverage: "fay-coverage",
} as const;

const SEVERITY_COLOR = ["step", ["get", "severity"], "#5f6b80", 3, "#e8c547", 4, "#f0a742", 5, "#f0525a"];

const RESOURCE_COLOR = [
  "match",
  ["get", "status"],
  "AVAILABLE",
  "#35d0d0",
  "EN_ROUTE",
  "#f0a742",
  "ON_SCENE",
  "#5b8def",
  "RETURNING",
  "#9aa7bd",
  "#3d4657",
];

export function incidentsToGeoJSON(incidents: IncidentDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents.map((incident) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [incident.longitude, incident.latitude] },
      properties: {
        id: incident.id,
        code: incident.code,
        severity: incident.severity,
        status: incident.status,
        assigned: incident.assignedResourceCode !== null,
      },
    })),
  };
}

export function resourcesToGeoJSON(resources: ResourceDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: resources.map((resource) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [resource.longitude, resource.latitude] },
      properties: {
        id: resource.id,
        code: resource.code,
        type: resource.type,
        status: resource.status,
      },
    })),
  };
}

export function hospitalsToGeoJSON(hospitals: HospitalDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: hospitals.map((hospital) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [hospital.longitude, hospital.latitude] },
      properties: {
        id: hospital.id,
        name: hospital.name,
        utilizationPct: hospital.utilizationPct,
      },
    })),
  };
}

export function coverageToGeoJSON(resources: ResourceDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: resources
      .filter((r) => r.status === "AVAILABLE")
      .map((resource) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [resource.longitude, resource.latitude] },
        properties: { id: resource.id },
      })),
  };
}

export function emptyLineFeatureCollection() {
  return { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };
}

export { SEVERITY_COLOR, RESOURCE_COLOR };
