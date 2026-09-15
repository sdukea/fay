import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { dispatchModeSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = dispatchModeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dispatch mode" }, { status: 400 });
  }

  await prisma.systemState.upsert({
    where: { id: "singleton" },
    update: { dispatchMode: parsed.data.mode },
    create: { id: "singleton", dispatchMode: parsed.data.mode },
  });

  return NextResponse.json({ ok: true, mode: parsed.data.mode });
}
