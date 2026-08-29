import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJurisdiction } from "@/lib/copilot/jurisdiction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const matters = await prisma.matter.findMany({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { documents: true, drafts: true } } } });
  return NextResponse.json(matters);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const jurisdiction = parseJurisdiction(body?.jurisdiction);
  const matter = await prisma.matter.create({ data: { ownerId: session.user.id, title, jurisdiction, description: String(body?.description ?? "") } });
  return NextResponse.json(matter, { status: 201 });
}
