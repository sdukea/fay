import { NextResponse } from "next/server";
import { applyOptimizationPlan } from "@/lib/server/optimizationRun";

export async function POST() {
  try {
    const result = await applyOptimizationPlan("OPERATOR");
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/optimize/apply failed", error);
    return NextResponse.json({ error: "Failed to apply optimization plan" }, { status: 500 });
  }
}
