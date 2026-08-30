import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/otp";

const schema = z.object({ email: z.string().email() });

/**
 * Resend OTP — creates a fresh code for the same email, enforcing the
 * resend cooldown so users can't spam their own inbox.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    return NextResponse.json(
      { ok: true, email, resendAfterMs: 0, note: "If an account exists for this email, an OTP has been sent." },
      { status: 200 }
    );
  }

  const { code, resendAfterMs } = await createOtp(email);
  if (!code) {
    return NextResponse.json(
      { error: "Too soon to resend. Please wait a moment.", resendAfterMs },
      { status: 429 }
    );
  }

  const exposeCode = process.env.OTP_EXPOSE_CODE === "true" && process.env.NODE_ENV !== "production";
  return NextResponse.json({
    ok: true,
    email,
    resendAfterMs,
    devCode: exposeCode ? code : undefined,
    note: exposeCode ? "Dev mode: OTP returned in response for testing." : "New OTP sent to your email.",
  });
}
