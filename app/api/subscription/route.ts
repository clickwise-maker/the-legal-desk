import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSubscription } from "@/lib/billing/subscription";
import { getPlanPrice, listPlansForUser, detectPricingRegion, type Plan, type BillingPeriod } from "@/lib/billing/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { city: true, state: true, country: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const sub = await getOrCreateSubscription(session.user.id);
  const region = detectPricingRegion(user);
  const plans = listPlansForUser(user);
  const remaining = Math.max(0, sub.clientLimit - sub.clientsUsed);

  return NextResponse.json({
    subscription: sub,
    remaining,
    region,
    plans,
    wallet: await prisma.wallet.findUnique({ where: { userId: session.user.id } }),
  });
}
