import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SPECIALIZATIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  barCouncilId: z.string().trim().min(3, "Bar Council ID is too short").max(40).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  hourlyRate: z.coerce.number().min(0).max(100000).optional(),
  bio: z.string().trim().max(1000).optional(),
  city: z.string().trim().max(80).optional(),
  isAvailable: z.boolean().optional(),
  specializations: z.array(z.string().trim().min(2).max(50)).max(12).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      LawyerSpecialization: { select: { specialization: { select: { name: true } } } },
      specializations: { select: { name: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "No lawyer profile yet" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    barCouncilId: profile.barCouncilId,
    experienceYears: profile.experienceYears,
    hourlyRate: profile.hourlyRate,
    commissionPercent: profile.commissionRate,
    bio: profile.bio,
    city: profile.city,
    isAvailable: profile.isAvailable,
    isVerified: profile.isVerified,
    specializations: Array.from(
      new Set([
        ...profile.specializations.map((s) => s.name),
        ...profile.LawyerSpecialization.map((ls) => ls.specialization.name),
      ])
    ),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.lawyerProfile.findUnique({ where: { userId: session.user.id } });
  // Only a LAWYER (or an account that already has a profile) may configure one.
  if (!existing && session.user.role !== "LAWYER") {
    return NextResponse.json({ error: "Only lawyer accounts can configure a lawyer profile" }, { status: 403 });
  }

  const specNames = data.specializations
    ? data.specializations.filter((s) => SPECIALIZATIONS.includes(s as (typeof SPECIALIZATIONS)[number]))
    : undefined;

  const profile = await prisma.$transaction(async (tx) => {
    const upserted = await tx.lawyerProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        barCouncilId: data.barCouncilId ?? "PENDING",
        experienceYears: data.experienceYears ?? 0,
        hourlyRate: data.hourlyRate ?? 0,
        bio: data.bio ?? "",
        city: data.city,
        isAvailable: data.isAvailable ?? true,
      },
      update: {
        ...(data.barCouncilId !== undefined && { barCouncilId: data.barCouncilId }),
        ...(data.experienceYears !== undefined && { experienceYears: data.experienceYears }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
      },
    });

    if (specNames) {
      // Ensure specialization records exist, then replace the join rows.
      for (const name of specNames) {
        await tx.specialization.upsert({ where: { name }, create: { name }, update: {} });
      }
      await tx.lawyerSpecialization.deleteMany({ where: { lawyerId: upserted.id } });
      if (specNames.length > 0) {
        const specs = await tx.specialization.findMany({ where: { name: { in: specNames } } });
        await tx.lawyerSpecialization.createMany({
          data: specs.map((s) => ({ lawyerId: upserted.id, specializationId: s.id })),
        });
      }
    }

    return tx.lawyerProfile.findUnique({
      where: { id: upserted.id },
      include: { LawyerSpecialization: { select: { specialization: { select: { name: true } } } } },
    });
  });

  return NextResponse.json({
    id: profile!.id,
    barCouncilId: profile!.barCouncilId,
    experienceYears: profile!.experienceYears,
    hourlyRate: profile!.hourlyRate,
    bio: profile!.bio,
    city: profile!.city,
    isAvailable: profile!.isAvailable,
    specializations: profile!.LawyerSpecialization.map((ls) => ls.specialization.name),
  });
}
