import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { seedWorld } from "@/lib/server/seedWorld";

export async function POST() {
  try {
    const summary = await seedWorld(prisma);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("POST /api/demo/reset failed", error);
    return NextResponse.json({ error: "Failed to reset demo world" }, { status: 500 });
  }
}
