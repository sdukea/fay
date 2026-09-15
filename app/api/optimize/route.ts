import { NextResponse } from "next/server";
import { computeOptimizationPreview } from "@/lib/server/optimizationRun";

export async function POST() {
  try {
    const preview = await computeOptimizationPreview();
    const { id, createdAt, baseline, optimized, improvementPct, proposals } = preview;
    return NextResponse.json({ id, createdAt, baseline, optimized, improvementPct, proposals });
  } catch (error) {
    console.error("POST /api/optimize failed", error);
    return NextResponse.json({ error: "Optimization failed" }, { status: 500 });
  }
}
