import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileContext } from "@/lib/profile";
import { computeFormMetrics } from "@/lib/forms/engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: {
      fields: { orderBy: { order: "asc" } },
      booking: { include: { lawyer: { select: { name: true } } } },
    },
  });

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Profile-match metrics: how much of this form can be answered from the KB.
  let metrics: ReturnType<typeof computeFormMetrics> | null = null;
  if (form.fields.length > 0) {
    const ctx = await getProfileContext(form.ownerId);
    metrics = computeFormMetrics(form.fields, ctx);
  }

  return NextResponse.json({ ...form, metrics });
}
