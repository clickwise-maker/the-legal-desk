import type { NextRequest } from "next/server";

export type Currency = {
  code: string;
  symbol: string;
  rateToInr: number;
};

// Display currency per country (detected from request headers).
export const CURRENCIES: Record<string, Currency> = {
  IN: { code: "INR", symbol: "₹", rateToInr: 1 },
  US: { code: "USD", symbol: "$", rateToInr: 0.012 },
  CA: { code: "CAD", symbol: "C$", rateToInr: 0.016 },
  GB: { code: "GBP", symbol: "£", rateToInr: 0.0095 },
  AE: { code: "AED", symbol: "د.إ", rateToInr: 0.044 },
  SG: { code: "SGD", symbol: "S$", rateToInr: 0.016 },
  AU: { code: "AUD", symbol: "A$", rateToInr: 0.018 },
  DE: { code: "EUR", symbol: "€", rateToInr: 0.011 },
  FR: { code: "EUR", symbol: "€", rateToInr: 0.011 },
  IT: { code: "EUR", symbol: "€", rateToInr: 0.011 },
  NL: { code: "EUR", symbol: "€", rateToInr: 0.011 },
  ES: { code: "EUR", symbol: "€", rateToInr: 0.011 },
};

export const DEFAULT_CURRENCY = CURRENCIES.IN;

/**
 * Detect the user's country from the incoming request. Prefers the
 * Vercel-style `x-vercel-ip-country` header, falls back to
 * `accept-language`, then to India.
 */
export function detectCountry(req: NextRequest): string {
  const geo = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry");
  if (geo && CURRENCIES[geo.toUpperCase()]) return geo.toUpperCase();

  const lang = req.headers.get("accept-language") ?? "";
  const m = lang.match(/(?:^|,)([a-z]{2})(?:-|,|$)/i);
  if (m) {
    const cc = m[1].toUpperCase();
    if (CURRENCIES[cc]) return cc;
  }
  return "IN";
}

export function getCurrency(country?: string): Currency {
  if (country && CURRENCIES[country.toUpperCase()]) return CURRENCIES[country.toUpperCase()];
  return DEFAULT_CURRENCY;
}

/**
 * Detect country client-side from the browser locale (used by client
 * components that have no access to request headers).
 */
export function detectCountryClient(): string {
  if (typeof navigator === "undefined") return "IN";
  const tag = navigator.language ?? "en-IN";
  const m = tag.match(/(?:^|-)([a-z]{2})$/i);
  if (m && CURRENCIES[m[1].toUpperCase()]) return m[1].toUpperCase();
  return "IN";
}

/**
 * Format an INR-denominated hourly rate in the user's display currency.
 * Rates are always stored in INR; the symbol is converted for display.
 */
export function formatRate(inr: number, currency: Currency): string {
  const converted = Math.round(inr * currency.rateToInr);
  if (currency.code === "INR") {
    return `₹${converted.toLocaleString("en-IN")}`;
  }
  return `${currency.symbol}${converted.toLocaleString("en-US")}`;
}
