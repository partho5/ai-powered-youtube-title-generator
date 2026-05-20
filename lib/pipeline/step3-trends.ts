import { NANO_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import type { ResearchInput, TrendScore } from "./types";

async function selectTopSuggestions(
  concept: string,
  suggestions: string[],
  signal?: AbortSignal
): Promise<string[]> {
  if (suggestions.length <= 10) return suggestions;
  const res = await openai().chat.completions.create(
    {
      model: NANO_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Pick the 10 most search-relevant suggestions for the given concept. Return strict JSON: {\"picks\": [\"...\", \"...\"]}",
        },
        {
          role: "user",
          content: `Concept: ${concept}\n\nCandidate suggestions:\n${suggestions
            .slice(0, 120)
            .map((s, i) => `${i + 1}. ${s}`)
            .join("\n")}`,
        },
      ],
      response_format: { type: "json_object" },
    },
    { signal }
  );
  const raw = res.choices[0]?.message?.content ?? "{}";
  const obj = parseJSON<{ picks?: unknown }>(raw);
  const picks = Array.isArray(obj.picks) ? obj.picks : [];
  return picks
    .filter((x): x is string => typeof x === "string")
    .slice(0, 10);
}

async function fetchTrend(
  keyword: string,
  input: ResearchInput,
  signal?: AbortSignal
): Promise<TrendScore> {
  // Google Trends explore endpoint returns a token, then widget data fetch.
  // Public unauthed flow is brittle and often rate-limits. We attempt a best-effort
  // fetch; on any failure we return null score with the error noted.
  const req = {
    comparisonItem: [
      { keyword, geo: input.countryCode, time: "today 12-m" },
    ],
    category: 0,
    property: "youtube",
  };
  const url =
    `https://trends.google.com/trends/api/explore` +
    `?hl=${encodeURIComponent(input.languageCode)}-${encodeURIComponent(
      input.countryCode
    )}&tz=-300&req=${encodeURIComponent(JSON.stringify(req))}`;
  try {
    const r = await fetch(url, {
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    if (!r.ok) {
      return { keyword, score: null, rising: false, error: `HTTP ${r.status}` };
    }
    const text = await r.text();
    // Trends prefixes JSON with )]}',\n  — strip until first { or [
    const startObj = text.indexOf("{");
    const startArr = text.indexOf("[");
    const start =
      startArr === -1
        ? startObj
        : startObj === -1
          ? startArr
          : Math.min(startObj, startArr);
    if (start < 0) {
      return { keyword, score: null, rising: false, error: "no JSON in response" };
    }
    const json = JSON.parse(text.slice(start));
    // The explore endpoint returns widget metadata, not the actual timeline.
    // A real timeline fetch requires another call with the token. To keep it
    // free + serverless-fast, we use the response presence as a coarse signal
    // and rely on the LLM to weight trends qualitatively.
    const hasWidgets =
      json && Array.isArray(json.widgets) && json.widgets.length > 0;
    return {
      keyword,
      score: hasWidgets ? 50 : null,
      rising: false,
      error: hasWidgets ? undefined : "no widgets in response",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { keyword, score: null, rising: false, error: msg };
  }
}

export async function step3Trends(
  concept: string,
  suggestions: string[],
  input: ResearchInput,
  signal?: AbortSignal
): Promise<{ selected: string[]; scores: TrendScore[] }> {
  const selected = await selectTopSuggestions(concept, suggestions, signal);
  const scores = await Promise.all(
    selected.map((kw) => fetchTrend(kw, input, signal))
  );
  return { selected, scores };
}
