import type { ResearchInput } from "./types";

const PREFIXES = ["", "why ", "how ", "what ", "is ", "best ", "the truth about "];

function parseSuggestResponse(text: string): string[] {
  // YouTube Suggest returns JSONP-like: window.google.ac.h([ "q", [["sug1",0],["sug2",0]], ...])
  // With client=youtube it returns plain JSON: ["q", [["sug",0,[...]], ...], {...}]
  try {
    const trimmed = text.trim();
    // Strip JSONP wrapper if present
    const match = trimmed.match(/^[^\(]+\((.*)\)\s*;?$/s);
    const json = match ? match[1] : trimmed;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) return [];
    return parsed[1]
      .map((entry: unknown) => {
        if (Array.isArray(entry) && typeof entry[0] === "string") return entry[0];
        if (typeof entry === "string") return entry;
        return null;
      })
      .filter((s: string | null): s is string => !!s);
  } catch {
    return [];
  }
}

async function fetchOne(
  keyword: string,
  input: ResearchInput,
  signal?: AbortSignal
): Promise<string[]> {
  const url =
    `https://suggestqueries.google.com/complete/search` +
    `?client=youtube&ds=yt&hl=${encodeURIComponent(input.languageCode)}` +
    `&gl=${encodeURIComponent(input.countryCode)}&q=${encodeURIComponent(keyword)}`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const text = await r.text();
    return parseSuggestResponse(text);
  } catch {
    return [];
  }
}

export async function step2Suggest(
  keywords: string[],
  input: ResearchInput,
  signal?: AbortSignal
): Promise<{ suggestions: string[]; failedQueries: number; totalQueries: number }> {
  const queries: string[] = [];
  for (const kw of keywords) {
    for (const prefix of PREFIXES) {
      queries.push((prefix + kw).trim());
    }
  }

  // De-dup the queries themselves
  const uniqueQueries = Array.from(new Set(queries));
  // Cap to keep latency sane
  const capped = uniqueQueries.slice(0, 80);

  // Run with limited concurrency (10 at a time)
  const concurrency = 10;
  const results: string[][] = new Array(capped.length);
  let cursor = 0;
  let failures = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= capped.length) break;
        const out = await fetchOne(capped[i], input, signal);
        results[i] = out;
        if (out.length === 0) failures++;
      }
    })
  );

  const flat = results.flat();
  const deduped = Array.from(
    new Set(flat.map((s) => s.toLowerCase().trim()).filter(Boolean))
  );

  return {
    suggestions: deduped,
    failedQueries: failures,
    totalQueries: capped.length,
  };
}
