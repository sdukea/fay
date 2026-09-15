import { NextResponse } from "next/server";
import { explainIncident } from "@/lib/server/explain";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const explanation = await explainIncident(id);
    return NextResponse.json(explanation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build explanation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
