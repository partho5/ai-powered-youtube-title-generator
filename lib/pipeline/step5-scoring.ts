import { MINI_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import type { CostTracker } from "./cost";
import type {
  CompetitorData,
  ResearchInput,
  ScoringResult,
  TrendScore,
} from "./types";

export async function step5Scoring(
  input: ResearchInput,
  trends: TrendScore[],
  competition: CompetitorData[] | null,
  signal?: AbortSignal,
  tracker?: CostTracker
): Promise<ScoringResult> {
  const system = `You are a YouTube content strategist analyzing keyword opportunity for a creator targeting ${input.countryCode} (${input.languageCode}).

Score each keyword 1-10 on opportunity using this logic:
- High views on small/medium channels = high opportunity
- Recent publish dates in top results = topic still growing
- Rising trend score = growing demand
- Low competing video count = underserved
- Large channels dominating (>1M subs) = lower score

Also identify title patterns from top performing videos:
- sentence structure patterns
- emotional trigger words used
- question vs statement format
- number usage patterns

shortlist must contain exactly 3 keywords (the top opportunities). All schema fields are required — if you have nothing to say for a string field use a short summary, never leave it blank.`;

  const compBlock = competition
    ? competition
        .map((c) => {
          if (c.error) return `## ${c.keyword}\n(error: ${c.error})`;
          const vids = c.videos
            .map(
              (v) =>
                `  - "${v.title}" | ${v.viewCount.toLocaleString()} views | ${
                  v.channelTitle
                } (${v.subscriberCount === null ? "?" : v.subscriberCount.toLocaleString()} subs) | published ${v.publishedAt}`
            )
            .join("\n");
          return `## ${c.keyword}\nTotal results: ${c.totalResults.toLocaleString()}\nTop videos:\n${vids}`;
        })
        .join("\n\n")
    : "(competition data unavailable — score based on trends only)";

  const trendsBlock = trends
    .map(
      (t) =>
        `- ${t.keyword} (score=${t.score ?? "?"}${t.rising ? ", rising" : ""}${
          t.error ? ", err=" + t.error : ""
        })`
    )
    .join("\n");

  const user = `Concept: ${input.concept}
Optional instructions: ${input.instructions || "(none)"}

Trend signals:
${trendsBlock}

Competitor data:
${compBlock}

Return strict JSON.`;

  const res = await openai().chat.completions.create(
    {
      model: MINI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "opportunity_scoring",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["scored", "shortlist", "patterns"],
            properties: {
              scored: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["keyword", "score", "reasoning"],
                  properties: {
                    keyword: { type: "string" },
                    score: { type: "number" },
                    reasoning: { type: "string" },
                  },
                },
              },
              shortlist: { type: "array", items: { type: "string" } },
              patterns: {
                type: "object",
                additionalProperties: false,
                required: [
                  "sentenceStructures",
                  "emotionalTriggers",
                  "formatMix",
                  "numberUsage",
                ],
                properties: {
                  sentenceStructures: { type: "array", items: { type: "string" } },
                  emotionalTriggers: { type: "array", items: { type: "string" } },
                  formatMix: { type: "string" },
                  numberUsage: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    { signal }
  );
  if (tracker && res.usage) tracker.record("Step 5 — Opportunity scoring", MINI_MODEL, res.usage);
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = parseJSON<Partial<ScoringResult>>(raw);
  const scored = Array.isArray(parsed.scored)
    ? parsed.scored.filter(
        (s): s is ScoringResult["scored"][number] =>
          !!s && typeof s === "object" && typeof s.keyword === "string"
      )
    : [];
  const shortlist = Array.isArray(parsed.shortlist)
    ? parsed.shortlist.filter((s): s is string => typeof s === "string").slice(0, 3)
    : [];
  const p = (parsed.patterns ?? {}) as Partial<ScoringResult["patterns"]>;
  return {
    scored,
    shortlist,
    patterns: {
      sentenceStructures: Array.isArray(p.sentenceStructures)
        ? p.sentenceStructures.filter((x): x is string => typeof x === "string")
        : [],
      emotionalTriggers: Array.isArray(p.emotionalTriggers)
        ? p.emotionalTriggers.filter((x): x is string => typeof x === "string")
        : [],
      formatMix: typeof p.formatMix === "string" ? p.formatMix : "",
      numberUsage: typeof p.numberUsage === "string" ? p.numberUsage : "",
    },
  };
}
