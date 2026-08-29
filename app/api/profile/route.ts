import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  categorizeLabel,
  normalizeLabel,
  computeSections,
  overallCompletion,
  maskSensitive,
} from "@/lib/profile";

const STRING_FIELDS = [
  "name",
  "firstName",
  "middleName",
  "lastName",
  "gender",
  "nationality",
  "phone",
  "alternatePhone",
  "addressLine1",
  "addressLine2",
  "village",
  "city",
  "district",
  "state",
  "country",
  "pincode",
  "permanentAddress",
  "correspondenceAddress",
  "occupation",
  "companyName",
  "designation",
  "workAddress",
  "previousEmployer",
] as const;

const updateSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  firstName: z.string().max(80).nullable().optional(),
  middleName: z.string().max(80).nullable().optional(),
  lastName: z.string().max(80).nullable().optional(),
  gender: z.string().max(40).nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  alternatePhone: z.string().max(20).nullable().optional(),
  addressLine1: z.string().max(300).nullable().optional(),
  addressLine2: z.string().max(300).nullable().optional(),
  village: z.string().max(120).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  district: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  pincode: z.string().max(12).nullable().optional(),
  permanentAddress: z.string().max(500).nullable().optional(),
  correspondenceAddress: z.string().max(500).nullable().optional(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  occupation: z.string().max(80).nullable().optional(),
  companyName: z.string().max(120).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  workAddress: z.string().max(300).nullable().optional(),
  previousEmployer: z.string().max(120).nullable().optional(),
  experienceYears: z.number().int().min(0).max(80).nullable().optional(),
});

const itemSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        value: z.string().max(2000),
        category: z.string().max(40).optional(),
        approved: z.boolean().optional(),
      })
    )
    .max(200),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, items, education, family, documents, financial] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.profileItem.findMany({
      where: { userId: session.user.id },
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.educationRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
    }),
    prisma.familyMember.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
    }),
    prisma.identityDocument.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.financialDetail.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const sections = computeSections({ user, items, education, family });
  const completion = overallCompletion(sections);

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      profilePhotoUrl: user.profilePhotoUrl,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      gender: user.gender,
      nationality: user.nationality,
      alternatePhone: user.alternatePhone,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      village: user.village,
      city: user.city,
      district: user.district,
      state: user.state,
      country: user.country,
      pincode: user.pincode,
      permanentAddress: user.permanentAddress,
      correspondenceAddress: user.correspondenceAddress,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
      occupation: user.occupation,
      companyName: user.companyName,
      designation: user.designation,
      workAddress: user.workAddress,
      previousEmployer: user.previousEmployer,
      experienceYears: user.experienceYears,
    },
    sections,
    completion,
    items,
    grouped,
    education,
    family,
    documents: documents.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      documentNumber: maskSensitive(d.documentNumber),
      issueDate: d.issueDate ? d.issueDate.toISOString().slice(0, 10) : null,
      expiryDate: d.expiryDate ? d.expiryDate.toISOString().slice(0, 10) : null,
      issuingAuthority: d.issuingAuthority,
      fileUrl: d.fileUrl,
      createdAt: d.createdAt,
    })),
    financial: financial.map((f) => ({ ...f, value: maskSensitive(f.value) })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) {
    if (k in parsed.data) {
      const v = (parsed.data as Record<string, unknown>)[k];
      data[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    }
  }
  if (parsed.data.dateOfBirth !== undefined) data.dateOfBirth = parsed.data.dateOfBirth;
  if (parsed.data.experienceYears !== undefined) data.experienceYears = parsed.data.experienceYears;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: Object.fromEntries(STRING_FIELDS.map((k) => [k, true])) as Record<string, boolean>,
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  // Upsert profile knowledge-base items (approved by default, reused forever)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  let saved = 0;
  for (const it of parsed.data.items) {
    const key = normalizeLabel(it.label);
    if (!key) continue;
    // Empty value removes the item from the knowledge base.
    if (!it.value.trim()) {
      await prisma.profileItem.deleteMany({
        where: { userId: session.user.id, key },
      });
      continue;
    }
    const category = it.category ?? categorizeLabel(it.label);
    await prisma.profileItem.upsert({
      where: { userId_key: { userId: session.user.id, key } },
      update: { value: it.value, label: it.label, category, approved: it.approved ?? true },
      create: {
        userId: session.user.id,
        key,
        label: it.label,
        value: it.value,
        category,
        approved: it.approved ?? true,
      },
    });
    saved += 1;
  }

  return NextResponse.json({ saved });
}
