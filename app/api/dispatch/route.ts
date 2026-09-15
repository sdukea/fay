import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/server/auth";
import { dispatchResource } from "@/lib/server/dispatch";
import { dispatchRequestSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = dispatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const operator = await getSessionOperator();
    const assignment = await dispatchResource({ ...parsed.data, operatorName: operator?.name });
    return NextResponse.json({ assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
