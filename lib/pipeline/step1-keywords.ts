import { NANO_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import { logError } from "../log";
import type { CostTracker } from "./cost";
import type { ResearchInput } from "./types";

export async function step1Keywords(
  input: ResearchInput,
  signal?: AbortSignal,
  tracker?: CostTracker
): Promise<string[]> {
  const system = `You expand a raw video concept into realistic YouTube search queries that an actual person in ${input.countryCode} (language: ${input.languageCode}) would type.

Output: a JSON object with a single key "keywords" whose value is an array of EXACTLY 8 to 10 short keyword strings (2-6 words each, no numbering, no prose, no duplicates).`;

  const user = `Raw concept: ${input.concept}

Optional user instructions: ${input.instructions || "(none)"}

Generate 8-10 keyword variations that capture different angles, intents (informational, comparison, how-to, opinion), and natural phrasings. Keep them short (2-6 words). Avoid duplicates.`;

  const res = await openai().chat.completions.create(
    {
      model: NANO_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "keyword_expansion",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["keywords"],
            properties: {
              keywords: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    { signal }
  );

  if (tracker && res.usage) tracker.record("Step 1 — Keyword expansion", NANO_MODEL, res.usage);
  const raw = res.choices[0]?.message?.content ?? "{}";
  const finishReason = res.choices[0]?.finish_reason;
  const refusal = (res.choices[0]?.message as { refusal?: string | null } | undefined)?.refusal ?? null;
  // strict json_schema guarantees the shape, but parse defensively in case of refusal/length-truncation.
  let parsed: unknown = null;
  let parseError: string | undefined;
  try {
    parsed = parseJSON<unknown>(raw);
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  let arr: unknown[] = [];
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.keywords)) arr = obj.keywords;
    else {
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) {
          arr = v;
          break;
        }
      }
    }
  } else if (Array.isArray(parsed)) {
    arr = parsed;
  }
  const result = Array.from(
    new Set(
      arr
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);

  if (result.length === 0) {
    logError({
      step: "keywords",
      message: "step1 produced 0 keywords",
      details: {
        model: NANO_MODEL,
        concept: input.concept,
        instructions: input.instructions,
        countryCode: input.countryCode,
        languageCode: input.languageCode,
        finishReason,
        refusal,
        parseError,
        parsedShape: parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed,
        rawArrayLength: arr.length,
        rawResponse: raw,
        usage: res.usage,
      },
    });
  }

  return result;
}
