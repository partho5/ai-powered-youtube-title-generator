import { NANO_MODEL, MINI_MODEL } from "../openai";

// Prices per 1M tokens (USD)
const PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  [NANO_MODEL]: { input: 0.05, cachedInput: 0.005, output: 0.40 },
  [MINI_MODEL]: { input: 0.25, cachedInput: 0.025, output: 2.00 },
};

export type CostEntry = {
  step: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type CostSummary = {
  entries: CostEntry[];
  totalInputTokens: number;
  totalCachedInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
};

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

export class CostTracker {
  private entries: CostEntry[] = [];

  record(step: string, model: string, usage: OpenAIUsage) {
    const price = PRICING[model] ?? { input: 0, cachedInput: 0, output: 0 };
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    const nonCached = usage.prompt_tokens - cached;
    const costUsd =
      (nonCached * price.input + cached * price.cachedInput + usage.completion_tokens * price.output) /
      1_000_000;
    this.entries.push({
      step,
      model,
      inputTokens: nonCached,
      cachedInputTokens: cached,
      outputTokens: usage.completion_tokens,
      costUsd,
    });
  }

  summary(): CostSummary {
    let totalInputTokens = 0;
    let totalCachedInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    for (const e of this.entries) {
      totalInputTokens += e.inputTokens;
      totalCachedInputTokens += e.cachedInputTokens;
      totalOutputTokens += e.outputTokens;
      totalCostUsd += e.costUsd;
    }
    return { entries: this.entries, totalInputTokens, totalCachedInputTokens, totalOutputTokens, totalCostUsd };
  }
}
