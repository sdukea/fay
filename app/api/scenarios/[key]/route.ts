import { NextResponse } from "next/server";
import { runScenario } from "@/lib/simulation/scenarios";
import { scenarioParamSchema } from "@/lib/server/validation";

export async function POST(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const parsed = scenarioParamSchema.safeParse({ key });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown scenario key" }, { status: 400 });
  }

  try {
    const result = await runScenario(parsed.data.key);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(`POST /api/scenarios/${key} failed`, error);
    return NextResponse.json({ error: "Scenario failed to run" }, { status: 500 });
  }
}
