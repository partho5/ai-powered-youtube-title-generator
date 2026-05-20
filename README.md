# YouTube Title Research

Next.js 14 app that runs a 6-step research pipeline and returns 5 ready-to-use YouTube title suggestions for any concept. Streams progress to the UI via Server-Sent Events.

## Pipeline

1. **Keyword expansion** — LLM (nano) generates 8–10 realistic search queries
2. **YouTube Autocomplete** — fans out 7 prefix variants per keyword to `suggestqueries.google.com`, dedupes
3. **Google Trends validation** — LLM picks top 10; trends.google.com sanity check
4. **Competition check** — YouTube Data API v3 (`search.list` + `videos.list` + `channels.list`) for top 6 keywords
5. **Opportunity scoring** — LLM (mini) scores each keyword 1–10 + identifies title patterns
6. **Title generation** — LLM (mini) returns 5 titles with angle, reasoning, opportunity score

If the YouTube Data API quota is exhausted, Step 4 is skipped and the pipeline continues with autocomplete + trends only.

## Setup

```bash
cp .env.example .env.local
# then edit .env.local with your keys
npm install
npm run dev
```

Open <http://localhost:3000>.

## Required env vars

| Variable | Purpose |
| -------- | ------- |
| `OPENAI_API_KEY` | OpenAI API key |
| `YOUTUBE_API_KEY` | Google Cloud → YouTube Data API v3 key |
| `AUTH_CODE` | Any long random string. The UI requires this code at request time to gate LLM cost. |
| `OPENAI_MODEL_NANO` *(optional)* | Default `gpt-5-nano-2025-08-07` |
| `OPENAI_MODEL_MINI` *(optional)* | Default `gpt-5-mini-2025-08-07` |

## Using the app

1. Enter a raw concept (e.g. *"how AI is changing software jobs"*)
2. Optional: instructions (tone, audience, what to avoid)
3. Pick country + language (default US / en)
4. Enter the access code (it is stored in `localStorage` so you only type it once)
5. Click **Run research** — steps stream in real time; click any completed step to inspect raw data
6. Final titles render as cards with copy button and character count badge
7. **Cancel** mid-run with the Cancel button — both client and server abort in-flight requests

## Notes

- All external API calls happen server-side only (avoids CORS + client-IP location bias)
- The Google Trends unauthed explore endpoint is brittle; on failure the pipeline degrades to trend-less scoring
- No database; no history. Each run is ephemeral.
- Built for local dev; not optimized for serverless cold-start timeouts.

## Tech

- Next.js 14 (app router) + TypeScript
- Tailwind CSS (YouTube light theme)
- OpenAI Node SDK
- Server-Sent Events for streaming
- AbortController on both client and server for cancellation
