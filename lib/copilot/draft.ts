import { chatDeepSeek, sanitizeForModel } from "@/lib/ai/deepseek";
import type { Jurisdiction } from "./jurisdiction";
import { jurisdictionPromptHint } from "./jurisdiction";

export async function generateDraft(opts: {
  instruction: string;
  jurisdiction: Jurisdiction;
  citations?: Array<{ quote: string; documentTitle: string }>;
  matterContext?: string;
}): Promise<string> {
  const citationBlock =
    opts.citations && opts.citations.length > 0
      ? `AUTHORIZED SOURCES (cite verbatim, do not invent):\n${opts.citations.map((c, i) => `[${i + 1}] ${c.documentTitle}: “${c.quote.slice(0, 220)}”`).join("\n")}\n\nYou MUST cite source numbers for every factual claim.`
      : "No authorized documents matched — state that no source was found and draft from general principles with a disclaimer.";

  const system = [
    jurisdictionPromptHint(opts.jurisdiction),
    "You are a worldwide legal drafting copilot. Draft in clean, editable prose suitable for Word redlining.",
    "Use headings, numbered clauses, and bracketed placeholders [LIKE_THIS] for missing facts.",
    "Do not hallucinate citations. Only cite the AUTHORIZED SOURCES above.",
    opts.matterContext ? `Matter context: ${opts.matterContext}` : "",
    citationBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return chatDeepSeek(
    [
      { role: "system", content: system },
      { role: "user", content: sanitizeForModel(opts.instruction) },
    ],
    { temperature: 0.2, maxTokens: 2500 }
  );
}

// AGPL-safe case analysis (inspired by Mike-Aur-Donna ideas, reimplemented)
export async function analyzeCase(opts: {
  facts: string;
  jurisdiction: Jurisdiction;
  citations?: Array<{ quote: string; documentTitle: string }>;
}): Promise<{ strengths: string; weaknesses: string; gaps: string; strategy: string }> {
  const base = jurisdictionPromptHint(opts.jurisdiction);
  const cite = opts.citations?.length
    ? `Sources:\n${opts.citations.map((c) => `— ${c.documentTitle}: ${c.quote.slice(0, 200)}`).join("\n")}`
    : "No sources — base analysis on facts alone.";
  const instruction = `${base}\n${cite}\n\nFacts:\n${sanitizeForModel(opts.facts)}\n\nReturn JSON with keys strengths, weaknesses, gaps, strategy (each 3-5 bullets, plain text, no markdown code fence).`;
  const raw = await chatDeepSeek(
    [
      { role: "system", content: "You are a worldwide case analysis copilot. Be direct, cite sources where possible, flag uncertainty." },
      { role: "user", content: instruction },
    ],
    { temperature: 0.2, maxTokens: 1500 }
  );
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
  } catch {}
  return { strengths: raw.slice(0, 600), weaknesses: "See full output", gaps: "—", strategy: "—" };
}
