import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { getAutoFormPrice, getWalletCurrency, formatMoney } from "@/lib/billing/pricing";

const schema = z.object({
  type: z.enum(["BOOKING", "FORM", "DEPOSIT"]),
  referenceId: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Confirm a Razorpay payment for a booking, form fill, or wallet deposit.
 * When Razorpay is not configured (test mode), the payment is accepted.
 */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { keyPrefix: "payment:verify", max: rateLimitDefaults.payment.max, windowSec: rateLimitDefaults.payment.windowSec });
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { type, referenceId, orderId, paymentId, signature } = parsed.data;
  const verified = await verifyPaymentSignature({ orderId, paymentId, signature });
  if (!verified) {
    return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  if (type === "BOOKING") {
    const booking = await prisma.booking.findUnique({ where: { id: referenceId } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.clientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (booking.status !== "PENDING") {
      return NextResponse.json({ error: "Booking already processed" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          paymentRef: paymentId,
          paymentProvider: "RAZORPAY",
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: session.user.id,
          type: "BOOKING_PAYMENT",
          amount: -booking.price,
          description: `Consultation with ${booking.title}`,
          reference: booking.id,
        },
      });

      const lawyerWallet = await tx.wallet.findUnique({ where: { userId: booking.lawyerId } });
      if (lawyerWallet) {
        await tx.wallet.update({
          where: { userId: booking.lawyerId },
          data: { balance: { increment: booking.lawyerEarning } },
        });
        await tx.transaction.create({
          data: {
            walletId: lawyerWallet.id,
            userId: booking.lawyerId,
            type: "LAWYER_PAYOUT",
            amount: booking.lawyerEarning,
            description: `Consultation payout for "${booking.title}"`,
            reference: booking.id,
          },
        });
        await tx.transaction.create({
          data: {
            walletId: lawyerWallet.id,
            userId: booking.lawyerId,
            type: "COMMISSION",
            amount: -booking.commissionAmount,
            description: "LegalFlow 12% platform commission",
            reference: booking.id,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, type: "BOOKING" });
  }

  if (type === "FORM") {
    const form = await prisma.form.findUnique({ where: { id: referenceId } });
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    if (form.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (form.paymentRef) {
      return NextResponse.json({ error: "Form already paid", alreadyPaid: true }, { status: 409 });
    }
    if (form.status === "COMPLETED") {
      return NextResponse.json({ error: "Form already completed" }, { status: 409 });
    }
    // Server determines currency and price from user's country — never trust client
    const userProfile = await prisma.user.findUnique({ where: { id: session.user.id }, select: { country: true } });
    const { amount: formPrice, currency } = getAutoFormPrice(userProfile ?? { country: null });
    // Prevent duplicate transaction
    const existingTx = await prisma.transaction.findFirst({ where: { userId: session.user.id, type: "FORM_PAYMENT", reference: form.id, status: "SUCCESS" } });
    if (existingTx) return NextResponse.json({ error: "Already charged for this form" }, { status: 409 });

    // Ensure wallet currency matches — auto-create/migrate if needed, then atomic deduct
    let freshWallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
    if (!freshWallet) {
      freshWallet = await prisma.wallet.create({ data: { userId: session.user.id, balance: 0, currency } });
    }
    // If wallet currency mismatches but balance is 0, flip to correct currency; otherwise keep and error if mismatch
    if (freshWallet.currency !== currency) {
      if (freshWallet.balance === 0) {
        freshWallet = await prisma.wallet.update({ where: { userId: session.user.id }, data: { currency } });
      } else {
        return NextResponse.json(
          { error: `Wallet currency mismatch: wallet is ${freshWallet.currency}, form requires ${currency}. Please contact support or use correct region.` },
          { status: 409 }
        );
      }
    }
    if (freshWallet.balance < formPrice) {
      return NextResponse.json(
        { error: `Insufficient wallet balance. Need ${formatMoney(formPrice, currency)}, have ${formatMoney(freshWallet.balance, currency as "INR" | "USD")}` },
        { status: 402 }
      );
    }

    // Atomic transaction: wallet decrement + form complete + ledger
    let newBalance = 0;
    let remaining = 0;
    try {
      await prisma.$transaction(async (tx) => {
        const upd = await tx.wallet.updateMany({
          where: { userId: session.user.id, currency, balance: { gte: formPrice } },
          data: { balance: { decrement: formPrice } },
        });
        if (upd.count === 0) throw new Error("INSUFFICIENT_OR_RACE");
        await tx.form.update({
          where: { id: form.id },
          data: { status: "COMPLETED", paymentRef: paymentId },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: session.user.id,
            type: "FORM_PAYMENT",
            status: "SUCCESS",
            amount: -formPrice,
            currency,
            description: `AI Form Fill / FormPilot: ${form.title} (${currency})`,
            reference: form.id,
          },
        });
        const w = await tx.wallet.findUnique({ where: { userId: session.user.id } });
        newBalance = w?.balance ?? 0;
        remaining = Math.floor(newBalance / formPrice);
      });
    } catch (e) {
      if ((e as Error).message === "INSUFFICIENT_OR_RACE") {
        return NextResponse.json({ error: "Insufficient balance or concurrent deduction" }, { status: 402 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true, type: "FORM", currency, amount: formPrice, newBalance, remainingForms: remaining });
  }

  // DEPOSIT — add funds to the user's wallet
  if (type === "DEPOSIT") {
    const deposit = await prisma.transaction.findFirst({
      where: {
        walletId: wallet.id,
        type: "DEPOSIT",
        status: "PENDING",
        OR: [{ reference: referenceId }, { id: referenceId }],
      },
    });
    if (!deposit) {
      return NextResponse.json({ error: "No pending deposit found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { increment: deposit.amount } },
      });
      await tx.transaction.update({
        where: { id: deposit.id },
        data: { status: "SUCCESS" },
      });
    });

    return NextResponse.json({ ok: true, type: "DEPOSIT" });
  }

  return NextResponse.json({ error: "Unknown payment type" }, { status: 400 });
}
