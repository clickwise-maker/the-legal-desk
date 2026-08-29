import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveAnswersToProfile, stillMissing } from "@/lib/forms/engine";

const schema = z.object({
  fields: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        value: z.string().max(2000),
        fieldType: z.string().default("text"),
        order: z.number().int().default(0),
        saveToProfile: z.boolean().optional(),
      })
    )
    .min(1)
    .max(200),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: { fields: true },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Merge submitted values into the existing field set (partial-fill friendly).
  const existing = new Map(form.fields.map((f) => [f.label, f]));
  const incoming = new Map<string, z.infer<typeof schema>["fields"][number]>();

  for (const f of parsed.data.fields) {
    incoming.set(f.label, f);
    const existingField = existing.get(f.label);
    if (existingField) {
      await prisma.formField.update({
        where: { id: existingField.id },
        data: { value: f.value, fieldType: f.fieldType || existingField.fieldType },
      });
    } else {
      await prisma.formField.create({
        data: {
          formId: form.id,
          label: f.label,
          fieldType: f.fieldType,
          value: f.value,
          order: f.order || form.fields.length + 1,
          confidence: 1,
        },
      });
    }
  }

  // Persist the knowledge base: save the answers the user approved.
  const toSave = parsed.data.fields.filter((f) => f.saveToProfile === true);
  const savedToProfile = await saveAnswersToProfile(
    session.user.id,
    toSave.map((f) => ({ label: f.label, value: f.value })),
    form.id
  );

  const refreshed = await prisma.form.findUnique({
    where: { id: form.id },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  const fields = refreshed?.fields ?? form.fields;
  const filledData = fields.reduce<Record<string, string>>((acc, f) => {
    acc[f.label] = f.value;
    return acc;
  }, {});

  const missing = stillMissing(fields);

  await prisma.form.update({
    where: { id: form.id },
    data: { filledData, status: missing.length === 0 ? "FILLED" : "DRAFT" },
  });

  return NextResponse.json({
    savedFields: parsed.data.fields.length,
    savedToProfile,
    filledData,
    missing,
    missingCount: missing.length,
    status: refreshed?.status ?? form.status,
  });
}
