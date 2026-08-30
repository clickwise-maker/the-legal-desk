import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentOrder } from "@/lib/payments/razorpay";

const schema = z.object({
  amountInr: z.number().min(10).max(100000),
});

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { keyPrefix: "payment:deposit", max: rateLimitDefaults.payment.max, windowSec: rateLimitDefaults.payment.windowSec });
  if (!rl.allowed) return rateLimitResponse(rl);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Amount must be between ₹10 and ₹1,00,000" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const order = await createPaymentOrder({
    amountInr: parsed.data.amountInr,
    receipt: `deposit_${Date.now()}`,
    notes: { type: "DEPOSIT", userId: session.user.id },
  });

  // Record a pending deposit so the verify step can find it
  const pending = await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      userId: session.user.id,
      type: "DEPOSIT",
      status: "PENDING",
      amount: parsed.data.amountInr,
      description: "Wallet deposit",
      reference: order?.id ?? null,
    },
  });

  return NextResponse.json({
    orderId: order?.id ?? null,
    amountInr: parsed.data.amountInr,
    razorpayConfigured: Boolean(order),
    pendingId: pending.id,
  });
}
