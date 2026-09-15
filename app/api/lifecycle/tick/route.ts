import { NextResponse } from "next/server";
import { runLifecycleTick } from "@/lib/server/lifecycle";

export async function POST() {
  try {
    const result = await runLifecycleTick();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/lifecycle/tick failed", error);
    return NextResponse.json({ arrived: [], returnedToService: [] }, { status: 500 });
  }
}
