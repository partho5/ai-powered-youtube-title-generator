"use client";

import { useEffect, useRef, useState } from "react";
import type { Country } from "@/lib/countries";
import type { FinalTitle, StepEvent, StepName } from "@/lib/pipeline/types";
import type { CostSummary } from "@/lib/pipeline/cost";
import StepCard from "./StepCard";
import TitleCard from "./TitleCard";

type Props = { countries: Country[] };

type StepUI = {
  name: StepName;
  label: string;
  status: "pending" | "running" | "done" | "error";
  summary?: string;
  warning?: string;
  error?: string;
  data?: unknown;
};

const INITIAL_STEPS: StepUI[] = [
  { name: "keywords", label: "Step 1 — Keyword expansion", status: "pending" },
  { name: "suggest", label: "Step 2 — YouTube Autocomplete", status: "pending" },
  { name: "trends", label: "Step 3 — Google Trends validation", status: "pending" },
  { name: "competition", label: "Step 4 — Competition (YouTube Data API)", status: "pending" },
  { name: "scoring", label: "Step 5 — Opportunity scoring", status: "pending" },
  { name: "titles", label: "Step 6 — Final title generation", status: "pending" },
];

const AUTH_KEY = "ytkr-access-code";

export default function ResearchForm({ countries }: Props) {
  const [concept, setConcept] = useState("");
  const [instructions, setInstructions] = useState("");
  const [country, setCountry] = useState(countries[0]?.code ?? "US");
  const [language, setLanguage] = useState(countries[0]?.defaultLang ?? "en");
  const [accessCode, setAccessCode] = useState("");
  const [running, setRunning] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepUI[]>(INITIAL_STEPS);
  const [titles, setTitles] = useState<FinalTitle[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) setAccessCode(saved);
  }, []);

  function onCountryChange(code: string) {
    setCountry(code);
    const c = countries.find((x) => x.code === code);
    if (c) setLanguage(c.defaultLang);
  }

  function resetSteps() {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setTitles(null);
    setGlobalError(null);
    setAuthError(null);
    setCostSummary(null);
  }

  function updateStep(name: StepName, patch: Partial<StepUI>) {
    setSteps((prev) =>
      prev.map((s) => (s.name === name ? { ...s, ...patch } : s))
    );
  }

  function applyEvent(ev: StepEvent) {
    switch (ev.kind) {
      case "step_start":
        updateStep(ev.step, { status: "running", label: ev.label });
        return;
      case "step_done":
        updateStep(ev.step, {
          status: "done",
          label: ev.label,
          summary: ev.summary,
          data: ev.data,
          warning: ev.warning,
        });
        return;
      case "step_error":
        updateStep(ev.step, {
          status: "error",
          label: ev.label,
          error: ev.error,
        });
        return;
      case "final":
        setTitles(ev.titles);
        return;
      case "warning":
        setGlobalError(ev.message);
        return;
      case "cost_summary":
        setCostSummary(ev.summary);
        return;
      case "done":
        return;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    if (!accessCode.trim()) {
      setAuthError("Access code is required");
      return;
    }
    if (!concept.trim()) return;

    localStorage.setItem(AUTH_KEY, accessCode.trim());
    resetSteps();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          "x-auth-code": accessCode.trim(),
        },
        body: JSON.stringify({
          concept: concept.trim(),
          instructions: instructions.trim(),
          countryCode: country,
          languageCode: language,
        }),
      });

      if (res.status === 401) {
        setAuthError("Invalid access code");
        setRunning(false);
        return;
      }
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setGlobalError(`Request failed (${res.status}): ${text.slice(0, 200)}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by \n\n
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as StepEvent;
              applyEvent(ev);
            } catch {
              /* ignore malformed */
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setGlobalError("Cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setGlobalError(msg);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="bg-white border border-yt-border rounded-xl p-5 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Raw concept or idea
          </label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g. how the housing market is shifting in 2026"
            required
            className="w-full px-3 py-2 bg-white border border-yt-border rounded-md focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Optional instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder='e.g. "educational tone, avoid clickbait, target first-time buyers"'
            className="w-full px-3 py-2 bg-white border border-yt-border rounded-md focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-yt-border rounded-md focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              maxLength={5}
              className="w-full px-3 py-2 bg-white border border-yt-border rounded-md focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Access code
            </label>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setAuthError(null);
              }}
              placeholder="Server AUTH_CODE"
              className={`w-full px-3 py-2 bg-white border rounded-md focus:outline-none focus:ring-1 ${
                authError
                  ? "border-yt-red focus:border-yt-red focus:ring-yt-red"
                  : "border-yt-border focus:border-yt-red focus:ring-yt-red"
              }`}
            />
            {authError && (
              <p className="mt-1 text-xs text-yt-red">{authError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!running ? (
            <button
              type="submit"
              className="px-4 py-2 bg-yt-red hover:bg-yt-redHover text-white rounded-full font-medium text-sm transition"
            >
              Run research
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-yt-chip hover:bg-yt-border text-yt-text rounded-full font-medium text-sm transition"
            >
              Cancel
            </button>
          )}
          {running && (
            <span className="inline-flex items-center gap-2 text-yt-muted text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-yt-red animate-pulse" />
              Running pipeline…
            </span>
          )}
        </div>
      </form>

      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm">
          {globalError}
        </div>
      )}

      {(running || steps.some((s) => s.status !== "pending")) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-yt-muted uppercase tracking-wide">
            Pipeline progress
          </h2>
          {steps.map((s) => (
            <StepCard key={s.name} step={s} />
          ))}
        </section>
      )}

      {titles && titles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-yt-muted uppercase tracking-wide">
            Suggested titles
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {titles.map((t, i) => (
              <TitleCard key={i} title={t} />
            ))}
          </div>
        </section>
      )}

      {costSummary && (
        <section className="border border-yt-border rounded-xl bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-yt-muted uppercase tracking-wide">
            LLM Cost Breakdown
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-yt-muted border-b border-yt-border">
                <th className="text-left pb-1.5 pr-3 font-medium">Step</th>
                <th className="text-left pb-1.5 pr-3 font-medium">Model</th>
                <th className="text-right pb-1.5 pr-3 font-medium">Input</th>
                <th className="text-right pb-1.5 pr-3 font-medium">Cached</th>
                <th className="text-right pb-1.5 pr-3 font-medium">Output</th>
                <th className="text-right pb-1.5 font-medium">Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {costSummary.entries.map((e, i) => (
                <tr key={i} className="border-b border-yt-border last:border-0">
                  <td className="py-1.5 pr-3 text-yt-text">{e.step}</td>
                  <td className="py-1.5 pr-3 text-yt-muted font-mono">{e.model}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{e.inputTokens.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-yt-muted">{e.cachedInputTokens.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{e.outputTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">${e.costUsd.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-yt-text font-semibold border-t-2 border-yt-border">
                <td colSpan={2} className="pt-2 pr-3">Total</td>
                <td className="pt-2 pr-3 text-right tabular-nums">{costSummary.totalInputTokens.toLocaleString()}</td>
                <td className="pt-2 pr-3 text-right tabular-nums text-yt-muted">{costSummary.totalCachedInputTokens.toLocaleString()}</td>
                <td className="pt-2 pr-3 text-right tabular-nums">{costSummary.totalOutputTokens.toLocaleString()}</td>
                <td className="pt-2 text-right tabular-nums text-yt-red">${costSummary.totalCostUsd.toFixed(6)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-yt-muted">
            Nano: $0.05/$0.005/$0.40 per 1M in/cached/out &nbsp;·&nbsp;
            Mini: $0.25/$0.025/$2.00 per 1M in/cached/out
          </p>
        </section>
      )}
    </div>
  );
}
