import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
      specializations: { select: { name: true } },
      LawyerSpecialization: { select: { specialization: { select: { name: true } } } },
      ratings: { include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
      availability: true,
      _count: { select: { bookings: true } },
    },
  });

  if (!lawyer) {
    return NextResponse.json({ error: "Lawyer not found" }, { status: 404 });
  }

  const specs = [
    ...lawyer.specializations.map((s) => s.name),
    ...lawyer.LawyerSpecialization.map((ls) => ls.specialization.name),
  ];
  const avgRating = lawyer.ratings.length
    ? lawyer.ratings.reduce((sum, r) => sum + r.score, 0) / lawyer.ratings.length
    : 0;

  return NextResponse.json({
    id: lawyer.id,
    name: lawyer.user.name,
    email: lawyer.user.email,
    phone: lawyer.user.phone,
    avatarUrl: lawyer.user.avatarUrl,
    bio: lawyer.bio,
    barCouncilId: lawyer.barCouncilId,
    experienceYears: lawyer.experienceYears,
    hourlyRate: lawyer.hourlyRate,
    commissionPercent: lawyer.commissionRate,
    city: lawyer.city,
    isVerified: lawyer.isVerified,
    specializations: Array.from(new Set(specs)),
    rating: Math.round(avgRating * 10) / 10,
    ratingCount: lawyer.ratings.length,
    bookingCount: lawyer._count.bookings,
    availability: lawyer.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    })),
  });
}
