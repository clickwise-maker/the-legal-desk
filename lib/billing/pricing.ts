// Centralized pricing — single source of truth, server-side only.
// Priority for subscriptions: CITY → STATE → INDIA → INTERNATIONAL → default
// For Auto Form Fill: INDIA → INTERNATIONAL (city/state not needed)
// Never trust client-provided price or browser location — use DB user's country.

import type { User } from "@prisma/client";

export type Plan = "FREE" | "PRO" | "SCHEDULE_EARLY" | "SCHEDULE_VIP" | "VIP_ALL_IN_ONE" | "LAWYER_STATE_PRO" | "LAWYER_INTL_UNLIMITED";
export type BillingPeriod = "MONTHLY" | "YEARLY";
export type PricingRegion = "CITY" | "STATE" | "INDIA" | "INTERNATIONAL" | "DEFAULT";
export type Currency = "INR" | "USD";

export const AUTO_FORM_PRICING = {
  INDIA: { amount: 5, currency: "INR" as Currency },
  INTERNATIONAL: { amount: 1, currency: "USD" as Currency },
} as const;

// Keep legacy PRO for backward compat, but new lawyer lead plans are explicit
export const PLANS = {
  FREE: { priceMonthly: 0, priceYearly: 0, clientLimit: 10, label: "Free (10 clients)" },
  PRO: { priceMonthly: 499, priceYearly: 4990, clientLimit: 100, label: "Pro (100 clients)" },
  SCHEDULE_EARLY: { priceMonthly: 299, priceYearly: 2990, clientLimit: 0, label: "ScheduleAI Early" },
  SCHEDULE_VIP: { priceMonthly: 999, priceYearly: 9990, clientLimit: 0, label: "ScheduleAI VIP" },
  VIP_ALL_IN_ONE: { priceMonthly: 1999, priceYearly: 19900, clientLimit: 0, label: "VIP All-in-One" },
  LAWYER_STATE_PRO: { priceMonthly: 2999, priceYearly: 29990, clientLimit: 100, label: "State Pro (100 leads)" },
  LAWYER_INTL_UNLIMITED: { priceMonthly: 10000, priceYearly: 100000, clientLimit: 999999, label: "International Unlimited" },
} as const;

// Separate product pricing for location-aware ScheduleAI/VIP (India INR vs International USD)
export const SCHEDULE_AI_PRICING = {
  EARLY: { INDIA: { amount: 299, currency: "INR" as Currency }, INTERNATIONAL: { amount: 5, currency: "USD" as Currency } },
  VIP: { INDIA: { amount: 999, currency: "INR" as Currency }, INTERNATIONAL: { amount: 19, currency: "USD" as Currency } },
} as const;

export const VIP_PRICING = {
  INDIA: { amount: 1999, currency: "INR" as Currency },
  INTERNATIONAL: { amount: 39, currency: "USD" as Currency },
} as const;

export const LAWYER_LEAD_PRICING = {
  FREE: { INDIA: { amount: 0, currency: "INR" as Currency }, INTERNATIONAL: { amount: 0, currency: "INR" as Currency }, limit: 10 },
  STATE_PRO: { INDIA: { amount: 2999, currency: "INR" as Currency }, INTERNATIONAL: { amount: 2999, currency: "INR" as Currency }, limit: 100 },
  INTL_UNLIMITED: { INDIA: { amount: 10000, currency: "INR" as Currency }, INTERNATIONAL: { amount: 10000, currency: "INR" as Currency }, limit: 999999 },
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

export function isIndiaUser(user: Pick<User, "country">): boolean {
  const c = (user.country ?? "").trim().toLowerCase();
  return !c || c === "india" || c === "in" || c === "ind";
}

export function getAutoFormPrice(user: Pick<User, "country">): { amount: number; currency: Currency; region: "INDIA" | "INTERNATIONAL" } {
  if (isIndiaUser(user)) return { amount: AUTO_FORM_PRICING.INDIA.amount, currency: AUTO_FORM_PRICING.INDIA.currency, region: "INDIA" };
  return { amount: AUTO_FORM_PRICING.INTERNATIONAL.amount, currency: AUTO_FORM_PRICING.INTERNATIONAL.currency, region: "INTERNATIONAL" };
}

export function getWalletCurrency(user: Pick<User, "country">): Currency {
  return isIndiaUser(user) ? "INR" : "USD";
}

export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "USD") return `$${amount.toLocaleString("en-US", { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

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
}): { amountInr: number; amount: number; region: PricingRegion; currency: Currency } {
  const region = detectPricingRegion(opts.user);
  const isIndia = isIndiaUser(opts.user);

  // Handle product-specific pricing that varies by currency
  if (opts.plan === "SCHEDULE_EARLY") {
    const p = isIndia ? SCHEDULE_AI_PRICING.EARLY.INDIA : SCHEDULE_AI_PRICING.EARLY.INTERNATIONAL;
    const amount = opts.period === "YEARLY" ? p.amount * 10 : p.amount;
    return { amountInr: amount, amount, region, currency: p.currency };
  }
  if (opts.plan === "SCHEDULE_VIP") {
    const p = isIndia ? SCHEDULE_AI_PRICING.VIP.INDIA : SCHEDULE_AI_PRICING.VIP.INTERNATIONAL;
    const amount = opts.period === "YEARLY" ? p.amount * 10 : p.amount;
    return { amountInr: amount, amount, region, currency: p.currency };
  }
  if (opts.plan === "VIP_ALL_IN_ONE") {
    const p = isIndia ? VIP_PRICING.INDIA : VIP_PRICING.INTERNATIONAL;
    const amount = opts.period === "YEARLY" ? p.amount * 10 : p.amount;
    return { amountInr: amount, amount, region, currency: p.currency };
  }
  if (opts.plan === "LAWYER_STATE_PRO") {
    const p = LAWYER_LEAD_PRICING.STATE_PRO.INDIA;
    const amount = opts.period === "YEARLY" ? p.amount * 10 : p.amount;
    return { amountInr: amount, amount, region, currency: p.currency };
  }
  if (opts.plan === "LAWYER_INTL_UNLIMITED") {
    const p = LAWYER_LEAD_PRICING.INTL_UNLIMITED.INDIA;
    const amount = opts.period === "YEARLY" ? p.amount * 10 : p.amount;
    return { amountInr: amount, amount, region, currency: p.currency };
  }

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

  return { amountInr, amount: amountInr, region, currency: "INR" };
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
