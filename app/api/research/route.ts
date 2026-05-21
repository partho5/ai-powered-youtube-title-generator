import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/pipeline/runner";
import type { ResearchInput, StepEvent } from "@/lib/pipeline/types";
import { findCountry } from "@/lib/countries";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseFrame(event: StepEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const expected = process.env.AUTH_CODE;
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: AUTH_CODE not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const provided = req.headers.get("x-auth-code");
  if (provided !== expected) {
    return new Response(
      JSON.stringify({ error: "Invalid access code" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Partial<ResearchInput>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const concept = (body.concept || "").trim();
  if (!concept) {
    return new Response(JSON.stringify({ error: "concept is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const countryCode = (body.countryCode || "US").toUpperCase();
  const country = findCountry(countryCode);
  const languageCode = (body.languageCode || country.defaultLang || "en")
    .toLowerCase()
    .slice(0, 5);

  const input: ResearchInput = {
    concept,
    instructions: (body.instructions || "").trim() || undefined,
    countryCode: country.code,
    languageCode,
  };

  // Link client abort -> pipeline AbortController
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StepEvent) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(event)));
        } catch {
          /* controller closed */
        }
      };
      // initial padding/comment so the browser flushes immediately
      controller.enqueue(encoder.encode(": connected\n\n"));
      try {
        for await (const ev of runPipeline(input, ac.signal)) {
          send(ev);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError({
          step: "pipeline",
          message: "Unhandled pipeline error",
          error: err,
          details: {
            concept: input.concept,
            countryCode: input.countryCode,
            languageCode: input.languageCode,
          },
        });
        send({
          kind: "step_error",
          step: "keywords",
          label: "Pipeline",
          error: `Unhandled: ${msg}`,
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
