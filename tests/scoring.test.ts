import { describe, expect, it } from "vitest";
import { assignmentCost, compatibility, priorityScore } from "@/lib/domain/scoring";

describe("priorityScore", () => {
  it("ranks a severity-5 mass casualty incident above a severity-2 minor one", () => {
    const critical = priorityScore({ severity: 5, casualties: 8, waitingMinutes: 5 });
    const minor = priorityScore({ severity: 2, casualties: 0, waitingMinutes: 5 });
    expect(critical).toBeGreaterThan(minor);
  });

  it("increases monotonically with waiting time, all else equal", () => {
    const early = priorityScore({ severity: 3, casualties: 1, waitingMinutes: 2 });
    const late = priorityScore({ severity: 3, casualties: 1, waitingMinutes: 20 });
    expect(late).toBeGreaterThan(early);
  });

  it("caps the wait-time contribution so an abandoned incident doesn't dominate forever", () => {
    const at60 = priorityScore({ severity: 1, casualties: 0, waitingMinutes: 60 });
    const at600 = priorityScore({ severity: 1, casualties: 0, waitingMinutes: 600 });
    expect(at600).toBe(at60);
  });
});

describe("compatibility", () => {
  it("is fully compatible for the canonical incident/resource pairing", () => {
    expect(compatibility("FIRE", "FIRE_ENGINE")).toBe(1);
    expect(compatibility("MEDICAL", "AMBULANCE")).toBe(1);
  });

  it("is zero for a nonsensical pairing", () => {
    expect(compatibility("FIRE", "POLICE")).toBe(0);
  });
});

describe("assignmentCost", () => {
  const base = {
    severity: 5,
    casualties: 8,
    waitingMinutes: 20,
    hospitalRequired: true,
    hospitalAvailable: true,
    resourceCurrentLoad: 0,
  };

  it("is astronomically high for an incompatible resource regardless of distance", () => {
    const cost = assignmentCost({ ...base, etaMinutes: 1, compatibilityScore: 0 });
    expect(cost).toBeGreaterThan(100_000);
  });

  it("prefers a closer compatible resource over a farther one for the SAME incident", () => {
    const near = assignmentCost({ ...base, etaMinutes: 3, compatibilityScore: 1 });
    const far = assignmentCost({ ...base, etaMinutes: 25, compatibilityScore: 1 });
    expect(near).toBeLessThan(far);
  });

  it("never floors distinct candidates to the same cost (regression: urgency discount collapsing ranking)", () => {
    // A prior bug clamped cost to a fixed floor once the urgency discount pushed it
    // negative, making every reasonably-compatible candidate compare equal and
    // collapsing the ranking to array order instead of actual travel time.
    const near = assignmentCost({ ...base, etaMinutes: 4, compatibilityScore: 1 });
    const mid = assignmentCost({ ...base, etaMinutes: 12, compatibilityScore: 1 });
    const far = assignmentCost({ ...base, etaMinutes: 30, compatibilityScore: 1 });
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
  });

  it("penalizes a resource already committed elsewhere over an equally-placed idle one", () => {
    const idle = assignmentCost({ ...base, etaMinutes: 10, compatibilityScore: 1, resourceCurrentLoad: 0 });
    const busy = assignmentCost({ ...base, etaMinutes: 10, compatibilityScore: 1, resourceCurrentLoad: 1 });
    expect(busy).toBeGreaterThan(idle);
  });

  it("penalizes an unavailable hospital when one is required", () => {
    const available = assignmentCost({ ...base, etaMinutes: 10, compatibilityScore: 1, hospitalAvailable: true });
    const constrained = assignmentCost({ ...base, etaMinutes: 10, compatibilityScore: 1, hospitalAvailable: false });
    expect(constrained).toBeGreaterThan(available);
  });

  it("assigns a lower absolute cost to a more urgent incident, all else equal (drives global reallocation toward it)", () => {
    const critical = assignmentCost({ ...base, severity: 5, casualties: 10, etaMinutes: 10, compatibilityScore: 1 });
    const routine = assignmentCost({ ...base, severity: 1, casualties: 0, etaMinutes: 10, compatibilityScore: 1 });
    expect(critical).toBeLessThan(routine);
  });
});
