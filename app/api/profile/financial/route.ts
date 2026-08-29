import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeLabel } from "@/lib/profile";

const CATEGORIES = ["INCOME", "BANK", "TAX", "INVESTMENT", "GENERAL"] as const;

const upsertSchema = z.object({
  id: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  label: z.string().min(1).max(120),
  value: z.string().max(2000),
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

  const key = normalizeLabel(parsed.data.label);
  if (!key) return NextResponse.json({ error: "Invalid label" }, { status: 400 });

  const detail = await prisma.financialDetail.upsert({
    where: { userId_key: { userId: session.user.id, key } },
    update: {
      category: parsed.data.category ?? "GENERAL",
      label: parsed.data.label,
      value: parsed.data.value,
    },
    create: {
      userId: session.user.id,
      key,
      category: parsed.data.category ?? "GENERAL",
      label: parsed.data.label,
      value: parsed.data.value,
      isSensitive: true,
    },
  });

  return NextResponse.json({ ok: true, id: detail.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.financialDetail.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await prisma.financialDetail.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
