import { MINI_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import type { CostTracker } from "./cost";
import type { FinalTitle, ResearchInput, ScoringResult } from "./types";

export async function step6Titles(
  input: ResearchInput,
  scoring: ScoringResult,
  signal?: AbortSignal,
  tracker?: CostTracker
): Promise<FinalTitle[]> {
  const system = `You write high-CTR YouTube titles for a creator targeting ${input.countryCode} (${input.languageCode}).

Rules:
- 55-65 characters ideal length (count characters precisely)
- No cheap clickbait, but a strong curiosity gap
- Vary the angle across all 5 titles (question, bold statement, numbered list, expose, educational, etc.)
- Match patterns found in high-performing competitor titles
- Each title should feel like it belongs in the top 10 search results for its keyword

Return STRICT JSON: an array of 5 objects:
{ "title": string, "keyword_used": string, "angle": string, "reasoning": string, "opportunity_score": number }

Wrap in an object like {"titles": [...]} if your output requires a root object.`;

  const user = `Original concept: ${input.concept}
User instructions: ${input.instructions || "(none)"}

Top 3 shortlisted keywords: ${scoring.shortlist.join(", ") || "(none)"}

Full scored list (for reference):
${scoring.scored
  .map((s) => `- ${s.keyword} → ${s.score}/10 (${s.reasoning})`)
  .join("\n")}

Title patterns observed in top competitors:
- Sentence structures: ${scoring.patterns.sentenceStructures.join("; ") || "(n/a)"}
- Emotional triggers: ${scoring.patterns.emotionalTriggers.join("; ") || "(n/a)"}
- Format mix: ${scoring.patterns.formatMix || "(n/a)"}
- Number usage: ${scoring.patterns.numberUsage || "(n/a)"}

Generate 5 distinct titles. Return strict JSON.`;

  const res = await openai().chat.completions.create(
    {
      model: MINI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { signal }
  );
  if (tracker && res.usage) tracker.record("Step 6 — Final title generation", MINI_MODEL, res.usage);
  const raw = res.choices[0]?.message?.content ?? "[]";
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
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : null;
      if (!title) return null;
      return {
        title,
        keyword_used: typeof o.keyword_used === "string" ? o.keyword_used : "",
        angle: typeof o.angle === "string" ? o.angle : "",
        reasoning: typeof o.reasoning === "string" ? o.reasoning : "",
        opportunity_score:
          typeof o.opportunity_score === "number" ? o.opportunity_score : 0,
      } as FinalTitle;
    })
    .filter((x): x is FinalTitle => x !== null)
    .slice(0, 5);
}
