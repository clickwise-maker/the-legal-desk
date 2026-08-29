import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage/blob";

const ACCEPTED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_DOC_SIZE = 10 * 1024 * 1024;

const metaSchema = z.object({
  id: z.string().optional(),
  documentType: z.string().max(80).nullable().optional(),
  documentNumber: z.string().max(120).nullable().optional(),
  issueDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  issuingAuthority: z.string().max(160).nullable().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();

  let fileUrl: string | null = null;
  const file = formData.get("file");
  if (file instanceof File) {
    if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF, PNG, JPEG and WEBP documents are supported" }, { status: 400 });
    }
    if (file.size > MAX_DOC_SIZE) {
      return NextResponse.json({ error: "Document too large (max 10 MB)" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    fileUrl = await uploadFile({
      buffer,
      fileName: file.name,
      contentType: file.type,
      prefix: "documents",
    });
  }

  const raw: Record<string, string> = {
    documentType: String(formData.get("documentType") ?? ""),
    documentNumber: String(formData.get("documentNumber") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    expiryDate: String(formData.get("expiryDate") ?? ""),
    issuingAuthority: String(formData.get("issuingAuthority") ?? ""),
  };

  const data = {
    documentType: raw.documentType || null,
    documentNumber: raw.documentNumber || null,
    issueDate: raw.issueDate ? new Date(raw.issueDate) : null,
    expiryDate: raw.expiryDate ? new Date(raw.expiryDate) : null,
    issuingAuthority: raw.issuingAuthority || null,
  };

  const count = await prisma.identityDocument.count({ where: { userId: session.user.id } });
  if (count >= 20) {
    return NextResponse.json({ error: "Maximum 20 documents allowed" }, { status: 400 });
  }

  const doc = await prisma.identityDocument.create({
    data: { userId: session.user.id, ...data, fileUrl },
  });

  return NextResponse.json({ ...doc, documentNumber: null }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = metaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.identityDocument.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const updated = await prisma.identityDocument.update({
    where: { id },
    data: {
      documentType: data.documentType ?? undefined,
      documentNumber: data.documentNumber ?? undefined,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      issuingAuthority: data.issuingAuthority ?? undefined,
    },
  });

  return NextResponse.json({ ...updated, documentNumber: null });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.identityDocument.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.identityDocument.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
