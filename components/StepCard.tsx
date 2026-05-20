"use client";

import { useState } from "react";
import type { StepName } from "@/lib/pipeline/types";

type Step = {
  name: StepName;
  label: string;
  status: "pending" | "running" | "done" | "error";
  summary?: string;
  warning?: string;
  error?: string;
  data?: unknown;
};

export default function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const canExpand = step.status === "done" && step.data !== undefined;

  const statusBadge = () => {
    switch (step.status) {
      case "pending":
        return (
          <span className="text-xs text-yt-muted bg-yt-chip px-2 py-0.5 rounded-full">
            pending
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-yt-red bg-red-50 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-yt-red animate-pulse" />
            running
          </span>
        );
      case "done":
        return (
          <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            done
          </span>
        );
      case "error":
        return (
          <span className="text-xs text-yt-red bg-red-50 px-2 py-0.5 rounded-full">
            error
          </span>
        );
    }
  };

  return (
    <div
      className={`border rounded-lg bg-white ${
        step.status === "error" ? "border-red-200" : "border-yt-border"
      }`}
    >
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 ${
          canExpand ? "cursor-pointer hover:bg-yt-surface" : "cursor-default"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{step.label}</span>
            {statusBadge()}
          </div>
          {step.summary && (
            <div className="text-sm text-yt-muted mt-0.5 truncate">
              {step.summary}
            </div>
          )}
          {step.warning && (
            <div className="text-xs text-amber-700 mt-1">⚠ {step.warning}</div>
          )}
          {step.error && (
            <div className="text-xs text-yt-red mt-1">✕ {step.error}</div>
          )}
        </div>
        {canExpand && (
          <span className="text-yt-muted text-sm">{open ? "▴" : "▾"}</span>
        )}
      </button>
      {open && canExpand && (
        <div className="border-t border-yt-border bg-yt-surface px-4 py-3">
          <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words">
            {JSON.stringify(step.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
