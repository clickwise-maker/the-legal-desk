import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  lawyerId: z.string().cuid(),
  bookingId: z.string().cuid().optional().nullable(),
  matterId: z.string().cuid().optional().nullable(),
  category: z.enum(["Payment taken but service not provided", "Lawyer did not respond", "Consultation not delivered", "Unprofessional communication", "Incorrect/misleading service representation", "Other"]),
  description: z.string().min(20).max(2000),
  evidenceUrl: z.string().url().optional().nullable(),
}).strict();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(req, { keyPrefix: "complaint:create", max: 5, windowSec: 60, identifier: `user:${session.user.id}` });
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Verify booking/matter belongs to reporter if provided
  if (parsed.data.bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId } });
    if (!b || b.clientId !== session.user.id) return NextResponse.json({ error: "Booking not eligible" }, { status: 403 });
  }

  const complaint = await prisma.complaint.create({
    data: {
      reporterId: session.user.id,
      lawyerId: parsed.data.lawyerId,
      bookingId: parsed.data.bookingId ?? null,
      matterId: parsed.data.matterId ?? null,
      category: parsed.data.category,
      description: parsed.data.description.replace(/</g, "&lt;").slice(0, 2000),
      evidenceUrl: parsed.data.evidenceUrl ?? null,
      status: "PENDING",
    },
  });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "COMPLAINT_CREATE", targetId: complaint.id, targetType: "Complaint", ip: req.headers.get("x-forwarded-for")?.split(",")[0] } });
  return NextResponse.json(complaint, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = session.user.role === "ADMIN";
  const where = isAdmin ? {} : { reporterId: session.user.id };
  const list = await prisma.complaint.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, include: { appeals: true } });
  // For non-admin, filter to own; for lawyer, also show complaints against them via separate query
  if (session.user.role === "LAWYER" && !isAdmin) {
    const against = await prisma.complaint.findMany({ where: { lawyerId: session.user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { appeals: true } });
    return NextResponse.json([...list, ...against]);
  }
  return NextResponse.json(list);
}
