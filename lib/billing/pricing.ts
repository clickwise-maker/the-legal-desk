// Centralized pricing — single source of truth, server-side only.
// Priority: CITY → STATE → INDIA → INTERNATIONAL → default
// Never trust client-provided price.

import type { User } from "@prisma/client";

export type Plan = "FREE" | "PRO";
export type BillingPeriod = "MONTHLY" | "YEARLY";
export type PricingRegion = "CITY" | "STATE" | "INDIA" | "INTERNATIONAL" | "DEFAULT";

export const PLANS = {
  FREE: { priceMonthly: 0, priceYearly: 0, clientLimit: 10, label: "Free" },
  PRO: { priceMonthly: 499, priceYearly: 4990, clientLimit: 100, label: "Pro" },
} as const;

// Optional city/state overrides — add entries without touching UI.
// Example: Mumbai PRO monthly is ₹599 instead of ₹499.
const CITY_OVERRIDES: Record<string, Partial<Record<Plan, number>>> = {
  // "Mumbai": { PRO: 599 },
};

const STATE_OVERRIDES: Record<string, Partial<Record<Plan, number>>> = {
  // "Maharashtra": { PRO: 549 },
};

const COUNTRY_OVERRIDES: Record<string, Partial<Record<Plan, number>>> = {
  // "United States": { PRO: 29 }, // could be USD later via currency layer
};

export function detectPricingRegion(user: Pick<User, "city" | "state" | "country">): PricingRegion {
  const city = user.city?.trim();
  const state = user.state?.trim();
  const country = (user.country ?? "").trim().toLowerCase();
  if (city && CITY_OVERRIDES[city]) return "CITY";
  if (state && STATE_OVERRIDES[state]) return "STATE";
  if (!country || country === "india" || country === "in") return "INDIA";
  return "INTERNATIONAL";
}

export function getPlanPrice(opts: {
  user: Pick<User, "city" | "state" | "country">;
  plan: Plan;
  period: BillingPeriod;
}): { amountInr: number; region: PricingRegion; currency: string } {
  const region = detectPricingRegion(opts.user);
  const base = opts.period === "YEARLY" ? PLANS[opts.plan].priceYearly : PLANS[opts.plan].priceMonthly;
  let amountInr: number = base;

  // Apply most-specific override
  const city = opts.user.city?.trim();
  const state = opts.user.state?.trim();
  const country = opts.user.country?.trim();
  if (city && CITY_OVERRIDES[city]?.[opts.plan] !== undefined) {
    amountInr = CITY_OVERRIDES[city][opts.plan]!;
  } else if (state && STATE_OVERRIDES[state]?.[opts.plan] !== undefined) {
    amountInr = STATE_OVERRIDES[state][opts.plan]!;
  } else if (country && COUNTRY_OVERRIDES[country]?.[opts.plan] !== undefined) {
    amountInr = COUNTRY_OVERRIDES[country][opts.plan]!;
  }

  return { amountInr, region, currency: "INR" };
}

export function getClientLimit(plan: Plan): number {
  return PLANS[plan].clientLimit;
}

export function listPlansForUser(user: Pick<User, "city" | "state" | "country">) {
  return (Object.keys(PLANS) as Plan[]).map((plan) => {
    const monthly = getPlanPrice({ user, plan, period: "MONTHLY" });
    const yearly = getPlanPrice({ user, plan, period: "YEARLY" });
    return { plan, label: PLANS[plan].label, clientLimit: PLANS[plan].clientLimit, monthly, yearly };
  });
}
