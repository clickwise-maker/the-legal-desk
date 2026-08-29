import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const upsertSchema = z.object({
  id: z.string().optional(),
  qualification: z.string().max(120).nullable().optional(),
  institution: z.string().max(200).nullable().optional(),
  boardUniversity: z.string().max(200).nullable().optional(),
  passingYear: z.number().int().min(1900).max(2100).nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  cgpa: z.number().min(0).max(10).nullable().optional(),
  certificateReference: z.string().max(200).nullable().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const count = await prisma.educationRecord.count({ where: { userId: session.user.id } });
  if (count >= 20) {
    return NextResponse.json({ error: "Maximum 20 education records allowed" }, { status: 400 });
  }

  const record = await prisma.educationRecord.create({
    data: { userId: session.user.id, ...parsed.data, order: count },
  });
  return NextResponse.json(record, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.educationRecord.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const updated = await prisma.educationRecord.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.educationRecord.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  await prisma.educationRecord.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
