import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { computeSystemMetrics, getEvents, getHospitals, getIncidents, getResources } from "@/lib/server/state";

export async function GET() {
  try {
    const [incidents, resources, hospitals, events, systemState] = await Promise.all([
      getIncidents(),
      getResources(),
      getHospitals(),
      getEvents(60),
      prisma.systemState.findUnique({ where: { id: "singleton" } }),
    ]);

    const metrics = computeSystemMetrics(incidents, resources);

    return NextResponse.json({
      incidents,
      resources,
      hospitals,
      events,
      metrics,
      dispatchMode: systemState?.dispatchMode ?? "HUMAN_APPROVAL",
      activeScenarioKey: systemState?.activeScenarioKey ?? "NORMAL",
      trafficMultiplier: systemState?.trafficMultiplier ?? 1,
    });
  } catch (error) {
    console.error("GET /api/state failed", error);
    return NextResponse.json(
      { error: "Failed to load system state. The database may be uninitialized — try POST /api/demo/reset." },
      { status: 500 },
    );
  }
}
