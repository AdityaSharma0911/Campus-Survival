// ============================================================
// gemini.js — one function that talks to Google AI Studio.
// The key goes in a header (never the URL, so it doesn't end up in logs).
// ============================================================

export class GeminiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * callGemini({ apiKey, prompt, system?, schema?, temperature?, timeoutMs?, model?, fetchImpl? })
 *   schema given -> returns parsed JSON that follows it
 *   no schema    -> returns plain text
 */
export async function callGemini({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || "gemini-flash-latest",
  prompt, system, schema, temperature = 0.2,
  timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 12000),
  fetchImpl = fetch
}) {
  if (!apiKey) throw new GeminiError("no_key", "GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {})
    }
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    throw new GeminiError("network", e.name === "AbortError" ? `timed out after ${timeoutMs} ms` : e.message);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 404 ? ` (is "${model}" a valid model id?)` : res.status === 429 ? " (rate limited)" : "";
    throw new GeminiError(`http_${res.status}`, `${data.error?.message ?? `HTTP ${res.status}`}${hint}`);
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("").trim();
  if (!text) {
    const why = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? "no text";
    throw new GeminiError("empty", `Gemini returned no text (${why})`);
  }
  if (!schema) return text;
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new GeminiError("bad_json", "Gemini returned invalid JSON");
  }
}
