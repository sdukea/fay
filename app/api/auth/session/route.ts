import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/server/auth";

export async function GET() {
  const operator = await getSessionOperator();
  return NextResponse.json({ operator });
}
