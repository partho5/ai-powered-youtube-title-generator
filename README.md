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

## Manual playbook (how to do it without the software)

This section is for a new hire who needs to understand what the software actually does. You can reproduce every step by hand using a browser, ChatGPT, and a spreadsheet. Pick one concept (e.g. *"how AI is changing software jobs"*) and one target country/language (e.g. US / en) before you start, and keep them fixed for the whole run.

### Step 1 — Keyword expansion (LLM, ~30s)

**Goal:** turn one fuzzy concept into 8–10 short queries a real person would actually type into YouTube search.

**Do this:**
1. Open ChatGPT (or any LLM).
2. Paste this prompt, filling in the concept and country/language:
   ```
   You expand a raw video concept into realistic YouTube search queries
   that an actual person in [COUNTRY] (language: [LANG]) would type.

   Raw concept: [YOUR CONCEPT]
   Optional instructions: [tone / audience / what to avoid, or "none"]

   Generate 8–10 keyword variations covering different angles
   (informational, comparison, how-to, opinion). 2–6 words each.
   No duplicates. No numbering. Output as a JSON array of strings.
   ```
3. Save the list — these are your **seed keywords** (you'll have 8–10).

**Why this step exists:** the user's concept is too broad to plug into YouTube directly. We need plausible search strings to feed into autocomplete.

### Step 2 — YouTube Autocomplete (web fetch, ~10s)

**Goal:** discover what real users are currently searching for around each seed keyword.

**Do this for every seed keyword:**
1. Open YouTube in a private/incognito window (set the language/region to match your target).
2. Type the seed keyword into the search bar — write down every autocomplete suggestion that drops down.
3. Repeat with each of these 7 prefix variants prepended:
   `(none)`, `why `, `how `, `what `, `is `, `best `, `the truth about `
   So for seed `housing market 2026` you also type `why housing market 2026`, `how housing market 2026`, etc.
4. Pool every suggestion into one list, lowercase everything, remove duplicates.

You should end up with **dozens of suggestions** (typically 50–150). If a prefix returns nothing, just skip it.

**Why this step exists:** autocomplete is YouTube telling you, in their own words, what people are searching *right now*. It's the cheapest demand signal that exists.

### Step 3 — Google Trends validation (LLM shortlist + trends.google.com, ~30s)

**Goal:** cut the noise from Step 2 down to the 10 most search-relevant candidates and sanity-check that demand is real (not dead).

**Do this:**
1. **Shortlist with an LLM.** If you have more than 10 suggestions from Step 2 (you usually do), paste them into ChatGPT and ask:
   ```
   Concept: [YOUR CONCEPT]
   Pick the 10 suggestions most likely to match real search intent
   for this concept. Return as a JSON array.

   Candidates:
   1. ...
   2. ...
   ```
2. **Validate each of the 10 in Google Trends.** Open <https://trends.google.com>, set country = your target, time range = "Past 12 months", category = "YouTube search". Search each keyword and note:
   - `score`: average interest (0–100), or "?" if Trends shows no data.
   - `rising`: is the line trending up over the last 90 days? (yes/no)
3. Keep all 10 even if trends shows no data — Trends is often missing data for long-tail queries; that's fine, downstream steps will weight them lower.

**Why this step exists:** autocomplete shows *what people type*, Trends shows *whether that interest is growing, shrinking, or seasonal*. A rising score is gold; a falling score is a warning.

### Step 4 — Competition check (YouTube Data API or manual browser, ~2 min)

**Goal:** for the top 6 candidates from Step 3, find out who you'd be competing against — top videos, view counts, channel sizes, recency.

**Do this:**
1. **Pick top 6.** If you have more than 6 candidates, paste the Step 3 list into ChatGPT and ask: *"Pick the 6 most worth investigating for competition. Return JSON."* Use trend rising + score as the main signal.
2. **For each of those 6 keywords**, open YouTube search, filter by *Sort: View count*, and record the **top 5 videos**:
   - title
   - channel name + subscriber count (click into the channel to get subs)
   - view count
   - publish date
   - approximate `totalResults` shown ("About X,XXX results" — YouTube usually only shows this on the desktop site near the top of the results)
3. Put it all into a spreadsheet, one row per video, grouped by keyword.

**Why this step exists:** opportunity isn't "high search volume" — it's "high search volume *with weak competition*". A keyword where top videos come from 50k-subscriber channels with 500k views = creators with your size can rank. A keyword dominated by 10M-subscriber channels = you can't.

If you hit the YouTube Data API quota in the software, the pipeline skips this step and scores keywords on autocomplete + trends only — you can do the same manually by just skipping ahead.

### Step 5 — Opportunity scoring (LLM, ~1 min)

**Goal:** turn all the raw data from Steps 3 + 4 into a 1–10 opportunity score per keyword, pick a top 3, and extract title patterns from the winning videos.

**Do this:**
1. Open ChatGPT (use a stronger model than Step 1 — you want better judgement).
2. Paste this prompt, with your data filled in:
   ```
   You are a YouTube content strategist analyzing keyword opportunity
   for a creator targeting [COUNTRY] ([LANG]).

   Concept: [YOUR CONCEPT]

   Trend signals:
   - keyword1 (score=50, rising)
   - keyword2 (score=?, not rising)
   ...

   Competitor data:
   ## keyword1
   Total results: 12,300
   Top videos:
     - "Title A" | 1,200,000 views | ChannelX (45,000 subs) | published 2025-11-02
     - ...

   ## keyword2
   ...

   Score each keyword 1–10 on opportunity using this logic:
   - High views on small/medium channels = high opportunity
   - Recent publish dates in top results = topic still growing
   - Rising trend = growing demand
   - Low competing video count = underserved
   - Large channels dominating (>1M subs) = lower score

   Also identify title patterns from top performing videos:
   - sentence structure patterns
   - emotional trigger words used
   - question vs statement format
   - number usage patterns

   Return JSON with: scored[{keyword,score,reasoning}],
   shortlist (exactly 3 top keywords), patterns{sentenceStructures[],
   emotionalTriggers[], formatMix, numberUsage}.
   ```
3. Save the output. The **shortlist of 3 keywords** and the **patterns object** are the only things Step 6 needs.

**Why this step exists:** humans aren't great at weighing 6 keywords × 5 videos × 4 signals at once. The LLM is acting as the strategist that reads the spreadsheet for you and produces a ranked recommendation.

### Step 6 — Title generation (LLM, ~30s)

**Goal:** write 5 ready-to-publish YouTube titles built around the shortlisted keywords and patterns from Step 5.

**Do this:**
1. Open ChatGPT.
2. Paste:
   ```
   You write high-CTR YouTube titles for a creator targeting
   [COUNTRY] ([LANG]).

   Original concept: [YOUR CONCEPT]
   User instructions: [tone/audience, or "none"]

   Top 3 shortlisted keywords: kw1, kw2, kw3

   Title patterns observed in top competitors:
   - Sentence structures: [paste from Step 5]
   - Emotional triggers: [paste from Step 5]
   - Format mix: [paste from Step 5]
   - Number usage: [paste from Step 5]

   Rules:
   - 55–65 characters ideal length (count precisely)
   - Strong curiosity gap, no cheap clickbait
   - Vary the angle across all 5 titles (question, bold statement,
     numbered list, expose, educational, etc.)
   - Each title should feel like it belongs in the top 10 search
     results for its keyword

   Return JSON: titles[{title, keyword_used, angle, reasoning,
   opportunity_score}]. Exactly 5 entries.
   ```
3. For each title, verify character count is in 55–65, pick the one with the highest `opportunity_score` as your headline candidate.

**Why this step exists:** the previous 5 steps were research. This step converts that research into the actual deliverable — a title you could publish today.

### Sanity checks before you ship a title

- Length 55–65 chars (YouTube truncates above ~70 on mobile).
- Search the final title verbatim on YouTube. If the exact title already exists with high views, tweak the angle.
- The keyword from `keyword_used` should appear naturally in the title — not stuffed.
- If every title sounds the same, you didn't vary the angle in Step 6. Re-prompt.

### What the software adds over doing this by hand

- Parallelizes Step 2 (7 prefix variants × 8–10 keywords = 56–70 autocomplete calls, run 10 at a time).
- Calls the YouTube Data API in Step 4 instead of manual browser sleuthing (faster, but burns quota).
- Uses OpenAI **Structured Outputs** with `strict: true` schemas in Steps 1, 5, 6 — the API guarantees the JSON shape, so the pipeline can't get an unparseable answer back from the model.
- Tracks token usage + USD cost per LLM call.
- Logs every error with the raw model response to `logs/errors.log` for debugging.

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
