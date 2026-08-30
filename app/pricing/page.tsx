import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatINR, PLATFORM_COMMISSION_PERCENT, FORM_FILL_PRICE } from "@/lib/constants";
import { getPlanPrice } from "@/lib/billing/pricing";
import { PricingUpgradeButton } from "@/components/PricingUpgradeButton";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { city: true, state: true, country: true } })
    : null;
  const guestUser = user ?? { city: null, state: null, country: "India" };
  const freePrice = getPlanPrice({ user: guestUser, plan: "FREE", period: "MONTHLY" });
  const proMonthly = getPlanPrice({ user: guestUser, plan: "PRO", period: "MONTHLY" });
  const proYearly = getPlanPrice({ user: guestUser, plan: "PRO", period: "YEARLY" });

  return (
    <div className="container-legal py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">Simple, transparent pricing</h1>
        <p className="mt-4 text-lg text-legal-muted">Subscription plans + pay-per-use FormPilot. Location-aware pricing.</p>
        <p className="mt-2 text-sm text-legal-muted">
          Pricing region: <span className="font-semibold text-primary-700">{freePrice.region}</span> · Server determines final amount
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-4">
        {/* FREE */}
        <div className="card p-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">Free</h2>
          <div className="mt-3">
            <span className="font-heading text-4xl font-black text-primary-800">₹0</span>
            <span className="text-sm text-legal-muted"> /month</span>
          </div>
          <ul className="mt-6 space-y-3">
            {["10 clients / month", "Basic platform access", "Wallet & transactions", "Community support"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-legal-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {f}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-primary mt-8 w-full">Start free</Link>
        </div>

        {/* PRO MONTHLY */}
        <div className="card p-8 border-gold-300 ring-2 ring-gold-200 shadow-gold">
          <h2 className="font-heading text-xl font-bold text-primary-800">Pro</h2>
          <div className="mt-3">
            <span className="font-heading text-4xl font-black text-primary-800">{formatINR(proMonthly.amountInr)}</span>
            <span className="text-sm text-legal-muted"> /month</span>
          </div>
          <ul className="mt-6 space-y-3">
            {["100 clients / month", "Priority support", "Advanced Copilot", "Matter workspaces"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-legal-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {f}
              </li>
            ))}
          </ul>
          <PricingUpgradeButton plan="PRO" period="MONTHLY" label="Upgrade Now" />
        </div>

        {/* PRO YEARLY */}
        <div className="card p-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">Pro Yearly</h2>
          <div className="mt-3">
            <span className="font-heading text-4xl font-black text-primary-800">{formatINR(proYearly.amountInr)}</span>
            <span className="text-sm text-legal-muted"> /year</span>
          </div>
          <ul className="mt-6 space-y-3">
            {["100 clients / month", "Save 17% yearly", "All Pro features", "Matter workspaces"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-legal-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {f}
              </li>
            ))}
          </ul>
          <PricingUpgradeButton plan="PRO" period="YEARLY" label="Upgrade Now" />
        </div>

        {/* FORM PILOT */}
        <div className="card p-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">FormPilot</h2>
          <div className="mt-3">
            <span className="font-heading text-4xl font-black text-primary-800">{formatINR(FORM_FILL_PRICE)}</span>
            <span className="text-sm text-legal-muted"> per filled form</span>
          </div>
          <ul className="mt-6 space-y-3">
            {["OCR + AI field detection", "Auto-fill from profile", "Editable review", "Download filled PDF"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-legal-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {f}
              </li>
            ))}
          </ul>
          <Link href="/forms" className="btn-primary mt-8 w-full">Fill a form</Link>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <div className="card p-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">How payments work</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {[
              ["1", "Pay securely", "Subscriptions and form fills via Razorpay (cards, UPI, netbanking)."],
              ["2", `${PLATFORM_COMMISSION_PERCENT}% commission`, `LegalFlow keeps ${PLATFORM_COMMISSION_PERCENT}% of every consultation.`],
              ["3", "Wallet payouts", "Lawyer earnings land in wallet and can be withdrawn."],
            ].map(([a, b, c]) => (
              <div key={a}>
                <div className="font-heading text-lg font-bold text-gold-500">{a}</div>
                <p className="mt-1 text-sm font-semibold text-primary-800">{b}</p>
                <p className="mt-1 text-sm leading-relaxed text-legal-muted">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
