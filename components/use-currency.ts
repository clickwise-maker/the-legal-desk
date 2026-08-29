"use client";

import { useMemo } from "react";
import { detectCountryClient, getCurrency, formatRate, type Currency } from "@/lib/currency";

export function useCurrency(): { currency: Currency; format: (inr: number) => string } {
  return useMemo(() => {
    const currency = getCurrency(detectCountryClient());
    return {
      currency,
      format: (inr: number) => formatRate(inr, currency),
    };
  }, []);
}
