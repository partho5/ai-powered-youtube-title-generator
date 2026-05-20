import { step1Keywords } from "./step1-keywords";
import { step2Suggest } from "./step2-suggest";
import { step3Trends } from "./step3-trends";
import { QuotaExceededError, step4Competition } from "./step4-competition";
import { step5Scoring } from "./step5-scoring";
import { step6Titles } from "./step6-titles";
import { CostTracker } from "./cost";
import type { ResearchInput, StepEvent } from "./types";

export async function* runPipeline(
  input: ResearchInput,
  signal: AbortSignal
): AsyncGenerator<StepEvent> {
  const tracker = new CostTracker();
  // --- Step 1
  yield { kind: "step_start", step: "keywords", label: "Step 1 — Keyword expansion" };
  let keywords: string[] = [];
  try {
    keywords = await step1Keywords(input, signal, tracker);
    if (keywords.length === 0) throw new Error("model returned 0 keywords");
    yield {
      kind: "step_done",
      step: "keywords",
      label: "Step 1 — Keyword expansion",
      summary: `Generated ${keywords.length} keywords`,
      data: { keywords },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      kind: "step_error",
      step: "keywords",
      label: "Step 1 — Keyword expansion",
      error: msg,
    };
    yield { kind: "cost_summary", summary: tracker.summary() };
    return;
  }

  // --- Step 2
  yield { kind: "step_start", step: "suggest", label: "Step 2 — YouTube Autocomplete" };
  let suggestions: string[] = [];
  let suggestWarn: string | undefined;
  try {
    const r = await step2Suggest(keywords, input, signal);
    suggestions = r.suggestions;
    if (r.failedQueries > 0) {
      suggestWarn = `${r.failedQueries}/${r.totalQueries} autocomplete queries returned no data`;
    }
    if (suggestions.length === 0) {
      yield {
        kind: "step_error",
        step: "suggest",
        label: "Step 2 — YouTube Autocomplete",
        error: "no suggestions collected",
      };
      yield { kind: "cost_summary", summary: tracker.summary() };
      return;
    }
    yield {
      kind: "step_done",
      step: "suggest",
      label: "Step 2 — YouTube Autocomplete",
      summary: `Collected ${suggestions.length} unique suggestions`,
      data: r,
      warning: suggestWarn,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      kind: "step_error",
      step: "suggest",
      label: "Step 2 — YouTube Autocomplete",
      error: msg,
    };
    yield { kind: "cost_summary", summary: tracker.summary() };
    return;
  }

  // --- Step 3
  yield { kind: "step_start", step: "trends", label: "Step 3 — Google Trends validation" };
  let trendsOut: Awaited<ReturnType<typeof step3Trends>> = {
    selected: [],
    scores: [],
  };
  try {
    trendsOut = await step3Trends(input.concept, suggestions, input, signal);
    const ok = trendsOut.scores.filter((s) => s.score !== null).length;
    const warn =
      ok === 0
        ? "Trends API returned no data for any keyword (Google often rate-limits unauthed calls). Continuing with autocomplete + competition only."
        : ok < trendsOut.scores.length
          ? `${trendsOut.scores.length - ok}/${trendsOut.scores.length} trend lookups failed`
          : undefined;
    yield {
      kind: "step_done",
      step: "trends",
      label: "Step 3 — Google Trends validation",
      summary: `Validated ${trendsOut.selected.length} candidates (${ok} with trend data)`,
      data: trendsOut,
      warning: warn,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      kind: "step_done",
      step: "trends",
      label: "Step 3 — Google Trends validation",
      summary: "Trend lookup failed — continuing",
      data: { selected: suggestions.slice(0, 10), scores: [] },
      warning: msg,
    };
    // Fall through with empty trends; downstream will treat as null
    trendsOut = {
      selected: suggestions.slice(0, 10),
      scores: suggestions.slice(0, 10).map((kw) => ({
        keyword: kw,
        score: null,
        rising: false,
      })),
    };
  }

  // --- Step 4
  yield {
    kind: "step_start",
    step: "competition",
    label: "Step 4 — Competition (YouTube Data API)",
  };
  let competition: Awaited<ReturnType<typeof step4Competition>> | null = null;
  try {
    competition = await step4Competition(
      input.concept,
      trendsOut.scores,
      input,
      signal
    );
    if ("skipped" in competition) {
      yield {
        kind: "step_done",
        step: "competition",
        label: "Step 4 — Competition (YouTube Data API)",
        summary: "Skipped",
        data: competition,
        warning: competition.reason,
      };
    } else {
      yield {
        kind: "step_done",
        step: "competition",
        label: "Step 4 — Competition (YouTube Data API)",
        summary: `Analyzed ${competition.data.length} keywords`,
        data: competition,
      };
    }
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      yield {
        kind: "step_done",
        step: "competition",
        label: "Step 4 — Competition (YouTube Data API)",
        summary: "Skipped (quota exceeded)",
        data: { skipped: true, reason: "YouTube Data API quota exceeded" },
        warning:
          "YouTube Data API quota exhausted. Proceeding with autocomplete + trends only.",
      };
      competition = { skipped: true, reason: "quota exceeded" };
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      yield {
        kind: "step_done",
        step: "competition",
        label: "Step 4 — Competition (YouTube Data API)",
        summary: "Skipped (error)",
        data: { skipped: true, reason: msg },
        warning: msg,
      };
      competition = { skipped: true, reason: msg };
    }
  }

  // --- Step 5
  yield {
    kind: "step_start",
    step: "scoring",
    label: "Step 5 — Opportunity scoring",
  };
  const compData =
    competition && "data" in competition ? competition.data : null;
  let scoring: Awaited<ReturnType<typeof step5Scoring>>;
  try {
    scoring = await step5Scoring(input, trendsOut.scores, compData, signal, tracker);
    yield {
      kind: "step_done",
      step: "scoring",
      label: "Step 5 — Opportunity scoring",
      summary: `Top 3: ${scoring.shortlist.join(", ") || "(none)"}`,
      data: scoring,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      kind: "step_error",
      step: "scoring",
      label: "Step 5 — Opportunity scoring",
      error: msg,
    };
    yield { kind: "cost_summary", summary: tracker.summary() };
    return;
  }

  // --- Step 6
  yield {
    kind: "step_start",
    step: "titles",
    label: "Step 6 — Final title generation",
  };
  try {
    const titles = await step6Titles(input, scoring, signal, tracker);
    yield {
      kind: "step_done",
      step: "titles",
      label: "Step 6 — Final title generation",
      summary: `Generated ${titles.length} titles`,
      data: { titles },
    };
    yield { kind: "final", titles };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    yield {
      kind: "step_error",
      step: "titles",
      label: "Step 6 — Final title generation",
      error: msg,
    };
    yield { kind: "cost_summary", summary: tracker.summary() };
    return;
  }

  yield { kind: "cost_summary", summary: tracker.summary() };
  yield { kind: "done" };
}
