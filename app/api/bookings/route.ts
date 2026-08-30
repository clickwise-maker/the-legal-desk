import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPaymentOrder } from "@/lib/payments/razorpay";
import { getSlotsForDate } from "@/lib/scheduling";
import { calcCommission } from "@/lib/constants";

const createSchema = z.object({
  lawyerProfileId: z.string().min(1),
  startTime: z.string().datetime(),
  title: z.string().min(1).max(120).default("Consultation"),
  description: z.string().max(1000).optional(),
  formId: z.string().optional(),
  payWith: z.enum(["RAZORPAY", "WALLET"]).default("RAZORPAY"),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = session.user.role;

  const where =
    role === "LAWYER"
      ? { lawyerId: session.user.id }
      : role === "ADMIN"
      ? {}
      : { clientId: session.user.id };

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, email: true } },
      lawyer: { select: { id: true, name: true, avatarUrl: true } },
      lawyerProfile: { select: { id: true, city: true } },
      form: { select: { id: true, title: true } },
      rating: { select: { id: true, score: true } },
    },
    orderBy: { startTime: "desc" },
    take: Number(searchParams.get("take") ?? 100),
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { keyPrefix: "payment:booking", max: rateLimitDefaults.payment.max, windowSec: rateLimitDefaults.payment.windowSec });
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { lawyerProfileId, startTime, title, description, formId, payWith } = parsed.data;

  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: lawyerProfileId },
    include: { availability: true, user: { select: { id: true, name: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Lawyer not found" }, { status: 404 });
  if (!profile.isAvailable) return NextResponse.json({ error: "Lawyer is currently unavailable" }, { status: 409 });

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  if (start < new Date()) return NextResponse.json({ error: "Cannot book a slot in the past" }, { status: 400 });

  // Ensure the slot is actually free (Cal.com-style slot verification)
  const slots = await getSlotsForDate(profile, start);
  const slotTaken = !slots.some((s) => s.getTime() === start.getTime());
  if (slotTaken) {
    return NextResponse.json({ error: "This slot is no longer available" }, { status: 409 });
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const { commissionAmount, lawyerEarning } = calcCommission(profile.hourlyRate, profile.commissionRate);

  // WALLET payment: debit immediately
  if (payWith === "WALLET") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
    if (!wallet || wallet.balance < profile.hourlyRate) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          clientId: session.user.id,
          lawyerId: profile.user.id,
          lawyerProfileId,
          title,
          description,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          price: profile.hourlyRate,
          commissionAmount,
          lawyerEarning,
          paymentProvider: "WALLET",
          paymentRef: `wallet-${Date.now()}`,
          formId,
        },
      });

      await tx.wallet.update({
        where: { userId: session.user.id },
        data: { balance: { decrement: profile.hourlyRate } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: session.user.id,
          type: "BOOKING_PAYMENT",
          amount: -profile.hourlyRate,
          description: `Consultation with ${profile.user.name ?? "lawyer"}`,
          reference: b.id,
        },
      });

      // Lawyer payout (88%) + commission record (12%)
      const lawyerWallet = await tx.wallet.findUnique({ where: { userId: profile.user.id } });
      if (lawyerWallet) {
        await tx.wallet.update({
          where: { userId: profile.user.id },
          data: { balance: { increment: lawyerEarning } },
        });
        await tx.transaction.create({
          data: {
            walletId: lawyerWallet.id,
            userId: profile.user.id,
            type: "LAWYER_PAYOUT",
            amount: lawyerEarning,
            description: `Consultation payout from ${session.user.name ?? "client"}`,
            reference: b.id,
          },
        });
        await tx.transaction.create({
          data: {
            walletId: lawyerWallet.id,
            userId: profile.user.id,
            type: "COMMISSION",
            amount: -commissionAmount,
            description: "LegalFlow 12% platform commission",
            reference: b.id,
          },
        });
      }

      return b;
    });

    return NextResponse.json({ bookingId: booking.id, status: "CONFIRMED", payWith: "WALLET" }, { status: 201 });
  }

  // RAZORPAY: create a pending booking + payment order
  const booking = await prisma.booking.create({
    data: {
      clientId: session.user.id,
      lawyerId: profile.user.id,
      lawyerProfileId,
      title,
      description,
      startTime: start,
      endTime: end,
      status: "PENDING",
      price: profile.hourlyRate,
      commissionAmount,
      lawyerEarning,
      paymentProvider: "RAZORPAY",
      formId,
    },
  });

  const order = await createPaymentOrder({
    amountInr: profile.hourlyRate,
    receipt: `booking_${booking.id}`,
    notes: { bookingId: booking.id, type: "BOOKING" },
  });

  return NextResponse.json({
    bookingId: booking.id,
    amountInr: profile.hourlyRate,
    orderId: order?.id ?? null,
    razorpayConfigured: Boolean(order),
  }, { status: 201 });
}
