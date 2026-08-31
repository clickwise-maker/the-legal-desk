import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const specialization = searchParams.get("specialization")?.trim();
  const city = searchParams.get("city")?.trim();

  const where: Record<string, unknown> = { isAvailable: true };

  if (specialization) {
    where.LawyerSpecialization = {
      some: { specialization: { name: specialization } },
    };
  }

  if (city) {
    where.city = { contains: city, mode: "insensitive" };
  }

  if (q) {
    where.OR = [
      { bio: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { LawyerSpecialization: { some: { specialization: { name: { contains: q, mode: "insensitive" } } } } },
    ];
  }

  const lawyers = await prisma.lawyerProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      specializations: { select: { name: true } },
      LawyerSpecialization: {
        select: { specialization: { select: { name: true } } },
      },
      ratings: { select: { score: true } },
      availability: { select: { dayOfWeek: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { hourlyRate: "asc" },
    take: 50,
  });

  const payload = lawyers.map((l) => {
    const specs = [
      ...l.specializations.map((s) => s.name),
      ...l.LawyerSpecialization.map((ls) => ls.specialization.name),
    ];
    const uniqueSpecs = Array.from(new Set(specs));
    const avgRating = l.ratings.length
      ? l.ratings.reduce((sum, r) => sum + r.score, 0) / l.ratings.length
      : 0;

    return {
      id: l.id,
      userId: l.userId,
      name: l.user.name,
      avatarUrl: l.user.avatarUrl,
      bio: l.bio,
      barCouncilId: l.barCouncilId,
      experienceYears: l.experienceYears,
      hourlyRate: l.hourlyRate,
      commissionPercent: PLATFORM_COMMISSION_PERCENT,
      city: l.city,
      state: (l as unknown as { state?: string }).state ?? null,
      jurisdiction: (l as unknown as { jurisdiction?: string }).jurisdiction ?? null,
      isVerified: l.isVerified,
      specializations: uniqueSpecs,
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: l.ratings.length,
      bookingCount: l._count.bookings,
      availableDays: l.availability.map((a) => a.dayOfWeek),
    };
  });

  return NextResponse.json(payload);
}
