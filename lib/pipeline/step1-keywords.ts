import { NANO_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import type { CostTracker } from "./cost";
import type { ResearchInput } from "./types";

export async function step1Keywords(
  input: ResearchInput,
  signal?: AbortSignal,
  tracker?: CostTracker
): Promise<string[]> {
  const system = `You expand a raw video concept into realistic YouTube search queries that an actual person in ${input.countryCode} (language: ${input.languageCode}) would type.

Return STRICT JSON only: an array of 8-10 short keyword strings (no numbering, no prose).`;

  const user = `Raw concept: ${input.concept}

Optional user instructions: ${input.instructions || "(none)"}

Generate 8-10 keyword variations that capture different angles, intents (informational, comparison, how-to, opinion), and natural phrasings. Keep them short (2-6 words). Avoid duplicates.

Return strict JSON array of strings.`;

  const res = await openai().chat.completions.create(
    {
      model: NANO_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { signal }
  );

  if (tracker && res.usage) tracker.record("Step 1 — Keyword expansion", NANO_MODEL, res.usage);
  const raw = res.choices[0]?.message?.content ?? "[]";
  // The model may return { keywords: [...] } when forced to json_object.
  // Handle both shapes.
  const parsed = parseJSON<unknown>(raw);
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) {
        arr = v;
        break;
      }
    }
  }
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}
