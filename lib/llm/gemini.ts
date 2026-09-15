import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExplanationContext, LlmProvider, OperationalQueryContext } from "./types";
import { DeterministicProvider } from "./deterministic";

/**
 * Optional enhancement layer. Never used for dispatch, severity, ETA, or any
 * safety-critical decision — those are always deterministic (see
 * lib/optimization). This provider only rewrites/answers in natural
 * language over numbers the deterministic engine already computed. Any
 * failure falls back to the deterministic provider so the app never breaks
 * on a network or quota error.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;
  private fallback = new DeterministicProvider();

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateExplanation(ctx: ExplanationContext): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
      const deterministic = await this.fallback.generateExplanation(ctx);
      const prompt = `You are an operations copilot for an emergency dispatch system called Fay. Rewrite the following factual dispatch explanation in a clear, confident, control-room tone. Do not invent any numbers or facts beyond what is given. Keep it to 2-3 sentences.\n\nFACTS:\n${deterministic}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return text || deterministic;
    } catch {
      return this.fallback.generateExplanation(ctx);
    }
  }

  async answerOperationalQuery(ctx: OperationalQueryContext): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `You are Fay, an operational copilot for an emergency dispatch command center. Answer the operator's question using ONLY the structured system state below. Do not invent incidents, resources, or numbers that are not present. Be concise and operational, not conversational.\n\nSYSTEM STATE:\n${ctx.systemSummary}\n\nOPERATOR QUESTION:\n${ctx.question}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return text || ctx.systemSummary;
    } catch {
      return this.fallback.answerOperationalQuery(ctx);
    }
  }
}
