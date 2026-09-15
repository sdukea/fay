import { describe, expect, it } from "vitest";
import { INCIDENT_TYPES, casualtiesFor, severityFor, weightedIncidentType } from "@/lib/domain/incidentGenerator";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("weightedIncidentType", () => {
  it("always returns a defined incident type definition", () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const def = weightedIncidentType(rand);
      expect(INCIDENT_TYPES).toContain(def);
    }
  });

  it("favors higher-weight types over many draws", () => {
    const rand = mulberry32(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const def = weightedIncidentType(rand);
      counts[def.type] = (counts[def.type] ?? 0) + 1;
    }
    // MEDICAL (weight 9) should be drawn far more often than HAZMAT (weight 1).
    expect(counts.MEDICAL ?? 0).toBeGreaterThan(counts.HAZMAT ?? 0);
  });
});

describe("severityFor", () => {
  it("only ever returns 1-5", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const s = severityFor(rand, 9);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });

  it("skews severe for rare, low-weight incident types", () => {
    const rand = mulberry32(3);
    let severeCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if (severityFor(rand, 1) >= 4) severeCount++;
    }
    // Rare-type severity distribution guarantees >=3, and rolls 4/5 most of the time.
    expect(severeCount / trials).toBeGreaterThan(0.7);
  });
});

describe("casualtiesFor", () => {
  it("is always non-negative and bounded", () => {
    const rand = mulberry32(11);
    for (let i = 0; i < 300; i++) {
      const severity = 1 + Math.floor(rand() * 5);
      const casualties = casualtiesFor(rand, severity);
      expect(casualties).toBeGreaterThanOrEqual(0);
      expect(casualties).toBeLessThan(6);
    }
  });

  it("produces more casualties on average for severe incidents than minor ones", () => {
    const rand = mulberry32(99);
    let severeTotal = 0;
    let minorTotal = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) severeTotal += casualtiesFor(rand, 5);
    for (let i = 0; i < trials; i++) minorTotal += casualtiesFor(rand, 1);
    expect(severeTotal).toBeGreaterThan(minorTotal);
  });
});
