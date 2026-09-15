import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { applyOptimizationPlan } from "@/lib/server/optimizationRun";

/**
 * Polled by the client while AUTO_DISPATCH mode is active. A no-op (and
 * cheap) when mode is HUMAN_APPROVAL or nothing needs reassignment, so it's
 * safe to call on an interval without racing operator-initiated dispatches.
 */
export async function POST() {
  const state = await prisma.systemState.findUnique({ where: { id: "singleton" } });
  if (state?.dispatchMode !== "AUTO_DISPATCH") {
    return NextResponse.json({ ran: false });
  }

  try {
    const result = await applyOptimizationPlan("AUTO");
    return NextResponse.json({ ran: true, ...result });
  } catch (error) {
    console.error("POST /api/auto-dispatch/tick failed", error);
    return NextResponse.json({ ran: false, error: "Auto-dispatch tick failed" }, { status: 500 });
  }
}
