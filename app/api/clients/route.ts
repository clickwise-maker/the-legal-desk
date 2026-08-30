import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSubscription, tryIncrementClientUsage, decrementClientUsage } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await prisma.client.findMany({ where: { ownerId: session.user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const sub = await getOrCreateSubscription(session.user.id);
  return NextResponse.json({ clients, subscription: sub, remaining: Math.max(0, sub.clientLimit - sub.clientsUsed) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Enforce 10-client monthly limit server-side with atomic increment
  const inc = await tryIncrementClientUsage(session.user.id);
  if (!inc.ok) {
    return NextResponse.json(
      {
        error: inc.reason,
        limitReached: true,
        currentPlan: inc.subscription.plan,
        clientsUsed: inc.subscription.clientsUsed,
        clientLimit: inc.subscription.clientLimit,
        upgradeAvailable: true,
        periodEnd: inc.subscription.periodEnd,
      },
      { status: 403 }
    );
  }

  try {
    const client = await prisma.client.create({
      data: {
        ownerId: session.user.id,
        name,
        email: body?.email ? String(body.email).trim() : null,
        phone: body?.phone ? String(body.phone).trim() : null,
        matterId: body?.matterId ? String(body.matterId) : null,
      },
    });
    return NextResponse.json({ client, subscription: inc.subscription }, { status: 201 });
  } catch (e) {
    // Roll back usage on failure
    await decrementClientUsage(session.user.id);
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const existing = await prisma.client.findFirst({ where: { id, ownerId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.client.delete({ where: { id } });
  await decrementClientUsage(session.user.id);
  return NextResponse.json({ ok: true });
}
