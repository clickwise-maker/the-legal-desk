import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(["CLIENT", "LAWYER"]).default("CLIENT"),
});

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    keyPrefix: "auth:register",
    max: rateLimitDefaults.login.max,
    windowSec: rateLimitDefaults.login.windowSec,
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password, phone, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = phone ? phone.trim().replace(/\s+/g, "") : null;

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  if (normalizedPhone) {
    const phoneExists = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
    if (phoneExists) return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        phone: normalizedPhone,
        role: role as UserRole,
        wallet: { create: { balance: 0 } },
      },
    });
  } catch (e) {
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (err.code === "P2002" && err.meta?.target?.includes("email")) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    if (err.code === "P2002" && err.meta?.target?.includes("phone")) {
      return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 });
    }
    throw e;
  }

  if (role === "LAWYER") {
    await prisma.lawyerProfile.create({
      data: {
        userId: user.id,
        barCouncilId: `BC-${user.id.slice(0, 8).toUpperCase()}`,
        commissionRate: 12,
      },
    });
  }

  return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
}
