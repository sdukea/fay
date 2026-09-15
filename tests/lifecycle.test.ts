import { describe, expect, it } from "vitest";
import { ON_SCENE_SECONDS, SPEED_MULTIPLIER, arrivalTimeMs, resolveTimeMs, travelProgress } from "@/lib/domain/lifecycle";

describe("lifecycle timing", () => {
  const dispatchedAt = 1_000_000;

  it("computes arrival strictly after dispatch, scaled by the speed multiplier", () => {
    const etaMinutes = 5;
    const arrival = arrivalTimeMs(dispatchedAt, etaMinutes);
    const expectedDelta = (etaMinutes * 60 * 1000) / SPEED_MULTIPLIER;
    expect(arrival).toBe(dispatchedAt + expectedDelta);
    expect(arrival).toBeGreaterThan(dispatchedAt);
  });

  it("resolves strictly after arrival by the fixed on-scene dwell", () => {
    const etaMinutes = 3;
    const arrival = arrivalTimeMs(dispatchedAt, etaMinutes);
    const resolve = resolveTimeMs(dispatchedAt, etaMinutes);
    expect(resolve).toBe(arrival + ON_SCENE_SECONDS * 1000);
  });

  it("travel progress is 0 at dispatch and 1 at/after arrival", () => {
    const etaMinutes = 4;
    const arrival = arrivalTimeMs(dispatchedAt, etaMinutes);
    expect(travelProgress(dispatchedAt, etaMinutes, dispatchedAt)).toBe(0);
    expect(travelProgress(dispatchedAt, etaMinutes, arrival)).toBe(1);
    expect(travelProgress(dispatchedAt, etaMinutes, arrival + 60_000)).toBe(1); // never exceeds 1
  });

  it("travel progress is monotonically increasing between dispatch and arrival", () => {
    const etaMinutes = 6;
    const arrival = arrivalTimeMs(dispatchedAt, etaMinutes);
    const mid = dispatchedAt + (arrival - dispatchedAt) / 2;
    const quarter = dispatchedAt + (arrival - dispatchedAt) / 4;
    expect(travelProgress(dispatchedAt, etaMinutes, quarter)).toBeLessThan(travelProgress(dispatchedAt, etaMinutes, mid));
    expect(travelProgress(dispatchedAt, etaMinutes, mid)).toBeLessThan(1);
  });

  it("never returns a progress below 0 even for a timestamp before dispatch", () => {
    expect(travelProgress(dispatchedAt, 5, dispatchedAt - 10_000)).toBe(0);
  });

  it("treats a zero-minute ETA as already arrived", () => {
    expect(travelProgress(dispatchedAt, 0, dispatchedAt)).toBe(1);
  });
});
