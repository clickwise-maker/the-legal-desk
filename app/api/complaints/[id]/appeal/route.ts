import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ message: z.string().min(20).max(2000) }).strict();

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const complaint = await prisma.complaint.findUnique({ where: { id: params.id } });
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (complaint.lawyerId !== session.user.id) return NextResponse.json({ error: "Only the complained lawyer can appeal" }, { status: 403 });
  const appeal = await prisma.complaintAppeal.create({ data: { complaintId: params.id, lawyerId: session.user.id, message: parsed.data.message.replace(/</g, "&lt;") } });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "COMPLAINT_APPEAL", targetId: params.id, targetType: "Complaint", ip: req.headers.get("x-forwarded-for")?.split(",")[0] } });
  return NextResponse.json(appeal, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await prisma.complaintAppeal.findMany({ where: { complaintId: params.id }, orderBy: { createdAt: "asc" } });
  // Only participants or admin can view
  const complaint = await prisma.complaint.findUnique({ where: { id: params.id }, select: { reporterId: true, lawyerId: true } });
  if (!complaint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = session.user.role === "ADMIN";
  if (complaint.reporterId !== session.user.id && complaint.lawyerId !== session.user.id && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(list);
}
