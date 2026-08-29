export type Chunk = { index: number; content: string; tokenCount: number };

const TARGET_TOKENS = 500;
const OVERLAP = 80;
const CHARS_PER_TOKEN = 4;

function estimateTokens(s: string): number {
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

export function chunkText(text: string, opts?: { targetTokens?: number; overlap?: number }): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const targetChars = (opts?.targetTokens ?? TARGET_TOKENS) * CHARS_PER_TOKEN;
  const overlapChars = (opts?.overlap ?? OVERLAP) * CHARS_PER_TOKEN;
  const chunks: Chunk[] = [];
  let start = 0;
  let idx = 0;
  while (start < clean.length) {
    let end = Math.min(start + targetChars, clean.length);
    if (end < clean.length) {
      const lastBreak = clean.lastIndexOf("\n\n", end);
      const altBreak = clean.lastIndexOf(". ", end);
      const cut = lastBreak > start + targetChars * 0.5 ? lastBreak : altBreak > start + targetChars * 0.5 ? altBreak + 1 : end;
      end = cut;
    }
    const content = clean.slice(start, end).trim();
    if (content) chunks.push({ index: idx++, content, tokenCount: estimateTokens(content) });
    if (end >= clean.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks;
}

export function sanitizeChunk(s: string): string {
  return s.slice(0, 8000);
}
