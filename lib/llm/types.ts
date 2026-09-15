import type { CandidateResource, DecisionDrivers } from "@/types/domain";

export interface ExplanationContext {
  incidentCode: string;
  incidentType: string;
  severity: number;
  casualties: number;
  recommendedResourceCode: string | null;
  etaMinutes: number | null;
  drivers: DecisionDrivers | null;
  candidates: CandidateResource[];
  expectedImpactMinutes: number | null;
}

export interface OperationalQueryContext {
  question: string;
  systemSummary: string;
}

export interface LlmProvider {
  readonly name: string;
  generateExplanation(ctx: ExplanationContext): Promise<string>;
  answerOperationalQuery(ctx: OperationalQueryContext): Promise<string>;
}
