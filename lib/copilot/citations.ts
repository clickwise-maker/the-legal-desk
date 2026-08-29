export type Citation = {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  quote: string;
  page?: number;
  score?: number;
};

// Verbatim quote guard — only emit quotes that appear in source chunks.
export function verifyQuote(quote: string, chunks: Array<{ content: string }>): boolean {
  const needle = quote.trim().slice(0, 120).toLowerCase();
  if (needle.length < 20) return false;
  return chunks.some((c) => c.content.toLowerCase().includes(needle.slice(0, 40)));
}

export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return "";
  return citations
    .map((c, i) => `[${i + 1}] ${c.documentTitle}${c.page ? ` p.${c.page}` : ""}: “${c.quote.slice(0, 220)}”`)
    .join("\n");
}

export function buildCitationSources(citations: Citation[]): Array<{ label: string; href: string }> {
  return citations.map((c, i) => ({
    label: `${c.documentTitle} — excerpt ${i + 1}`,
    href: `/api/copilot/documents/${c.documentId}`,
  }));
}
