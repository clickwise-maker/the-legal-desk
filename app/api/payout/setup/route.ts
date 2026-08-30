import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ contact: z.string().min(5).max(100).optional(), fundAccount: z.string().min(5).max(100).optional() }).strict();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "LAWYER" && session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const account = await prisma.payoutAccount.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(account ?? { kycStatus: "NOT_STARTED", providerStatus: "NOT_STARTED" });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "LAWYER" && session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const account = await prisma.payoutAccount.upsert({
    where: { userId: session.user.id },
    update: { kycStatus: "PENDING", providerStatus: "PENDING", razorpayContactId: parsed.data.contact, razorpayFundAccountId: parsed.data.fundAccount },
    create: { userId: session.user.id, kycStatus: "PENDING", providerStatus: "PENDING", razorpayContactId: parsed.data.contact, razorpayFundAccountId: parsed.data.fundAccount },
  });
  await prisma.auditLog.create({ data: { actorId: session.user.id, action: "PAYOUT_SETUP", targetId: account.id, targetType: "PayoutAccount", ip: req.headers.get("x-forwarded-for")?.split(",")[0] } });
  return NextResponse.json(account);
}
