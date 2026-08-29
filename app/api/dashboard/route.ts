import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  const [bookings, forms, wallet, lawyerProfile, upcoming, cases] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: userId },
      include: {
        lawyer: { select: { name: true, avatarUrl: true } },
        lawyerProfile: { select: { city: true } },
        form: { select: { title: true } },
        rating: { select: { score: true } },
      },
      orderBy: { startTime: "desc" },
      take: 10,
    }),
    prisma.form.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { fields: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 8 } },
    }),
    role === "LAWYER"
      ? prisma.lawyerProfile.findUnique({ where: { userId } })
      : Promise.resolve(null),
    prisma.booking.findMany({
      where: {
        clientId: userId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: new Date() },
      },
      include: { lawyer: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    // "Cases" = completed bookings + completed forms (unified view)
    prisma.booking.count({
      where: { clientId: userId, status: "COMPLETED" },
    }),
  ]);

  const casesCount = cases + forms.filter((f) => f.status === "COMPLETED").length;

  return NextResponse.json({
    role,
    stats: {
      totalBookings: bookings.length,
      upcoming: upcoming.length,
      totalForms: forms.length,
      completedForms: forms.filter((f) => f.status === "COMPLETED").length,
      cases: casesCount,
      walletBalance: wallet?.balance ?? 0,
      pendingForms: forms.filter((f) => f.status === "FILLED" || f.status === "UPLOADED").length,
    },
    bookings,
    forms,
    upcoming,
    transactions: wallet?.transactions ?? [],
    lawyerProfile,
  });
}
