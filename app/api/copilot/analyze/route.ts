import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeCase } from "@/lib/copilot/draft";
import { hybridSearch } from "@/lib/copilot/search";
import { parseJurisdiction } from "@/lib/copilot/jurisdiction";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { keyPrefix: "copilot:analyze", max: rateLimitDefaults.copilot.max, windowSec: rateLimitDefaults.copilot.windowSec });
  if (!rl.allowed) return rateLimitResponse(rl);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const facts = String(body?.facts ?? body?.query ?? "").trim();
  if (!facts) return NextResponse.json({ error: "Facts required" }, { status: 400 });
  const jurisdiction = parseJurisdiction(body?.jurisdiction);
  let citations: Array<{ quote: string; documentTitle: string }> = [];
  try {
    const results = await hybridSearch({ query: facts, ownerId: session.user.id, jurisdiction, topK: 6 });
    citations = results.map((r) => ({ quote: r.quote, documentTitle: r.documentTitle }));
  } catch {}
  const result = await analyzeCase({ facts, jurisdiction, citations });
  return NextResponse.json({ ...result, citations });
}
