import { NextResponse } from "next/server";
import { resolveIncident } from "@/lib/server/dispatch";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await resolveIncident(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve incident";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
