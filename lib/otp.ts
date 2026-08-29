import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate and persist a fresh OTP for an email. Enforces a resend
 * cooldown and returns the raw code (the caller decides how to deliver
 * it — email provider, SMS, or demo response).
 */
export async function createOtp(email: string): Promise<{ code: string; resendAfterMs: number }> {
  const normalized = email.toLowerCase().trim();

  const last = await prisma.otp.findFirst({
    where: { email: normalized, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      return { code: "", resendAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed };
    }
    // Expired cooldown — invalidate the previous code so only one is live.
    await prisma.otp.updateMany({ where: { email: normalized, usedAt: null }, data: { usedAt: new Date() } });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hash(code, 10);

  await prisma.otp.create({
    data: { email: normalized, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  return { code, resendAfterMs: 0 };
}

export type OtpCheckResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Verify an OTP code. Single-use, expiry-checked, with an attempt cap.
 */
export async function verifyOtp(email: string, code: string): Promise<OtpCheckResult> {
  const normalized = email.toLowerCase().trim();

  const record = await prisma.otp.findFirst({
    where: { email: normalized, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, error: "No active OTP for this email. Request a new code." };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This OTP has expired. Request a new one." };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new OTP." };
  }

  const matches = await compare(code.trim(), record.codeHash);
  if (!matches) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect OTP. Please try again." };
  }

  await prisma.otp.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return { ok: true, email: normalized };
}
