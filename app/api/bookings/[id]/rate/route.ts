import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(600).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { lawyerProfile: { select: { id: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.clientId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed bookings can be rated" }, { status: 409 });
  }
  const existing = await prisma.rating.findUnique({ where: { bookingId: booking.id } });
  if (existing) return NextResponse.json({ error: "Already rated" }, { status: 409 });

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

  const rating = await prisma.rating.create({
    data: {
      bookingId: booking.id,
      clientId: session.user.id,
      lawyerProfileId: booking.lawyerProfileId,
      score: parsed.data.score,
      comment: parsed.data.comment,
    },
  });

  return NextResponse.json(rating, { status: 201 });
}
