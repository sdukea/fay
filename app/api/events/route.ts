import { NextResponse } from "next/server";
import { getEvents } from "@/lib/server/state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  try {
    const events = await getEvents(limit);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events failed", error);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
