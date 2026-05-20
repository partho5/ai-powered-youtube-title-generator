"use client";

import { useState } from "react";
import type { FinalTitle } from "@/lib/pipeline/types";

export default function TitleCard({ title }: { title: FinalTitle }) {
  const [copied, setCopied] = useState(false);
  const len = title.title.length;
  const inRange = len >= 55 && len <= 65;

  async function copy() {
    try {
      await navigator.clipboard.writeText(title.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border border-yt-border bg-white rounded-xl p-4 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-yt-text">
            {title.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full ${
                inRange
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
              title="Ideal: 55–65 chars"
            >
              {len} chars
            </span>
            {title.angle && (
              <span className="px-2 py-0.5 rounded-full bg-yt-chip text-yt-muted">
                {title.angle}
              </span>
            )}
            {title.keyword_used && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-yt-red">
                kw: {title.keyword_used}
              </span>
            )}
            {typeof title.opportunity_score === "number" && (
              <span className="px-2 py-0.5 rounded-full bg-yt-chip text-yt-muted">
                opportunity {title.opportunity_score}/10
              </span>
            )}
          </div>
          {title.reasoning && (
            <p className="mt-2 text-sm text-yt-muted">{title.reasoning}</p>
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 px-3 py-1.5 text-xs rounded-full bg-yt-chip hover:bg-yt-border text-yt-text"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
