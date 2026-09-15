import { prisma } from "@/lib/db/client";
import { haversineKm, etaMinutes } from "@/lib/domain/geo";
import { assignmentCost, compatibility } from "@/lib/domain/scoring";
import { getLlmProvider } from "@/lib/llm";
import { liveWaitingMinutes } from "./dto";
import type { CandidateResource, DecisionExplanation } from "@/types/domain";

export async function explainIncident(incidentId: string): Promise<DecisionExplanation> {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const resources = await prisma.resource.findMany({
    where: { status: { not: "OFFLINE" } },
    include: { currentAssignment: true },
  });
  const hospitals = await prisma.hospital.findMany();

  const waitingMinutes = liveWaitingMinutes(incident);
  const nearestHospital = incident.hospitalRequired
    ? [...hospitals].sort((a, b) => haversineKm(incident, a) - haversineKm(incident, b))[0]
    : undefined;
  const hospitalAvailable = nearestHospital ? nearestHospital.currentLoad < nearestHospital.capacity : true;

  const candidates: CandidateResource[] = resources
    .map((resource) => {
      const distanceKm = haversineKm(incident, resource);
      const eta = etaMinutes(distanceKm);
      const compat = compatibility(incident.type, resource.type);
      // A resource already committed to THIS incident isn't "extra" load for this pairing.
      const effectiveLoad = resource.currentAssignment && resource.currentAssignment.incidentId !== incident.id ? 1 : 0;
      const cost = assignmentCost({
        severity: incident.severity,
        casualties: incident.casualties,
        waitingMinutes,
        etaMinutes: eta,
        compatibilityScore: compat,
        hospitalRequired: incident.hospitalRequired,
        hospitalAvailable,
        resourceCurrentLoad: effectiveLoad,
      });
      return {
        resourceId: resource.id,
        resourceCode: resource.code,
        resourceType: resource.type,
        etaMinutes: eta,
        distanceKm: Math.round(distanceKm * 100) / 100,
        compatible: compat > 0,
        currentWorkload: resource.currentAssignmentId ? 1 : 0,
        cost,
        isRecommended: false,
      };
    })
    .filter((c) => c.compatible)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 15);

  if (candidates.length > 0) candidates[0].isRecommended = true;
  const recommended = candidates[0];

  const drivers = recommended
    ? {
        severity: incident.severity,
        casualties: incident.casualties,
        waitMinutes: Math.round(waitingMinutes * 10) / 10,
        distanceKm: recommended.distanceKm,
        compatibilityPct: Math.round(compatibility(incident.type, resources.find((r) => r.id === recommended.resourceId)!.type) * 100),
        hospitalAvailable,
      }
    : null;

  const llm = getLlmProvider();
  const narrative = await llm.generateExplanation({
    incidentCode: incident.code,
    incidentType: incident.type,
    severity: incident.severity,
    casualties: incident.casualties,
    recommendedResourceCode: recommended?.resourceCode ?? null,
    etaMinutes: recommended?.etaMinutes ?? null,
    drivers,
    candidates,
    expectedImpactMinutes: null,
  });

  return {
    incidentId: incident.id,
    incidentCode: incident.code,
    recommendedResourceCode: recommended?.resourceCode ?? null,
    etaMinutes: recommended?.etaMinutes ?? null,
    drivers,
    expectedImpactMinutes: null,
    narrative,
    candidates,
  };
}
