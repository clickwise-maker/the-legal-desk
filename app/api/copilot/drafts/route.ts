import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraft } from "@/lib/copilot/draft";
import { hybridSearch } from "@/lib/copilot/search";
import { parseJurisdiction } from "@/lib/copilot/jurisdiction";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const drafts = await prisma.draft.findMany({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" }, take: 50 });
  return NextResponse.json(drafts);
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { keyPrefix: "copilot:drafts", max: rateLimitDefaults.copilot.max, windowSec: rateLimitDefaults.copilot.windowSec });
  if (!rl.allowed) return rateLimitResponse(rl);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const instruction = String(body?.instruction ?? "").trim();
  if (!instruction) return NextResponse.json({ error: "Instruction required" }, { status: 400 });
  const jurisdiction = parseJurisdiction(body?.jurisdiction);
  const matterId = body?.matterId ?? null;

  // Retrieve evidence (RAG)
  let citations: Array<{ quote: string; documentTitle: string }> = [];
  try {
    const results = await hybridSearch({ query: instruction, ownerId: session.user.id, jurisdiction, matterId: matterId || undefined, topK: 6 });
    citations = results.map((r) => ({ quote: r.quote, documentTitle: r.documentTitle }));
  } catch {}

  const content = await generateDraft({ instruction, jurisdiction, citations, matterContext: body?.matterContext });

  const draft = await prisma.draft.create({
    data: {
      ownerId: session.user.id,
      matterId: matterId || null,
      title: String(body?.title ?? instruction.slice(0, 80)),
      content,
      jurisdiction,
      citations: citations as unknown as object,
    },
  });
  return NextResponse.json(draft, { status: 201 });
}
