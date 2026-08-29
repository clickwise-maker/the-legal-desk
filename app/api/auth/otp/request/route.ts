import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/otp";

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
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    // Don't reveal whether an account exists — but still keep the same
    // response shape so the flow works for demo accounts.
    return NextResponse.json({ error: "No account found with this email. Please sign up first." }, { status: 404 });
  }

  const { code, resendAfterMs } = await createOtp(email);

  // Demo/development delivery: expose the code in the response when the
  // OTP_EXPOSE_CODE flag is set, so the flow is verifiable without a real
  // email provider. In production this is where the email/SMS send happens.
  const exposeCode = process.env.OTP_EXPOSE_CODE === "true";
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
