import { prisma } from "@/lib/prisma";
import { getClientLimit, type Plan } from "./pricing";

function addPeriod(date: Date, period: "MONTHLY" | "YEARLY"): Date {
  const d = new Date(date);
  if (period === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getOrCreateSubscription(userId: string) {
  let sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub) {
    // Reset period if expired
    if (new Date() > sub.periodEnd) {
      const now = new Date();
      const periodEnd = addPeriod(now, sub.billingPeriod);
      sub = await prisma.subscription.update({
        where: { userId },
        data: { periodStart: now, periodEnd, clientsUsed: 0, status: "ACTIVE" },
      });
    }
    return sub;
  }
  const now = new Date();
  sub = await prisma.subscription.create({
    data: {
      userId,
      plan: "FREE",
      status: "ACTIVE",
      billingPeriod: "MONTHLY",
      clientLimit: getClientLimit("FREE"),
      clientsUsed: 0,
      periodStart: now,
      periodEnd: addPeriod(now, "MONTHLY"),
    },
  });
  return sub;
}

// Atomic increment with limit check — prevents race allowing 11th client.
export async function tryIncrementClientUsage(userId: string): Promise<
  | { ok: true; subscription: NonNullable<Awaited<ReturnType<typeof getOrCreateSubscription>>> }
  | { ok: false; subscription: NonNullable<Awaited<ReturnType<typeof getOrCreateSubscription>>>; reason: string }
> {
  const sub = await getOrCreateSubscription(userId);
  if (sub.clientsUsed >= sub.clientLimit) {
    return { ok: false, subscription: sub, reason: `Free monthly client limit reached (${sub.clientsUsed}/${sub.clientLimit})` };
  }
  // Atomic conditional update
  const updated = await prisma.subscription.updateMany({
    where: { userId, clientsUsed: { lt: sub.clientLimit }, periodEnd: sub.periodEnd },
    data: { clientsUsed: { increment: 1 } },
  });
  if (updated.count === 0) {
    const fresh = await prisma.subscription.findUnique({ where: { userId } });
    return { ok: false, subscription: fresh!, reason: "Limit reached (concurrent)" };
  }
  const fresh = await prisma.subscription.findUnique({ where: { userId } });
  return { ok: true, subscription: fresh! };
}

export async function decrementClientUsage(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId, clientsUsed: { gt: 0 } },
    data: { clientsUsed: { decrement: 1 } },
  });
}

export async function activateSubscription(opts: {
  userId: string;
  plan: Plan;
  billingPeriod: "MONTHLY" | "YEARLY";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
}) {
  const now = new Date();
  const periodEnd = addPeriod(now, opts.billingPeriod);
  const clientLimit = getClientLimit(opts.plan);
  const existing = await prisma.subscription.findUnique({ where: { userId: opts.userId } });
  if (existing) {
    return prisma.subscription.update({
      where: { userId: opts.userId },
      data: {
        plan: opts.plan,
        status: "ACTIVE",
        billingPeriod: opts.billingPeriod,
        clientLimit,
        periodStart: now,
        periodEnd,
        razorpayOrderId: opts.razorpayOrderId,
        razorpayPaymentId: opts.razorpayPaymentId,
        razorpaySubscriptionId: opts.razorpaySubscriptionId,
      },
    });
  }
  return prisma.subscription.create({
    data: {
      userId: opts.userId,
      plan: opts.plan,
      status: "ACTIVE",
      billingPeriod: opts.billingPeriod,
      clientLimit,
      clientsUsed: 0,
      periodStart: now,
      periodEnd,
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
      razorpaySubscriptionId: opts.razorpaySubscriptionId,
    },
  });
}
