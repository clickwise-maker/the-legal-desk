import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const { action } = (body ?? {}) as { action?: string };

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (action === "cancel") {
    const isOwner =
      booking.clientId === session.user.id ||
      booking.lawyerId === session.user.id ||
      session.user.role === "ADMIN";
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking cannot be cancelled" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Refund wallet-paid bookings
      if (booking.paymentProvider === "WALLET") {
        const wallet = await tx.wallet.findUnique({ where: { userId: booking.clientId } });
        if (wallet) {
          await tx.wallet.update({
            where: { userId: booking.clientId },
            data: { balance: { increment: booking.price } },
          });
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              userId: booking.clientId,
              type: "BOOKING_REFUND",
              amount: booking.price,
              description: `Refund for cancelled consultation`,
              reference: booking.id,
            },
          });
        }
        // Claw back lawyer payout + commission
        const lawyerWallet = await tx.wallet.findUnique({ where: { userId: booking.lawyerId } });
        if (lawyerWallet) {
          await tx.wallet.update({
            where: { userId: booking.lawyerId },
            data: { balance: { decrement: booking.lawyerEarning } },
          });
          await tx.transaction.create({
            data: {
              walletId: lawyerWallet.id,
              userId: booking.lawyerId,
              type: "BOOKING_REFUND",
              amount: -booking.lawyerEarning,
              description: "Clawback: cancelled consultation payout",
              reference: booking.id,
            },
          });
        }
      }
      return tx.booking.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
      });
    });

    return NextResponse.json(updated);
  }

  if (action === "complete") {
    if (booking.lawyerId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: { status: "COMPLETED" },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
