import { NANO_MODEL, MINI_MODEL } from "../openai";

// Prices per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  [NANO_MODEL]: { input: 0.05, output: 0.40 },
  [MINI_MODEL]: { input: 0.25, output: 2.00 },
};

export type CostEntry = {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type CostSummary = {
  entries: CostEntry[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
};

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
};

export class CostTracker {
  private entries: CostEntry[] = [];

  record(step: string, model: string, usage: OpenAIUsage) {
    const price = PRICING[model] ?? { input: 0, output: 0 };
    const costUsd =
      (usage.prompt_tokens * price.input + usage.completion_tokens * price.output) /
      1_000_000;
    this.entries.push({
      step,
      model,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      costUsd,
    });
  }

  summary(): CostSummary {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    for (const e of this.entries) {
      totalInputTokens += e.inputTokens;
      totalOutputTokens += e.outputTokens;
      totalCostUsd += e.costUsd;
    }
    return { entries: this.entries, totalInputTokens, totalOutputTokens, totalCostUsd };
  }
}
