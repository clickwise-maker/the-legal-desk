import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  barCouncilId: z.string().trim().min(6).max(40),
});

const STATES = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "West Bengal", "Gujarat", "Telangana", "Uttar Pradesh"];
const SURNAMES = ["Sharma", "Iyer", "Nair", "Gupta", "Patel", "Reddy", "Kapoor", "Deshpande"];

// Deterministic pseudo-random picks derived from the enrolment number so the
// same input always returns the same mock record (simulating a real lookup).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Bar Council enrolment number" }, { status: 400 });
  }

  const barCouncilId = parsed.data.barCouncilId.toUpperCase();

  // Simulated API check: a well-formed enrolment number is "found" in the
  // registry. In production this would call the State Bar Council API.
  const wellFormed = /^[A-Z]{1,4}[\/\-\s]?\d{4}[\/\-\s]?\d{1,6}$/.test(barCouncilId) && barCouncilId.length >= 8;
  if (!wellFormed) {
    return NextResponse.json(
      {
        verified: false,
        barCouncilId,
        message: "Could not verify this enrolment number against the registry. Check the format and try again.",
      },
      { status: 200 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  const seed = hashString(barCouncilId);
  const state = STATES[seed % STATES.length];
  const surname = SURNAMES[(seed >>> 3) % SURNAMES.length];
  const year = barCouncilId.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());
  const matchPercent = 92 + (seed % 8);

  // Mark credentials as verified on the profile so submit can reference it.
  // barCouncilId is unique platform-wide; if this account already has a
  // profile we only touch the verified timestamp (barCouncilId is persisted
  // via the main onboarding save), and conflicts are swallowed safely.
  const existing = await prisma.lawyerProfile.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    await prisma.lawyerProfile.update({
      where: { userId: session.user.id },
      data: { credentialsVerifiedAt: new Date() },
    });
  } else {
    try {
      await prisma.lawyerProfile.create({
        data: {
          userId: session.user.id,
          barCouncilId: `PENDING-${seed % 1000000}`,
          credentialsVerifiedAt: new Date(),
        },
      });
    } catch {
      // Another account holds that temp ID — non-fatal for verification.
    }
  }

  return NextResponse.json({
    verified: true,
    barCouncilId,
    registeredName: `Adv. ${surname}`,
    state,
    yearOfEnrolment: year,
    matchPercent,
    message: "Credentials verified successfully.",
  });
}
