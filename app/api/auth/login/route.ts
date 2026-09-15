import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/auth";
import { loginRequestSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid name" }, { status: 400 });
  }

  const operator = await createSession(parsed.data.name, parsed.data.role);
  return NextResponse.json({ operator });
}
