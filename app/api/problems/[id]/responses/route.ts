import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";
import { getOrCreateSubscription, tryIncrementClientUsage } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

const responseSchema = z.object({ message: z.string().min(20).max(2000).trim() }).strict();

function sanitizeText(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 2000);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const problem = await prisma.legalProblem.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only owner or responder or admin can see responses
  const isOwner = problem.ownerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isResponder = await prisma.lawyerResponse.findFirst({ where: { problemId: params.id, lawyerId: session.user.id }, select: { id: true } });
  if (!isOwner && !isResponder && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const responses = await prisma.lawyerResponse.findMany({
    where: { problemId: params.id },
    orderBy: { createdAt: "asc" },
    include: {
      lawyer: { select: { id: true, name: true, avatarUrl: true } },
      lawyerProfile: { select: { city: true, experienceYears: true, isVerified: true, bio: true } },
    },
  });

  // Strip private lawyer info: only public profile fields, no email/phone
  const safe = responses.map((r) => ({
    id: r.id,
    message: r.message,
    createdAt: r.createdAt,
    lawyer: { name: r.lawyer.name, avatarUrl: r.lawyer.avatarUrl, city: r.lawyerProfile.city, experienceYears: r.lawyerProfile.experienceYears, isVerified: r.lawyerProfile.isVerified },
  }));

  return NextResponse.json(safe);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "LAWYER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: lawyer only" }, { status: 403 });
  }

  // Rate limit: 5/minute/lawyer
  const rl = await checkRateLimit(req, {
    keyPrefix: "lawyer:response",
    max: 5,
    windowSec: 60,
    identifier: `user:${session.user.id}`,
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const problem = await prisma.legalProblem.findUnique({ where: { id: params.id } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (problem.status !== "OPEN") return NextResponse.json({ error: "Problem is not open" }, { status: 409 });
  if (problem.ownerId === session.user.id) return NextResponse.json({ error: "Cannot respond to own problem" }, { status: 403 });

  // One response per lawyer per problem
  const existing = await prisma.lawyerResponse.findUnique({ where: { problemId_lawyerId: { problemId: params.id, lawyerId: session.user.id } } });
  if (existing) return NextResponse.json({ error: "You have already responded to this problem" }, { status: 409 });

  // Get lawyer profile
  const profile = await prisma.lawyerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Lawyer profile not found" }, { status: 400 });

  // Enforce monthly allowance: FREE 10/month — atomic via subscription
  const sub = await getOrCreateSubscription(session.user.id);
  if (sub.clientsUsed >= sub.clientLimit) {
    return NextResponse.json(
      { error: `Monthly response limit reached (${sub.clientsUsed}/${sub.clientLimit}). Upgrade to continue.`, limitReached: true },
      { status: 429 }
    );
  }

  // Check for active hold by another lawyer (3-day hold, server-side expiry)
  const activeHold = await prisma.problemHold.findFirst({
    where: { problemId: params.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
  });
  if (activeHold && activeHold.lawyerId !== session.user.id) {
    return NextResponse.json({ error: "This problem is currently on hold by another lawyer. Try again later." }, { status: 409 });
  }

  // Atomic increment + create response + 3-day hold (ACTIVE → EXPIRED after 3 days, then AVAILABLE again)
  let response;
  try {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.subscription.updateMany({
        where: { userId: session.user.id, clientsUsed: { lt: sub.clientLimit } },
        data: { clientsUsed: { increment: 1 } },
      });
      if (upd.count === 0) throw new Error("LIMIT_REACHED");
      response = await tx.lawyerResponse.create({
        data: {
          problemId: params.id,
          lawyerId: session.user.id,
          lawyerProfileId: profile.id,
          message: sanitizeText(parsed.data.message),
        },
      });
      // Create 3-day auditable hold
      await tx.problemHold.create({
        data: {
          problemId: params.id,
          lawyerId: session.user.id,
          lawyerProfileId: profile.id,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
    });
  } catch (e) {
    if ((e as Error).message === "LIMIT_REACHED") {
      return NextResponse.json({ error: "Monthly response limit reached" }, { status: 429 });
    }
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "You have already responded to this problem" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json(response, { status: 201 });
}
