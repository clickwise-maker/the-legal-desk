import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentOrder } from "@/lib/payments/razorpay";
import { getPlanPrice, type Plan, type BillingPeriod } from "@/lib/billing/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = (String(body?.plan ?? "PRO").toUpperCase() as Plan);
  if (!["PRO"].includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  const period = (String(body?.period ?? "MONTHLY").toUpperCase() as BillingPeriod);
  if (!["MONTHLY", "YEARLY"].includes(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { city: true, state: true, country: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Server determines price — never trust client
  const { amountInr } = getPlanPrice({ user, plan, period });
  if (amountInr <= 0) return NextResponse.json({ error: "Invalid pricing" }, { status: 400 });

  const order = await createPaymentOrder({
    amountInr,
    receipt: `sub_${session.user.id}_${Date.now()}`,
    notes: { type: "SUBSCRIPTION", userId: session.user.id, plan, period },
  });

  // Create pending subscription transaction for idempotency (reuse Transaction)
  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const pending = await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      userId: session.user.id,
      type: "SUBSCRIPTION_PAYMENT",
      status: "PENDING",
      amount: amountInr,
      description: `Subscription ${plan} ${period}`,
      reference: order?.id ?? `pending_${Date.now()}`,
    },
  });

  return NextResponse.json({
    orderId: order?.id ?? null,
    amountInr,
    razorpayConfigured: Boolean(order),
    pendingId: pending.id,
    plan,
    period,
  });
}
