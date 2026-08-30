import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "LAWYER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: lawyer only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category")?.trim();
  const location = searchParams.get("location")?.trim();

  // Expire stale holds server-side (3-day window)
  await prisma.problemHold.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });

  // Only OPEN problems are eligible
  const where: Record<string, unknown> = { status: "OPEN" };
  if (category) (where as Record<string, unknown>).category = { contains: category, mode: "insensitive" };
  if (location) (where as Record<string, unknown>).location = { contains: location, mode: "insensitive" };

  let problems = await prisma.legalProblem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      location: true,
      status: true,
      createdAt: true,
      owner: { select: { name: true } },
      _count: { select: { responses: true } },
    },
  });

  // Exclude problems that are on ACTIVE hold by another lawyer (3-day hold)
  const activeHolds = await prisma.problemHold.findMany({
    where: { problemId: { in: problems.map((p) => p.id) }, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { problemId: true, lawyerId: true },
  });
  const heldByOther = new Set(activeHolds.filter((h) => h.lawyerId !== session.user.id).map((h) => h.problemId));
  problems = problems.filter((p) => !heldByOther.has(p.id));

  // Privacy: expose only title/description/category/location + owner's first name, never email/phone
  const safe = problems.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    location: p.location,
    status: p.status,
    createdAt: p.createdAt,
    ownerFirstName: p.owner.name.split(" ")[0],
    responseCount: p._count.responses,
  }));

  // Remaining monthly allowance for this lawyer
  const { getOrCreateSubscription } = await import("@/lib/billing/subscription");
  const sub = await getOrCreateSubscription(session.user.id);
  const remaining = Math.max(0, sub.clientLimit - sub.clientsUsed);

  return NextResponse.json({ problems: safe, remaining, limit: sub.clientLimit, used: sub.clientsUsed });
}
