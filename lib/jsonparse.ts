export function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json|JSON)?\s*/, "");
    s = s.replace(/```\s*$/, "");
  }
  return s.trim();
}

export function parseJSON<T = unknown>(raw: string): T {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // try to extract first {...} or [...] block
    const objMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (objMatch) {
      return JSON.parse(objMatch[0]) as T;
    }
    throw new Error("LLM output is not valid JSON: " + cleaned.slice(0, 200));
  }
}
