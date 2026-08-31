import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRazorpay } from "@/lib/payments/razorpay";
import { z } from "zod";

const schema = z.object({ paymentId: z.string().min(5), amount: z.number().positive().optional(), reason: z.string().max(200).optional() }).strict();

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { paymentId, amount, reason } = parsed.data;

  // Check existing refund to prevent duplicate
  const existing = await prisma.transaction.findFirst({ where: { reference: paymentId, type: "BOOKING_REFUND", status: "SUCCESS" } });
  if (existing) return NextResponse.json({ error: "Already refunded", alreadyRefunded: true }, { status: 409 });

  // Create REFUND_REQUESTED
  const wallet = await prisma.wallet.findFirst({ where: { userId: session.user.id } });
  const pending = await prisma.transaction.create({
    data: {
      walletId: wallet?.id ?? (await prisma.wallet.findFirst({ where: { userId: session.user.id } }))!.id,
      userId: session.user.id,
      type: "BOOKING_REFUND",
      status: "PENDING",
      amount: amount ?? 0,
      description: `Refund requested for ${paymentId}${reason ? `: ${reason}` : ""}`,
      reference: paymentId,
    },
  });

  // Try Razorpay refund
  const rzp = getRazorpay();
  if (!rzp) {
    // No Razorpay configured — mark as REFUND_FAILED, keep ledger pending
    await prisma.transaction.update({ where: { id: pending.id }, data: { status: "FAILED", description: pending.description + " — Razorpay not configured" } });
    await prisma.auditLog.create({ data: { actorId: session.user.id, action: "REFUND_FAILED", targetId: paymentId, targetType: "Payment", meta: { reason: "Razorpay not configured" } } });
    return NextResponse.json({ ok: false, status: "REFUND_FAILED", error: "Razorpay not configured" }, { status: 500 });
  }

  try {
    await prisma.transaction.update({ where: { id: pending.id }, data: { status: "PENDING", description: pending.description + " — REFUND_PROCESSING" } });
    // @ts-ignore — razorpay types don't include payments.refund
    const refund = await (rzp as unknown as { payments: { refund: (id: string, opts?: { amount?: number }) => Promise<unknown> } }).payments.refund(paymentId, amount ? { amount: Math.round(amount * 100) } : undefined);
    await prisma.transaction.update({ where: { id: pending.id }, data: { status: "SUCCESS", description: pending.description + " — REFUND_SUCCESS" } });
    await prisma.auditLog.create({ data: { actorId: session.user.id, action: "REFUND_SUCCESS", targetId: paymentId, targetType: "Payment", meta: { refund: refund as object } } });
    return NextResponse.json({ ok: true, status: "REFUND_SUCCESS", refund });
  } catch (e) {
    await prisma.transaction.update({ where: { id: pending.id }, data: { status: "FAILED", description: pending.description + ` — REFUND_FAILED: ${(e as Error).message}` } });
    await prisma.auditLog.create({ data: { actorId: session.user.id, action: "REFUND_FAILED", targetId: paymentId, targetType: "Payment", meta: { error: (e as Error).message } as object } });
    return NextResponse.json({ ok: false, status: "REFUND_FAILED", error: (e as Error).message }, { status: 500 });
  }
}
