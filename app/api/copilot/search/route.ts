import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hybridSearch } from "@/lib/copilot/search";
import { parseJurisdiction } from "@/lib/copilot/jurisdiction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  const jurisdiction = parseJurisdiction(new URL(req.url).searchParams.get("jurisdiction"));
  const matterId = new URL(req.url).searchParams.get("matterId") || undefined;
  const results = await hybridSearch({ query: q, ownerId: session.user.id, jurisdiction, matterId, topK: 8 });
  return NextResponse.json({ results });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const q = String(body?.q ?? body?.query ?? "").trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  const jurisdiction = parseJurisdiction(body?.jurisdiction);
  const results = await hybridSearch({ query: q, ownerId: session.user.id, jurisdiction, matterId: body?.matterId, topK: 8 });
  return NextResponse.json({ results });
}
