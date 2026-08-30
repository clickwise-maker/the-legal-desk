import { NextRequest, NextResponse } from "next/server";

type StoreEntry = { count: number; resetAt: number };

class InMemoryStore {
  private map = new Map<string, StoreEntry>();
  private timers = new Map<string, NodeJS.Timeout>();

  async incr(key: string): Promise<number> {
    const now = Date.now();
    let entry = this.map.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + 60_000 };
      this.map.set(key, entry);
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async get(key: string): Promise<StoreEntry | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.resetAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry;
  }

  async setWindow(key: string, _windowMs: number, resetAt: number) {
    const entry = this.map.get(key);
    if (entry) entry.resetAt = resetAt;
  }

  // For testing: clear all
  clear() {
    this.map.clear();
    for (const t of Array.from(this.timers.values())) clearTimeout(t);
    this.timers.clear();
  }
}

// Singleton store — in-memory for local, swap to Redis via same interface later.
// If Redis is configured, replace this with RedisStore (INCR + EXPIRE) without touching callers.
const store = new InMemoryStore();

// Track if store is reachable — fail-open
let storeHealthy = true;

function getEnvInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const rateLimitDefaults = {
  login: { max: getEnvInt("RATE_LIMIT_LOGIN_MAX", 5), windowSec: getEnvInt("RATE_LIMIT_LOGIN_WINDOW", 900) },
  otpRequest: { max: getEnvInt("RATE_LIMIT_OTP_REQUEST_MAX", 3), windowSec: getEnvInt("RATE_LIMIT_OTP_REQUEST_WINDOW", 600) },
  otpDaily: { max: getEnvInt("RATE_LIMIT_OTP_DAILY_MAX", 10), windowSec: getEnvInt("RATE_LIMIT_OTP_DAILY_WINDOW", 86400) },
  otpVerify: { max: getEnvInt("RATE_LIMIT_OTP_VERIFY_MAX", 5), windowSec: getEnvInt("RATE_LIMIT_OTP_VERIFY_WINDOW", 900) },
  passwordReset: { max: getEnvInt("RATE_LIMIT_PASSWORD_RESET_MAX", 3), windowSec: getEnvInt("RATE_LIMIT_PASSWORD_RESET_WINDOW", 3600) },
  copilot: { max: getEnvInt("RATE_LIMIT_COPILOT_MAX", 10), windowSec: getEnvInt("RATE_LIMIT_COPILOT_WINDOW", 60) },
  formPilot: { max: getEnvInt("RATE_LIMIT_FORM_PILOT_MAX", 10), windowSec: getEnvInt("RATE_LIMIT_FORM_PILOT_WINDOW", 60) },
  payment: { max: getEnvInt("RATE_LIMIT_PAYMENT_MAX", 5), windowSec: getEnvInt("RATE_LIMIT_PAYMENT_WINDOW", 60) },
};

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // NextRequest.ip is available in some runtimes
  const anyReq = req as unknown as { ip?: string };
  if (anyReq.ip) return anyReq.ip;
  return "unknown-ip";
}

async function getIdentifier(req: NextRequest): Promise<string> {
  // Prefer authenticated user ID if available via header (set by middleware) or fallback to IP.
  // To avoid circular import with next-auth, we use IP as primary; routes that have session can pass identifier explicitly.
  // This keeps the store swappable and fail-open.
  return `ip:${getIp(req)}`;
}

export type RateLimitOptions = {
  keyPrefix: string;
  max: number;
  windowSec: number;
  identifier?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
};

export async function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): Promise<RateLimitResult & { identifier: string }> {
  const identifier = opts.identifier ?? (await getIdentifier(req));
  const key = `${opts.keyPrefix}:${identifier}`;
  const windowMs = opts.windowSec * 1000;
  const now = Date.now();

  try {
    let entry = await store.get(key);
    if (!entry) {
      // First hit in window
      const resetAt = now + windowMs;
      // Use incr to create, then set correct window
      await store.incr(key);
      await store.setWindow(key, windowMs, resetAt);
      return { allowed: true, remaining: opts.max - 1, retryAfterSec: 0, limit: opts.max, identifier };
    }

    if (entry.count >= opts.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec), limit: opts.max, identifier };
    }

    const count = await store.incr(key);
    const remaining = Math.max(0, opts.max - count);
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    // If this was first incr after expiry, resetAt was updated above; otherwise keep
    return { allowed: true, remaining, retryAfterSec: 0, limit: opts.max, identifier };
  } catch (err) {
    // Fail-open: allow request but log
    console.error("[rateLimiter] store error, fail-open:", err);
    storeHealthy = false;
    return { allowed: true, remaining: opts.max, retryAfterSec: 0, limit: opts.max, identifier };
  }
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Retry-After": String(result.retryAfterSec),
      },
    }
  );
}

// For tests: expose store clear
export function _clearRateLimitStore() {
  store.clear();
}

export function isRateLimiterHealthy() {
  return storeHealthy;
}
