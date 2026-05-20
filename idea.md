its my idea. you can suggest before building :
here i hardcoded usa, but it will be input by user in UI. default USA. 



Build a basic Next.js app deployable on Vercel.

## Goal
A YouTube title research pipeline. User inputs a raw concept 
and optional instructions. The backend runs a multi-step 
automated research pipeline and returns 3-5 ready-to-use 
YouTube title suggestions optimized for USA audience.

## UI (keep minimal)
- Text input: "Raw concept or idea"
- Textarea: "Optional instructions" 
  (e.g. "target USA audience, educational tone, avoid clickbait")
- Submit button
- Results area: shows each pipeline step completing in real time, 
  then final titles at the end

## Backend Pipeline
Build as Next.js API route: /api/research
Use Server-Sent Events to stream step progress to frontend.

---

### Step 1 — Keyword Expansion
Model: gpt-5-nano-2025-08-07
Input: raw concept + optional instructions
Task: generate 8-10 searchable keyword variations a USA person 
would actually type into YouTube search
Output: JSON array of keyword strings

---

### Step 2 — YouTube Autocomplete Fetch (free, no key)
For each keyword from Step 1, call YouTube Suggest API:
GET https://suggestqueries.google.com/complete/search
  ?client=youtube&ds=yt&hl=en&gl=US&q=KEYWORD

Also query each keyword with these prefixes to multiply results:
"why", "how", "what", "is", "best", "the truth about"

Parse the JSONP response — extract the suggestions array 
(second element of the outer array).
Deduplicate all results across all queries.
Output: flat array of unique suggestion strings (expect 60-120)

---

### Step 3 — Google Trends Validation (free, no key)
For top 10 most relevant suggestions (selected by nano model), 
call Google Trends interest-over-time endpoint:
GET https://trends.google.com/trends/api/explore
  ?hl=en-US&tz=-300&req={"comparisonItem":[{"keyword":"KEYWORD",
  "geo":"US","time":"today 12-m"}],"category":0,"property":"youtube"}

Extract trend score for each keyword.
Flag keywords with rising or high trend scores.
Output: keyword list with trend scores

---

### Step 4 — YouTube Data API v3 Competition Check
Model: gpt-5-nano-2025-08-07 (selects top 6 keywords to check)
For each of the top 6 keywords call:

search.list:
  q=KEYWORD
  part=snippet
  type=video
  regionCode=US
  relevanceLanguage=en
  maxResults=5
  order=viewCount

Then for returned video IDs call videos.list:
  part=statistics
  id=VIDEO_ID_1,VIDEO_ID_2,...

Extract per keyword:
  - total competing video count (search result totalResults)
  - top 5 video titles
  - top 5 view counts
  - top 5 channel subscriber counts if available
  - publish dates of top results

Output: structured competitor data object per keyword

---

### Step 5 — Opportunity Scoring
Model: gpt-5-mini-2025-08-07
Input: competitor data from Step 4 + trend scores from Step 3
Task:
  Score each keyword 1-10 on opportunity using this logic:
  - High views on small/medium channels = high opportunity
  - Recent publish dates in top results = topic still growing
  - Rising trend score = growing demand
  - Low competing video count = underserved
  - Large channels dominating = lower score
  
  Also identify title patterns from top performing videos:
  - sentence structure patterns
  - emotional trigger words used
  - question vs statement format
  - number usage patterns

  Shortlist top 3 keywords with reasoning.

Output: scored keywords + pattern analysis + shortlist

---

### Step 6 — Final Title Generation
Model: gpt-5-mini-2025-08-07
Input: 
  - top 3 keywords from Step 5
  - title patterns identified
  - original raw concept
  - optional instructions from user

Task: generate 5 final YouTube title suggestions

Rules:
  - Target USA audience specifically
  - 55-65 characters ideal length
  - No cheap clickbait but strong curiosity gap
  - Vary the angle across all 5 titles
    (e.g. question format, bold statement, 
    numbered, exposé style, educational)
  - Match patterns found in high-performing competitor titles
  - Each title must feel like it belongs in top 10 results

Output: JSON array of 5 objects:
  { title, keyword_used, angle, reasoning, opportunity_score }

---

## Additional free data sources the model may use if useful:
- Reddit search via old.reddit.com/search for USA discussion 
  volume around a topic (fetch as text, parse manually)
- YouTube search page scrape for result count estimate
  (fetch youtube.com/results?search_query=KEYWORD, 
  parse "About X results")

---

## Streaming UI behavior
Show each step as it completes:
  Step 1 complete: generated 9 keywords
  Step 2 complete: collected 84 autocomplete suggestions  
  Step 3 complete: trend scores fetched
  Step 4 complete: competitor data for 6 keywords
  Step 5 complete: top 3 opportunities identified
  Step 6 complete: 5 titles ready

Then render final titles as cards, each showing:
  - The title (large, copyable)
  - Keyword used
  - Angle type
  - Short reasoning (1 line)

---

## Environment Variables
OPENAI_API_KEY=
YOUTUBE_API_KEY=

## Models assignment summary
- gpt-5-nano-2025-08-07: Steps 1, 2 parsing, 3 selection, 4 keyword selection
- gpt-5-mini-2025-08-07: Steps 5, 6 (reasoning and generation tasks)

## Tech stack
- Next.js 14 app router
- Tailwind CSS
- Server-Sent Events for streaming
- No database
- auth required , not to access ui, but to work backend. a very basic auth code needed matche agains env set auth code. whats your take on this. actually no auth but vetcel deploy will be public. thats why a guard required to save my LLM cost. 

- Vercel deploy ready

## Important notes
- All external API calls must happen server-side only
  (avoids CORS and location bias from client IP)
- Vercel servers are US-based so YouTube Suggest and 
  Google Trends will return US-localized results automatically
- Handle YouTube Data API v3 quota exhaustion gracefully:
  if quota exceeded, skip Step 4, proceed with 
  Suggest + Trends data only and note it in UI
- Parse all LLM outputs as JSON, strip markdown fences before parsing
- Each step should have try/catch with fallback behavior

