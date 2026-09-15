import { NextResponse } from "next/server";
import { runIncidentStreamTick } from "@/lib/server/incidentStream";

export async function POST() {
  try {
    const result = await runIncidentStreamTick();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/incidents/tick failed", error);
    return NextResponse.json({ created: [] }, { status: 500 });
  }
}
