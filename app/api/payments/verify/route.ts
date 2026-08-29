import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";

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

    await prisma.$transaction(async (tx) => {
      await tx.form.update({
        where: { id: form.id },
        data: { status: "COMPLETED", paymentRef: paymentId },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: session.user.id,
          type: "FORM_PAYMENT",
          amount: -form.price,
          description: `AI form filling: ${form.title}`,
          reference: form.id,
        },
      });
    });

    return NextResponse.json({ ok: true, type: "FORM" });
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
