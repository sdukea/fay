import { NextResponse } from "next/server";
import { answerOperationalQuery } from "@/lib/server/nlQuery";
import { queryRequestSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = queryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A question is required" }, { status: 400 });
  }

  try {
    const answer = await answerOperationalQuery(parsed.data.question);
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("POST /api/query failed", error);
    return NextResponse.json({ answer: "Fay could not process that query right now. Try rephrasing or ask about critical incidents directly." });
  }
}
