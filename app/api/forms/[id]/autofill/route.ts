import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileContext } from "@/lib/profile";
import { autofillFromProfile, stillMissing } from "@/lib/forms/engine";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (form.fields.length === 0) {
    return NextResponse.json({ error: "Run field detection first (Process with AI)." }, { status: 409 });
  }

  const ctx = await getProfileContext(session.user.id);
  const { fields, filledCount, metrics } = await autofillFromProfile(form.fields, ctx);

  // Persist only the newly filled values (leave user-edited values alone).
  let updated = 0;
  for (const f of fields) {
    const original = form.fields.find((x) => x.id === f.id);
    if (original && !(original.value && original.value.trim()) && f.value && f.value.trim()) {
      await prisma.formField.update({
        where: { id: f.id },
        data: { value: f.value, confidence: 0.95 },
      });
      updated += 1;
    }
  }

  const filledData = fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.label] = f.value;
    return acc;
  }, {});

  const missingCount = stillMissing(fields).length;
  const status = missingCount === 0 ? "FILLED" : "DRAFT";
  await prisma.form.update({ where: { id: form.id }, data: { filledData, status } });

  return NextResponse.json({
    filledCount: updated,
    metrics,
    missingCount,
    status,
    fields,
  });
}
