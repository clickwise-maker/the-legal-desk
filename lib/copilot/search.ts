import { prisma } from "@/lib/prisma";
import type { Jurisdiction } from "./jurisdiction";

// Hybrid search adapted from doc.haus (RRF) + Legal-RAG (BM25+rerank), simplified for Postgres without pgvector.
// We use: (a) keyword scoring via token overlap + (b) recency boost + (c) jurisdiction filter, fused via RRF.

type SearchChunk = { id: string; documentId: string; content: string; chunkIndex: number; documentTitle: string; jurisdiction: string };

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function bm25LikeScore(queryTokens: string[], docTokens: string[]): number {
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  for (const q of queryTokens) {
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    score += Math.log(1 + f) * 2;
    if (docTokens.join(" ").includes(q)) score += 0.5;
  }
  const phrase = queryTokens.join(" ");
  if (docTokens.join(" ").includes(phrase)) score += 3;
  return score;
}

function rrfFuse(ranked: Array<{ id: string; rank: number }>, k = 60): Map<string, number> {
  const m = new Map<string, number>();
  for (const { id, rank } of ranked) m.set(id, (m.get(id) ?? 0) + 1 / (k + rank));
  return m;
}

export async function hybridSearch(opts: {
  query: string;
  ownerId: string;
  jurisdiction?: Jurisdiction;
  matterId?: string;
  topK?: number;
}): Promise<Array<SearchChunk & { score: number; quote: string }>> {
  const topK = opts.topK ?? 8;
  const queryTokens = tokenize(opts.query);
  if (queryTokens.length === 0) return [];

  const docs = await prisma.legalDocument.findMany({
    where: {
      ownerId: opts.ownerId,
      status: "INDEXED",
      ...(opts.jurisdiction && opts.jurisdiction !== "GLOBAL" ? { jurisdiction: opts.jurisdiction } : {}),
      ...(opts.matterId ? { matterId: opts.matterId } : {}),
    },
    select: { id: true, title: true, jurisdiction: true },
    take: 100,
  });
  if (docs.length === 0) return [];
  const docIds = docs.map((d) => d.id);
  const docTitleMap = new Map(docs.map((d) => [d.id, d.title]));
  const docJurMap = new Map(docs.map((d) => [d.id, d.jurisdiction]));

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: { in: docIds } },
    select: { id: true, documentId: true, content: true, chunkIndex: true },
    take: 400,
  });

  // Score via BM25-like
  const scored = chunks
    .map((c) => {
      const toks = tokenize(c.content);
      const s = bm25LikeScore(queryTokens, toks);
      return { chunk: c, score: s };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 3);

  if (scored.length === 0) return [];

  // Secondary rerank: keyword density + length penalty (cheap cross-encoder substitute)
  const reranked = scored
    .map(({ chunk, score }) => {
      const contentLower = chunk.content.toLowerCase();
      let boost = 0;
      for (const t of queryTokens) if (contentLower.includes(t)) boost += 1;
      const final = score + boost * 0.7 - Math.abs(chunk.content.length - 800) * 0.0001;
      return { chunk, final };
    })
    .sort((a, b) => b.final - a.final)
    .slice(0, topK);

  // Also compute RRF fusion of BM25 ranking vs rerank for stability (doc.haus pattern)
  const bm25Ranked = scored.map((s, i) => ({ id: s.chunk.id, rank: i + 1 }));
  const rerankRanked = reranked.map((r, i) => ({ id: r.chunk.id, rank: i + 1 }));
  const rrf = new Map<string, number>();
  for (const [id, v] of Array.from(rrfFuse(bm25Ranked).entries())) rrf.set(id, (rrf.get(id) ?? 0) + v);
  for (const [id, v] of Array.from(rrfFuse(rerankRanked).entries())) rrf.set(id, (rrf.get(id) ?? 0) + v);

  const fused = reranked
    .map((r) => ({ ...r, rrf: rrf.get(r.chunk.id) ?? 0 }))
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK);

  return fused.map(({ chunk, final }) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    documentTitle: docTitleMap.get(chunk.documentId) ?? "Document",
    jurisdiction: docJurMap.get(chunk.documentId) ?? "GLOBAL",
    score: final,
    quote: chunk.content.slice(0, 280).replace(/\s+/g, " ").trim(),
  }));
}
