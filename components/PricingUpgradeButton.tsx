"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { Plan } from "@/lib/billing/pricing";

export function PricingUpgradeButton({ plan, period, label }: { plan: Plan; period: "MONTHLY" | "YEARLY"; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try {
      const checkoutRes = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const checkout = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkout.error ?? "Checkout failed");

      // Test mode: directly verify. Real Razorpay: would open checkout here.
      const verifyRes = await fetch("/api/subscription/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkout.orderId ?? checkout.pendingId,
          paymentId: `pay_${Date.now()}`,
          signature: "test_signature",
          plan,
          period,
        }),
      });
      const v = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(v.error ?? "Verification failed");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={handle} disabled={loading} className="btn-gold mt-8 w-full disabled:opacity-50">
      {loading ? "Processing…" : label}
    </button>
  );
}
