export type ResearchInput = {
  concept: string;
  instructions?: string;
  countryCode: string; // e.g. "US"
  languageCode: string; // e.g. "en"
};

export type Keyword = string;

export type TrendScore = {
  keyword: string;
  score: number | null; // 0-100 typically, null if unknown
  rising: boolean;
  error?: string;
};

export type CompetitorVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  subscriberCount: number | null;
};

export type CompetitorData = {
  keyword: string;
  totalResults: number;
  videos: CompetitorVideo[];
  error?: string;
};

export type ScoredKeyword = {
  keyword: string;
  score: number; // 1-10
  reasoning: string;
};

export type ScoringResult = {
  scored: ScoredKeyword[];
  shortlist: string[];
  patterns: {
    sentenceStructures: string[];
    emotionalTriggers: string[];
    formatMix: string;
    numberUsage: string;
  };
};

export type FinalTitle = {
  title: string;
  keyword_used: string;
  angle: string;
  reasoning: string;
  opportunity_score: number;
};

export type StepName =
  | "keywords"
  | "suggest"
  | "trends"
  | "competition"
  | "scoring"
  | "titles";

export type StepEvent =
  | { kind: "step_start"; step: StepName; label: string }
  | {
      kind: "step_done";
      step: StepName;
      label: string;
      summary: string;
      data: unknown;
      warning?: string;
    }
  | { kind: "step_error"; step: StepName; label: string; error: string }
  | { kind: "final"; titles: FinalTitle[] }
  | { kind: "warning"; message: string }
  | { kind: "cost_summary"; summary: import("./cost").CostSummary }
  | { kind: "done" };
