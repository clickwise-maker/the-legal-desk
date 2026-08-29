import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Final submit — the confirmation step of the form workspace. The client
 * shows a review summary first; this endpoint only accepts a FILLED form
 * with zero empty fields and flips it to COMPLETED, producing the final
 * output ready for download.
 */
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
  if (form.status === "COMPLETED") {
    return NextResponse.json({ ok: true, alreadySubmitted: true, status: "COMPLETED" });
  }
  if (form.status !== "FILLED") {
    return NextResponse.json({ error: "Finish filling all fields before submitting." }, { status: 409 });
  }

  const emptyFields = form.fields.filter((f) => !f.value || !f.value.trim());
  if (emptyFields.length > 0) {
    return NextResponse.json(
      { error: `Please fill the ${emptyFields.length} remaining field${emptyFields.length === 1 ? "" : "s"} before submitting.` },
      { status: 422 }
    );
  }

  const filledData = form.fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.label] = f.value;
    return acc;
  }, {});

  await prisma.form.update({
    where: { id: form.id },
    data: { status: "COMPLETED", filledData },
  });

  return NextResponse.json({
    ok: true,
    status: "COMPLETED",
    fieldCount: form.fields.length,
  });
}
