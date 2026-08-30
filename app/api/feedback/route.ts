import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().cuid(),
  score: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  timeliness: z.number().int().min(1).max(5).optional(),
  quality: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(600).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(req, { keyPrefix: "feedback:create", max: 5, windowSec: 60, identifier: `user:${session.user.id}` });
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.clientId !== session.user.id) return NextResponse.json({ error: "Only the client can review" }, { status: 403 });
  if (booking.status !== "COMPLETED") return NextResponse.json({ error: "Booking must be completed" }, { status: 409 });
  const existing = await prisma.rating.findUnique({ where: { bookingId: booking.id } });
  if (existing) return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const rating = await prisma.rating.create({
    data: {
      bookingId: booking.id,
      clientId: session.user.id,
      lawyerProfileId: booking.lawyerProfileId,
      score: parsed.data.score,
      comment: parsed.data.comment ? parsed.data.comment.replace(/</g, "&lt;").slice(0, 600) : null,
    },
  });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "FEEDBACK_CREATE", targetId: rating.id, targetType: "Rating", ip: req.headers.get("x-forwarded-for")?.split(",")[0] } });
  return NextResponse.json(rating, { status: 201 });
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("bookingId");
  if (!id) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  const list = await prisma.rating.findMany({ where: { bookingId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(list);
}
