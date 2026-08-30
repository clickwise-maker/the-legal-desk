import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/otp";
import { checkRateLimit, rateLimitResponse, rateLimitDefaults } from "@/lib/rateLimiter";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Rate limit: 3 per 10 min + 10 per day per email (fail-open, same message to avoid enumeration)
  const rlShort = await checkRateLimit(req, {
    keyPrefix: "otp:request",
    max: rateLimitDefaults.otpRequest.max,
    windowSec: rateLimitDefaults.otpRequest.windowSec,
    identifier: `email:${email}`,
  });
  if (!rlShort.allowed) return rateLimitResponse(rlShort);
  const rlDaily = await checkRateLimit(req, {
    keyPrefix: "otp:request:daily",
    max: rateLimitDefaults.otpDaily.max,
    windowSec: rateLimitDefaults.otpDaily.windowSec,
    identifier: `email:${email}`,
  });
  if (!rlDaily.allowed) return rateLimitResponse(rlDaily);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    // Prevent enumeration — return generic success without creating OTP or exposing existence.
    return NextResponse.json(
      { ok: true, email, expiresInSec: 600, resendAfterMs: 0, note: "If an account exists for this email, an OTP has been sent." },
      { status: 200 }
    );
  }

  const { code, resendAfterMs } = await createOtp(email);

  // Demo/development delivery: expose code only in non-production when flag is set.
  const exposeCode = process.env.OTP_EXPOSE_CODE === "true" && process.env.NODE_ENV !== "production";
  const devCode = exposeCode ? code : undefined;

  return NextResponse.json({
    ok: true,
    email,
    expiresInSec: 600,
    resendAfterMs,
    devCode,
    note: exposeCode ? "Dev mode: OTP returned in response for testing." : "OTP sent to your email.",
  });
}
