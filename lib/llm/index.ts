import { DeterministicProvider } from "./deterministic";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

let cached: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  cached = apiKey ? new GeminiProvider(apiKey) : new DeterministicProvider();
  return cached;
}

export type { LlmProvider, ExplanationContext, OperationalQueryContext } from "./types";
