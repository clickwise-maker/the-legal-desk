import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { activateSubscription } from "@/lib/billing/subscription";
import type { Plan, BillingPeriod } from "@/lib/billing/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orderId, paymentId, signature, plan, period } = body as {
    orderId: string;
    paymentId: string;
    signature: string;
    plan: Plan;
    period: BillingPeriod;
  };
  if (!orderId || !paymentId || !signature) return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });

  const verified = await verifyPaymentSignature({ orderId, paymentId, signature });
  if (!verified) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });

  // Idempotency: if this order already activated, return success
  const existingTx = await prisma.transaction.findFirst({
    where: { userId: session.user.id, type: "SUBSCRIPTION_PAYMENT", reference: orderId, status: "SUCCESS" },
  });
  if (existingTx) return NextResponse.json({ ok: true, alreadyVerified: true });

  const p: Plan = plan ?? "PRO";
  const b: BillingPeriod = period ?? "MONTHLY";

  await prisma.$transaction(async (tx) => {
    // Mark pending transaction success (find by orderId or recent pending)
    const pending = await tx.transaction.findFirst({
      where: { userId: session.user.id, type: "SUBSCRIPTION_PAYMENT", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      await tx.transaction.update({ where: { id: pending.id }, data: { status: "SUCCESS", reference: orderId } });
    }
  });

  const sub = await activateSubscription({
    userId: session.user.id,
    plan: p,
    billingPeriod: b,
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });

  return NextResponse.json({ ok: true, subscription: sub });
}
