import { prisma } from "@/lib/db/client";
import { priorityScore } from "@/lib/domain/scoring";
import { getLlmProvider } from "@/lib/llm";
import { liveWaitingMinutes } from "./dto";

async function buildSystemSummary(): Promise<string> {
  const incidents = await prisma.incident.findMany({
    where: { status: { not: "RESOLVED" } },
    include: { assignments: { where: { status: "ACTIVE" }, include: { resource: true } } },
  });
  const resources = await prisma.resource.findMany();

  const critical = incidents.filter((i) => i.severity >= 4);
  const available = resources.filter((r) => r.status === "AVAILABLE").length;

  const lines: string[] = [];
  lines.push(`Active incidents: ${incidents.length}. Critical (severity 4-5): ${critical.length}.`);
  lines.push(`Resources: ${resources.length} total, ${available} available, ${resources.filter((r) => r.status === "OFFLINE").length} offline.`);
  lines.push("");
  lines.push("Critical incidents:");
  for (const incident of critical) {
    const assignment = incident.assignments[0];
    const waiting = liveWaitingMinutes(incident);
    lines.push(
      `- ${incident.code} (${incident.type}, severity ${incident.severity}, ${incident.casualties} casualties, waiting ${waiting.toFixed(1)}m): ` +
        (assignment
          ? `assigned ${assignment.resource.code}, ETA ${assignment.etaMinutes}m`
          : `NO RESOURCE ASSIGNED`),
    );
  }
  return lines.join("\n");
}

function tryDeterministicAnswer(question: string, incidents: Array<{ code: string; severity: number; casualties: number; waitingMinutes: number }>): string | null {
  const q = question.toLowerCase();
  const compareMatch = q.match(/why is\s+(inc-\d+)\s+more urgent than\s+(inc-\d+)/i);
  if (compareMatch) {
    const [, codeA, codeB] = compareMatch;
    const a = incidents.find((i) => i.code.toLowerCase() === codeA.toLowerCase());
    const b = incidents.find((i) => i.code.toLowerCase() === codeB.toLowerCase());
    if (a && b) {
      const scoreA = priorityScore({ severity: a.severity, casualties: a.casualties, waitingMinutes: a.waitingMinutes });
      const scoreB = priorityScore({ severity: b.severity, casualties: b.casualties, waitingMinutes: b.waitingMinutes });
      if (scoreA <= scoreB) {
        return `${a.code} is not currently rated more urgent than ${b.code} (urgency ${scoreA} vs ${scoreB}).`;
      }
      return (
        `${a.code} has a higher urgency score (${scoreA} vs ${scoreB}) than ${b.code}. ` +
        `${a.code} is severity ${a.severity}/5 with ${a.casualties} casualties and has waited ${a.waitingMinutes.toFixed(1)} minutes, ` +
        `versus severity ${b.severity}/5, ${b.casualties} casualties, ${b.waitingMinutes.toFixed(1)} minutes waited for ${b.code}.`
      );
    }
  }
  return null;
}

export async function answerOperationalQuery(question: string): Promise<string> {
  const incidents = await prisma.incident.findMany({ where: { status: { not: "RESOLVED" } } });
  const incidentSummaries = incidents.map((i) => ({
    code: i.code,
    severity: i.severity,
    casualties: i.casualties,
    waitingMinutes: liveWaitingMinutes(i),
  }));

  const deterministic = tryDeterministicAnswer(question, incidentSummaries);
  if (deterministic) return deterministic;

  const systemSummary = await buildSystemSummary();
  const llm = getLlmProvider();
  return llm.answerOperationalQuery({ question, systemSummary });
}
