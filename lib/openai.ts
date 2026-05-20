import OpenAI from "openai";

export const NANO_MODEL =
  process.env.OPENAI_MODEL_NANO || "gpt-5-nano-2025-08-07";
export const MINI_MODEL =
  process.env.OPENAI_MODEL_MINI || "gpt-5-mini-2025-08-07";

let _client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}
