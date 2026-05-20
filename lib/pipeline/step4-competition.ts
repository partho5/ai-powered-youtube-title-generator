import { NANO_MODEL, openai } from "../openai";
import { parseJSON } from "../jsonparse";
import type {
  CompetitorData,
  CompetitorVideo,
  ResearchInput,
  TrendScore,
} from "./types";

export class QuotaExceededError extends Error {
  constructor() {
    super("YouTube Data API quota exceeded");
    this.name = "QuotaExceededError";
  }
}

async function selectTop6(
  concept: string,
  scores: TrendScore[],
  signal?: AbortSignal
): Promise<string[]> {
  if (scores.length <= 6) return scores.map((s) => s.keyword);
  const res = await openai().chat.completions.create(
    {
      model: NANO_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Pick the 6 keywords most worth investigating for competition. Return strict JSON: {\"picks\": [\"...\"]}",
        },
        {
          role: "user",
          content: `Concept: ${concept}\n\nCandidates with trend signal (null score means trend lookup failed; still consider them):\n${scores
            .map(
              (s) =>
                `- ${s.keyword} (score=${s.score ?? "?"}${
                  s.rising ? ", rising" : ""
                })`
            )
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
    .slice(0, 6);
}

async function ytSearch(
  keyword: string,
  input: ResearchInput,
  apiKey: string,
  signal?: AbortSignal
): Promise<{
  totalResults: number;
  items: { videoId: string; channelId: string; title: string; publishedAt: string }[];
}> {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=5&order=viewCount` +
    `&regionCode=${encodeURIComponent(input.countryCode)}` +
    `&relevanceLanguage=${encodeURIComponent(input.languageCode)}` +
    `&q=${encodeURIComponent(keyword)}&key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { signal });
  if (r.status === 403) {
    const body = await r.text();
    if (body.includes("quotaExceeded") || body.includes("dailyLimitExceeded")) {
      throw new QuotaExceededError();
    }
    throw new Error(`search.list 403: ${body.slice(0, 200)}`);
  }
  if (!r.ok) {
    throw new Error(`search.list HTTP ${r.status}`);
  }
  const j = (await r.json()) as {
    pageInfo?: { totalResults?: number };
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { channelId?: string; title?: string; publishedAt?: string };
    }>;
  };
  return {
    totalResults: j.pageInfo?.totalResults ?? 0,
    items: (j.items ?? [])
      .map((it) => ({
        videoId: it.id?.videoId ?? "",
        channelId: it.snippet?.channelId ?? "",
        title: it.snippet?.title ?? "",
        publishedAt: it.snippet?.publishedAt ?? "",
      }))
      .filter((v) => v.videoId),
  };
}

async function ytVideoStats(
  ids: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=statistics&id=${encodeURIComponent(ids.join(","))}&key=${encodeURIComponent(
      apiKey
    )}`;
  const r = await fetch(url, { signal });
  if (r.status === 403) {
    const body = await r.text();
    if (body.includes("quotaExceeded") || body.includes("dailyLimitExceeded")) {
      throw new QuotaExceededError();
    }
    throw new Error(`videos.list 403: ${body.slice(0, 200)}`);
  }
  if (!r.ok) throw new Error(`videos.list HTTP ${r.status}`);
  const j = (await r.json()) as {
    items?: Array<{ id?: string; statistics?: { viewCount?: string } }>;
  };
  const map = new Map<string, number>();
  for (const it of j.items ?? []) {
    if (it.id && it.statistics?.viewCount) {
      map.set(it.id, parseInt(it.statistics.viewCount, 10) || 0);
    }
  }
  return map;
}

async function ytChannelSubs(
  ids: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, number | null>> {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map();
  const url =
    `https://www.googleapis.com/youtube/v3/channels` +
    `?part=statistics,snippet&id=${encodeURIComponent(
      uniqueIds.join(",")
    )}&key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { signal });
  if (r.status === 403) {
    const body = await r.text();
    if (body.includes("quotaExceeded") || body.includes("dailyLimitExceeded")) {
      throw new QuotaExceededError();
    }
    throw new Error(`channels.list 403: ${body.slice(0, 200)}`);
  }
  if (!r.ok) throw new Error(`channels.list HTTP ${r.status}`);
  const j = (await r.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string };
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
    }>;
  };
  const map = new Map<string, number | null>();
  for (const it of j.items ?? []) {
    if (!it.id) continue;
    if (it.statistics?.hiddenSubscriberCount) {
      map.set(it.id, null);
    } else {
      const n = it.statistics?.subscriberCount
        ? parseInt(it.statistics.subscriberCount, 10)
        : null;
      map.set(it.id, Number.isFinite(n as number) ? (n as number) : null);
    }
  }
  return map;
}

async function ytChannelTitles(
  ids: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map();
  const url =
    `https://www.googleapis.com/youtube/v3/channels` +
    `?part=snippet&id=${encodeURIComponent(uniqueIds.join(","))}&key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { signal });
  if (!r.ok) return new Map();
  const j = (await r.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const map = new Map<string, string>();
  for (const it of j.items ?? []) {
    if (it.id && it.snippet?.title) map.set(it.id, it.snippet.title);
  }
  return map;
}

export async function step4Competition(
  concept: string,
  scores: TrendScore[],
  input: ResearchInput,
  signal?: AbortSignal
): Promise<{ data: CompetitorData[]; selected: string[] } | { skipped: true; reason: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "YOUTUBE_API_KEY not set" };
  }
  const selected = await selectTop6(concept, scores, signal);

  const results: CompetitorData[] = [];
  for (const kw of selected) {
    try {
      const search = await ytSearch(kw, input, apiKey, signal);
      const videoIds = search.items.map((i) => i.videoId);
      const channelIds = search.items.map((i) => i.channelId);
      const [viewMap, subsMap, chanTitles] = await Promise.all([
        ytVideoStats(videoIds, apiKey, signal),
        ytChannelSubs(channelIds, apiKey, signal),
        ytChannelTitles(channelIds, apiKey, signal),
      ]);
      const videos: CompetitorVideo[] = search.items.map((it) => ({
        id: it.videoId,
        title: it.title,
        channelId: it.channelId,
        channelTitle: chanTitles.get(it.channelId) ?? "",
        publishedAt: it.publishedAt,
        viewCount: viewMap.get(it.videoId) ?? 0,
        subscriberCount: subsMap.get(it.channelId) ?? null,
      }));
      results.push({ keyword: kw, totalResults: search.totalResults, videos });
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ keyword: kw, totalResults: 0, videos: [], error: msg });
    }
  }
  return { data: results, selected };
}
