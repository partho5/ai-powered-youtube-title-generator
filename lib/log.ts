import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "errors.log");

export type LogContext = {
  step?: string;
  message: string;
  error?: unknown;
  details?: Record<string, unknown>;
};

export function logError(ctx: LogContext): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const err = ctx.error;
    const entry = {
      ts: new Date().toISOString(),
      step: ctx.step ?? null,
      message: ctx.message,
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : err != null
            ? String(err)
            : null,
      details: ctx.details ?? null,
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // logger must never throw
  }
}
