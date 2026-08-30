import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({ status: z.enum(["VALID","REJECTED","NEEDS_INFO","REFUND_REQUIRED"]), decision: z.string().max(500).optional() }).strict();

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const complaint = await prisma.complaint.findUnique({ where: { id: params.id } });
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.complaint.update({
    where: { id: params.id },
    data: { status: parsed.data.status, decision: parsed.data.decision, decidedBy: session.user.id, decidedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "COMPLAINT_MODERATE", targetId: params.id, targetType: "Complaint", meta: { status: parsed.data.status }, ip: req.headers.get("x-forwarded-for")?.split(",")[0] } });
  return NextResponse.json(updated);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.complaint.findUnique({ where: { id: params.id }, include: { appeals: true } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = session.user.role === "ADMIN";
  const isReporter = c.reporterId === session.user.id;
  const isLawyer = c.lawyerId === session.user.id;
  if (!isAdmin && !isReporter && !isLawyer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // For non-admin, hide pending complaints as proven facts — only show status, not as public accusation
  return NextResponse.json(c);
}
