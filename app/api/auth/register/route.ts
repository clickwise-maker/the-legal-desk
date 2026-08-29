import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(["CLIENT", "LAWYER"]).default("CLIENT"),
});

export async function POST(req: NextRequest) {
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
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone,
      role: role as UserRole,
      wallet: { create: { balance: 0 } },
    },
  });

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
