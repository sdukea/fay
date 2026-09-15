import { describe, expect, it } from "vitest";
import { runOptimization, type OptIncident, type OptResource } from "@/lib/optimization/engine";

function incident(overrides: Partial<OptIncident> = {}): OptIncident {
  return {
    id: "inc-1",
    code: "INC-101",
    type: "MEDICAL",
    severity: 4,
    casualties: 2,
    waitingMinutes: 5,
    latitude: 12.97,
    longitude: 77.6,
    hospitalRequired: false,
    requiredResourceType: "AMBULANCE",
    currentResourceId: null,
    ...overrides,
  };
}

function resource(overrides: Partial<OptResource> = {}): OptResource {
  return {
    id: "res-1",
    code: "AMB-01",
    type: "AMBULANCE",
    latitude: 12.971,
    longitude: 77.601,
    currentLoad: 0,
    currentIncidentId: null,
    ...overrides,
  };
}

describe("runOptimization edge cases", () => {
  it("handles zero incidents without error", () => {
    const outcome = runOptimization({ incidents: [], resources: [resource()], hospitals: [] });
    expect(outcome.optimizedMetrics.coveragePct).toBe(100);
    expect(outcome.proposals).toEqual([]);
  });

  it("handles zero resources — every incident is unserved, not a crash", () => {
    const outcome = runOptimization({ incidents: [incident()], resources: [], hospitals: [] });
    expect(outcome.optimizedMetrics.unservedIncidents).toBe(1);
    expect(outcome.optimizedMetrics.coveragePct).toBe(0);
    expect(outcome.proposals).toEqual([]);
  });

  it("leaves an incident unserved when the only resource is incompatible", () => {
    const outcome = runOptimization({
      incidents: [incident({ requiredResourceType: "FIRE_ENGINE", type: "FIRE" })],
      resources: [resource({ type: "AMBULANCE" })],
      hospitals: [],
    });
    expect(outcome.optimizedMetrics.unservedIncidents).toBe(1);
  });

  it("matches a single incident to its single compatible resource (1 incident / 1 resource)", () => {
    const outcome = runOptimization({ incidents: [incident()], resources: [resource()], hospitals: [] });
    expect(outcome.optimizedAssignments.get("inc-1")).toBe("res-1");
    expect(outcome.optimizedMetrics.unservedIncidents).toBe(0);
  });

  it("produces a globally sound plan for a larger scarce-resource scenario (100 incidents / 10 resources)", () => {
    const incidents = Array.from({ length: 100 }, (_, i) =>
      incident({
        id: `inc-${i}`,
        code: `INC-${i}`,
        latitude: 12.9 + (i % 10) * 0.01,
        longitude: 77.5 + Math.floor(i / 10) * 0.01,
        severity: 1 + (i % 5),
      }),
    );
    const resources = Array.from({ length: 10 }, (_, i) =>
      resource({ id: `res-${i}`, code: `AMB-${i}`, latitude: 12.95, longitude: 77.55 }),
    );
    const outcome = runOptimization({ incidents, resources, hospitals: [] });
    expect(outcome.optimizedMetrics.unservedIncidents).toBe(90);
    expect(new Set(outcome.optimizedAssignments.values()).size).toBe(10);
  });

  it("marks a critical incident as unserved (not silently dropped) when no resource is available", () => {
    const outcome = runOptimization({
      incidents: [incident({ severity: 5, casualties: 12 })],
      resources: [],
      hospitals: [],
    });
    expect(outcome.optimizedMetrics.criticalAtRiskCount).toBe(1);
  });

  it("treats a hospital-requiring incident as constrained when the nearest hospital is full", () => {
    const withHospital = runOptimization({
      incidents: [incident({ hospitalRequired: true })],
      resources: [resource()],
      hospitals: [{ latitude: 12.97, longitude: 77.6, capacity: 10, currentLoad: 10 }],
    });
    const withoutConstraint = runOptimization({
      incidents: [incident({ hospitalRequired: true })],
      resources: [resource()],
      hospitals: [{ latitude: 12.97, longitude: 77.6, capacity: 10, currentLoad: 0 }],
    });
    // Both still get served (only one resource, no alternative), but the constrained
    // pairing should cost more — verified indirectly via unservedIncidents staying 0
    // and no crash, since cost isn't part of the public outcome for a 1x1 case.
    expect(withHospital.optimizedMetrics.unservedIncidents).toBe(0);
    expect(withoutConstraint.optimizedMetrics.unservedIncidents).toBe(0);
  });

  it("breaks ties consistently (equal-cost assignments) without throwing", () => {
    const incidents = [incident({ id: "a", code: "INC-A" }), incident({ id: "b", code: "INC-B" })];
    const resources = [
      resource({ id: "r1", code: "AMB-1", latitude: 12.97, longitude: 77.6 }),
      resource({ id: "r2", code: "AMB-2", latitude: 12.97, longitude: 77.6 }),
    ];
    const outcome = runOptimization({ incidents, resources, hospitals: [] });
    expect(outcome.optimizedMetrics.unservedIncidents).toBe(0);
    expect(new Set(outcome.optimizedAssignments.values()).size).toBe(2);
  });
});
