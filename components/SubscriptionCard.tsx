"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatINR } from "@/lib/constants";
import { Card } from "@/components/ui";

export function SubscriptionCard({
  plan,
  status,
  clientLimit,
  clientsUsed,
  remaining,
  periodEnd,
  periodStart,
  pricingRegion,
  city,
  state,
}: {
  plan: string;
  status: string;
  clientLimit: number;
  clientsUsed: number;
  remaining: number;
  periodEnd: string;
  periodStart: string;
  pricingRegion: string;
  city?: string | null;
  state?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isFree = plan === "FREE";
  const limitReached = clientsUsed >= clientLimit;

  async function handleUpgrade(period: "MONTHLY" | "YEARLY" = "MONTHLY") {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO", period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");

      // Test mode (no Razorpay keys) — verify directly. Real mode would open Razorpay Checkout here.
      // For real Razorpay, client would open checkout with data.orderId, then on handler call verify.
      if (!data.razorpayConfigured) {
        const verifyRes = await fetch("/api/subscription/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderId ?? data.pendingId,
            paymentId: `pay_${Date.now()}`,
            signature: "test_signature",
            plan: "PRO",
            period,
          }),
        });
        const v = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) throw new Error(v.error ?? "Verification failed");
        router.refresh();
        return;
      }

      // Real Razorpay flow — open checkout
      const { pay } = await import("@/lib/use-payment").then((m) => ({ pay: (window as unknown as { Razorpay?: unknown }) ? null : null }));
      // Fallback: redirect to pricing for full checkout (MVP)
      window.location.href = "/pricing";
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={`p-6 ${limitReached ? "border-amber-300 ring-2 ring-amber-200" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-primary-800">Current Plan</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isFree ? "bg-primary-100 text-primary-700" : "bg-gold-100 text-gold-700"}`}>
              {plan} {status !== "ACTIVE" ? `· ${status}` : ""}
            </span>
          </div>
          <div className="mt-2 text-sm text-legal-muted">
            Pricing region: <span className="font-semibold text-primary-700">{pricingRegion}</span>
            {city ? ` · ${city}` : ""} {state ? `, ${state}` : ""}
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            <div>
              <div className="text-legal-muted">Client usage</div>
              <div className="font-heading text-xl font-bold text-primary-800">
                {clientsUsed} / {clientLimit} clients
              </div>
            </div>
            <div>
              <div className="text-legal-muted">Remaining</div>
              <div className={`font-heading text-xl font-bold ${remaining === 0 ? "text-red-600" : "text-emerald-600"}`}>{remaining}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-legal-muted">
            Billing period: {formatDate(periodStart)} → {formatDate(periodEnd)} (resets {formatDate(periodEnd)})
          </div>
          {limitReached && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
              Free monthly client limit reached — upgrade to continue adding clients
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => handleUpgrade("MONTHLY")} disabled={loading} className="btn-gold disabled:opacity-50">
            {loading ? "Processing…" : limitReached ? "Upgrade Now" : "Upgrade Plan"}
          </button>
          <Link href="/pricing" className="btn-outline text-center text-sm">
            View Plans
          </Link>
        </div>
      </div>
    </Card>
  );
}
