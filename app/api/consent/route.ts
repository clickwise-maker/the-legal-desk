import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEGAL_POLICY_VERSION } from "@/lib/legal/policy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ consented: false, version: LEGAL_POLICY_VERSION, requiresAuth: true });
  }
  const consent = await prisma.legalConsent.findUnique({
    where: { userId_version: { userId: session.user.id, version: LEGAL_POLICY_VERSION } },
  });
  return NextResponse.json({ consented: Boolean(consent), version: LEGAL_POLICY_VERSION, consent });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const agreed = Boolean(body?.agreed);
  const version = String(body?.version ?? LEGAL_POLICY_VERSION);
  if (!agreed) return NextResponse.json({ error: "You must agree to continue" }, { status: 400 });
  if (version !== LEGAL_POLICY_VERSION) return NextResponse.json({ error: "Policy version mismatch. Please refresh." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const consent = await prisma.legalConsent.upsert({
    where: { userId_version: { userId: session.user.id, version } },
    update: {},
    create: { userId: session.user.id, version, ipAddress: ip, userAgent: ua },
  });

  return NextResponse.json({ ok: true, consent });
}
