import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";

// Strict Zod, no extra fields allowed via .strict() at handler level, but we also strip.
const createSchema = z
  .object({
    title: z.string().min(5).max(120).trim(),
    description: z.string().min(20).max(5000).trim(),
    category: z.string().min(2).max(50).trim(),
    location: z.string().max(100).trim().optional().nullable(),
  })
  .strict();

function sanitizeText(s: string): string {
  // Prevent XSS: strip <script, on* handlers, encode < >
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 5000);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const problems = await prisma.legalProblem.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });
  return NextResponse.json(problems);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10/hour/user
  const rl = await checkRateLimit(req, {
    keyPrefix: "problems:create",
    max: 10,
    windowSec: 3600,
    identifier: `user:${session.user.id}`,
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Reject unexpected fields via strict, but also ensure no extra keys after
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data = parsed.data;
  // Sanitize to prevent XSS
  const title = sanitizeText(data.title);
  const description = sanitizeText(data.description);
  const category = sanitizeText(data.category);
  const location = data.location ? sanitizeText(data.location) : null;

  // Enforce IDOR: owner is session user, no client-provided ownerId
  const problem = await prisma.legalProblem.create({
    data: { ownerId: session.user.id, title, description, category, location },
  });
  return NextResponse.json(problem, { status: 201 });
}
