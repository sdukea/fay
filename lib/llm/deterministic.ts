import type { ExplanationContext, LlmProvider, OperationalQueryContext } from "./types";

/**
 * Always-available fallback provider. Produces the same class of explanation
 * an LLM would, built directly from the optimization inputs — no network
 * call, no cost, no risk of the demo depending on an API key.
 */
export class DeterministicProvider implements LlmProvider {
  readonly name = "deterministic";

  async generateExplanation(ctx: ExplanationContext): Promise<string> {
    if (!ctx.recommendedResourceCode || !ctx.drivers) {
      return `No compatible available resource currently exists for ${ctx.incidentCode}. Fay will reassign automatically once a unit frees up or becomes available.`;
    }

    const { drivers, recommendedResourceCode, etaMinutes, expectedImpactMinutes } = ctx;
    const parts: string[] = [];
    parts.push(
      `${recommendedResourceCode} was selected for ${ctx.incidentCode} because it offers the strongest ` +
        `combination of urgency coverage and travel time among ${ctx.candidates.length} candidate resource${ctx.candidates.length === 1 ? "" : "s"}.`,
    );
    parts.push(
      `The incident is severity ${drivers.severity}/5${drivers.casualties > 0 ? ` with ${drivers.casualties} casualties` : ""} and has been waiting ${formatMinutes(drivers.waitMinutes)}.`,
    );
    parts.push(
      `${recommendedResourceCode} is ${drivers.compatibilityPct}% compatible with this incident type and is ${drivers.distanceKm.toFixed(1)} km away, giving an estimated arrival in ${etaMinutes ?? "?"} minutes.`,
    );
    if (drivers.hospitalAvailable === false) {
      parts.push(`Note: the nearest hospital is near capacity, which may affect transport time.`);
    }
    if (expectedImpactMinutes && expectedImpactMinutes > 0.05) {
      parts.push(`Applying this assignment is expected to improve weighted response time by ${expectedImpactMinutes.toFixed(1)} minutes.`);
    }
    return parts.join(" ");
  }

  async answerOperationalQuery(ctx: OperationalQueryContext): Promise<string> {
    return ctx.systemSummary;
  }
}

function formatMinutes(m: number): string {
  const mins = Math.floor(m);
  const secs = Math.round((m - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
