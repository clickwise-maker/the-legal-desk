import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const upsertSchema = z.object({
  id: z.string().optional(),
  relationship: z.string().max(80).nullable().optional(),
  name: z.string().max(120).nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  occupation: z.string().max(120).nullable().optional(),
  dependentStatus: z.boolean().optional(),
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

  const count = await prisma.familyMember.count({ where: { userId: session.user.id } });
  if (count >= 20) {
    return NextResponse.json({ error: "Maximum 20 family members allowed" }, { status: 400 });
  }

  const record = await prisma.familyMember.create({
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

  const existing = await prisma.familyMember.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const updated = await prisma.familyMember.update({ where: { id }, data });
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

  const existing = await prisma.familyMember.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  await prisma.familyMember.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
