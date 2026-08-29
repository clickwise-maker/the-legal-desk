import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const applicationSchema = z.object({
  step: z.number().int().min(1).max(3),
  action: z.enum(["save", "submit"]),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  practiceEmail: z.string().trim().email().max(120).optional().or(z.literal("")),
  chamberAddress: z.string().trim().max(300).optional().or(z.literal("")),
  barCouncilId: z.string().trim().min(6).max(40),
  enrolmentYear: z.number().int().min(1950).max(2100).nullable().optional(),
  aibeCopNumber: z.string().trim().max(40).optional().or(z.literal("")),
  specializations: z.array(z.string().trim().max(50)).max(12).default([]),
  courtsOfPractice: z.array(z.string().trim().max(60)).max(10).default([]),
  experienceYears: z.number().int().min(0).max(60),
  barIdDocUrl: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, phone: true, email: true, profilePhotoUrl: true, role: true },
    }),
    prisma.lawyerProfile.findUnique({
      where: { userId: session.user.id },
      include: { LawyerSpecialization: { select: { specialization: { select: { name: true } } } } },
    }),
  ]);

  const courts = (profile?.courtsOfPractice as string[] | null) ?? [];
  const specializations = profile
    ? profile.LawyerSpecialization.map((ls) => ls.specialization.name)
    : [];

  return NextResponse.json({
    user: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CLIENT",
    },
    application: profile
      ? {
          step: 1,
          name: user?.name ?? "",
          phone: user?.phone ?? "",
          practiceEmail: profile.practiceEmail ?? "",
          chamberAddress: profile.chamberAddress ?? "",
          barCouncilId: profile.barCouncilId === "PENDING" ? "" : profile.barCouncilId,
          enrolmentYear: profile.enrolmentYear,
          aibeCopNumber: profile.aibeCopNumber ?? "",
          specializations,
          courtsOfPractice: courts,
          experienceYears: profile.experienceYears,
          barIdDocUrl: profile.enrolmentCertificateUrl ?? "",
          photoUrl: user?.profilePhotoUrl ?? "",
          onboardingStatus: profile.onboardingStatus,
          credentialsVerifiedAt: profile.credentialsVerifiedAt,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid application data" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const submitting = d.action === "submit";

  const missing: string[] = [];
  if (submitting) {
    if (!d.practiceEmail) missing.push("Practice email");
    if (!d.chamberAddress) missing.push("Office/Chamber address");
    if (!d.enrolmentYear) missing.push("Year of enrolment");
    if (d.specializations.length === 0) missing.push("At least one area of expertise");
    if (d.courtsOfPractice.length === 0) missing.push("At least one court of practice");
    if (!d.barIdDocUrl) missing.push("Bar Council ID / Enrolment certificate");
    if (!d.photoUrl) missing.push("Profile photograph");
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 422 }
    );
  }

  // Personal details land on the User; professional ones on the LawyerProfile.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: d.name,
      phone: d.phone || null,
      ...(d.photoUrl ? { profilePhotoUrl: d.photoUrl } : {}),
    },
  });

  let profile;
  try {
    profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.lawyerProfile.findUnique({ where: { userId: session.user.id } });
      const upserted = await tx.lawyerProfile.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          barCouncilId: d.barCouncilId,
          experienceYears: d.experienceYears,
          practiceEmail: d.practiceEmail || null,
          chamberAddress: d.chamberAddress || null,
          enrolmentYear: d.enrolmentYear ?? null,
          aibeCopNumber: d.aibeCopNumber || null,
          courtsOfPractice: d.courtsOfPractice,
          enrolmentCertificateUrl: d.barIdDocUrl || null,
          onboardingStatus: submitting ? "SUBMITTED" : "DRAFT",
        },
        update: {
          ...(d.barCouncilId ? { barCouncilId: d.barCouncilId } : {}),
          experienceYears: d.experienceYears,
          practiceEmail: d.practiceEmail || null,
          chamberAddress: d.chamberAddress || null,
          enrolmentYear: d.enrolmentYear ?? null,
          aibeCopNumber: d.aibeCopNumber || null,
          courtsOfPractice: d.courtsOfPractice,
          enrolmentCertificateUrl: d.barIdDocUrl || null,
          onboardingStatus: submitting ? "SUBMITTED" : "DRAFT",
        },
      });

      // Sync areas of expertise (specializations join).
      if (d.specializations.length > 0) {
        for (const name of d.specializations) {
          await tx.specialization.upsert({ where: { name }, create: { name }, update: {} });
        }
        await tx.lawyerSpecialization.deleteMany({ where: { lawyerId: upserted.id } });
        const specs = await tx.specialization.findMany({ where: { name: { in: d.specializations } } });
        await tx.lawyerSpecialization.createMany({
          data: specs.map((s) => ({ lawyerId: upserted.id, specializationId: s.id })),
        });
      }

      return upserted;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    const isUnique = err && typeof err === "object" && "code" in err && err.code === "P2002";
    return NextResponse.json(
      { error: isUnique ? "This Bar Council enrolment number is already registered." : message },
      { status: isUnique ? 409 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: profile.onboardingStatus,
    message: submitting
      ? "Application submitted for review. Our team will verify your credentials shortly."
      : "Progress saved as a draft. You can continue later.",
  });
}
