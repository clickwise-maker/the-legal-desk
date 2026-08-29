import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage/blob";
import { ingestDocument } from "@/lib/copilot/ingest";
import { parseJurisdiction } from "@/lib/copilot/jurisdiction";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/jpg"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const matterId = new URL(req.url).searchParams.get("matterId");
  const docs = await prisma.legalDocument.findMany({
    where: { ownerId: session.user.id, ...(matterId ? { matterId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const title = ((formData.get("title") as string) || "").trim() || (file instanceof File ? file.name : "Untitled");
  const jurisdiction = parseJurisdiction(formData.get("jurisdiction") as string);
  const matterId = (formData.get("matterId") as string) || null;

  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ACCEPTED.includes(file.type) && file.type !== "application/octet-stream")
    return NextResponse.json({ error: "Only PDF/PNG/JPEG/WEBP" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadFile({ buffer, fileName: file.name, contentType: file.type || "application/pdf", prefix: "copilot" });

  const { documentId, chunks } = await ingestDocument({
    ownerId: session.user.id,
    matterId,
    title,
    fileName: file.name,
    fileUrl,
    fileType: file.type || "application/pdf",
    buffer,
    jurisdiction,
  });

  const doc = await prisma.legalDocument.findUnique({ where: { id: documentId } });
  return NextResponse.json({ ...doc, chunks }, { status: 201 });
}
