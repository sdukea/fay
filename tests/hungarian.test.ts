import { describe, expect, it } from "vitest";
import { solveAssignment } from "@/lib/optimization/hungarian";

describe("solveAssignment", () => {
  it("returns an empty assignment for an empty matrix", () => {
    expect(solveAssignment([])).toEqual([]);
  });

  it("solves a trivial 1x1 case", () => {
    expect(solveAssignment([[5]])).toEqual([0]);
  });

  it("finds the minimum-cost perfect matching on a square matrix", () => {
    // Optimal: row0->col1 (1), row1->col0 (2), row2->col2 (3) = 6
    // Naive greedy-by-row would pick row0->col0 (2) first and do worse overall.
    const matrix = [
      [2, 1, 9],
      [2, 9, 9],
      [9, 9, 3],
    ];
    const result = solveAssignment(matrix);
    const totalCost = result.reduce((sum, col, row) => sum + matrix[row][col], 0);
    expect(totalCost).toBe(6);
    expect(new Set(result).size).toBe(3);
  });

  it("handles more resources (columns) than incidents (rows)", () => {
    const matrix = [
      [4, 1, 8, 8],
      [8, 8, 2, 8],
    ];
    const result = solveAssignment(matrix);
    expect(result).toHaveLength(2);
    const totalCost = result.reduce((sum, col, row) => sum + matrix[row][col], 0);
    expect(totalCost).toBe(3); // row0->col1 (1) + row1->col2 (2)
  });

  it("handles more incidents (rows) than resources (columns) — some rows go unmatched", () => {
    const matrix = [
      [1, 9],
      [9, 1],
      [5, 5],
    ];
    const result = solveAssignment(matrix);
    expect(result).toHaveLength(3);
    const matchedCols = result.filter((c) => c >= 0);
    expect(matchedCols.length).toBeLessThanOrEqual(2);
    expect(new Set(matchedCols).size).toBe(matchedCols.length);
  });

  it("handles negative costs correctly (used when urgency discounts dominate travel cost)", () => {
    const matrix = [
      [-100, -50],
      [-60, -90],
    ];
    const result = solveAssignment(matrix);
    const totalCost = result.reduce((sum, col, row) => sum + matrix[row][col], 0);
    expect(totalCost).toBe(-190); // row0->col0 (-100) + row1->col1 (-90)
  });
});
