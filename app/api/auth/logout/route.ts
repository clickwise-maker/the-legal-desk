import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Server-side logout helper: invalidates any pending (unused) OTP tokens
 * for the signed-in user so a stale code can never sign back in, then the
 * client clears the NextAuth session cookie via signOut().
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    await prisma.otp.updateMany({
      where: { email: session.user.email.toLowerCase(), usedAt: null },
      data: { usedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
