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

Return STRICT JSON of shape:
{
  "scored": [{"keyword": "...", "score": 7, "reasoning": "..."}],
  "shortlist": ["kw1","kw2","kw3"],
  "patterns": {
    "sentenceStructures": ["..."],
    "emotionalTriggers": ["..."],
    "formatMix": "...",
    "numberUsage": "..."
  }
}

shortlist must contain exactly 3 keywords (the top opportunities).`;

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
      response_format: { type: "json_object" },
    },
    { signal }
  );
  if (tracker && res.usage) tracker.record("Step 5 — Opportunity scoring", MINI_MODEL, res.usage);
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = parseJSON<Partial<ScoringResult>>(raw);
  return {
    scored: Array.isArray(parsed.scored) ? parsed.scored : [],
    shortlist: Array.isArray(parsed.shortlist) ? parsed.shortlist.slice(0, 3) : [],
    patterns: parsed.patterns ?? {
      sentenceStructures: [],
      emotionalTriggers: [],
      formatMix: "",
      numberUsage: "",
    },
  };
}
