import Link from "next/link";
import { formatINR, PLATFORM_COMMISSION_PERCENT, FORM_FILL_PRICE } from "@/lib/constants";

const plans = [
  {
    name: "Starter",
    price: 0,
    period: "free forever",
    highlight: false,
    features: [
      "Create an account & profile",
      "Browse verified lawyers",
      "Wallet with deposits",
      "Upload forms (processing)",
    ],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Form Pilot",
    price: FORM_FILL_PRICE,
    period: "per filled form",
    highlight: true,
    features: [
      "OCR text extraction",
      "AI field detection",
      "Auto-fill from your profile",
      "Editable field review",
      "Download filled PDF",
      "Share with your lawyer",
    ],
    cta: "Fill a form",
    href: "/forms",
  },
  {
    name: "Consultations",
    price: null,
    period: `lawyer rates + ${PLATFORM_COMMISSION_PERCENT}% platform fee`,
    highlight: false,
    features: [
      "Hourly booking with verified lawyers",
      "Cal-style slot scheduling",
      "Secure Razorpay payments",
      "Ratings & reviews",
      "Wallet payouts for lawyers",
    ],
    cta: "Find a lawyer",
    href: "/lawyers",
  },
];

export default function PricingPage() {
  return (
    <div className="container-legal py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-legal-muted">
          Pay only for what you use. No subscriptions, no hidden fees.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`card p-8 ${p.highlight ? "border-gold-300 ring-2 ring-gold-200 shadow-gold" : ""}`}
          >
            <h2 className="font-heading text-xl font-bold text-primary-800">{p.name}</h2>
            <div className="mt-3">
              {p.price === null ? (
                <span className="font-heading text-3xl font-black text-primary-800">Lawyer rates</span>
              ) : (
                <>
                  <span className="font-heading text-4xl font-black text-primary-800">
                    {p.price === 0 ? "₹0" : formatINR(p.price)}
                  </span>
                  <span className="text-sm text-legal-muted"> {p.period}</span>
                </>
              )}
            </div>
            <ul className="mt-6 space-y-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-legal-muted">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href={p.href} className={`${p.highlight ? "btn-gold" : "btn-primary"} mt-8 w-full`}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <div className="card p-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">How payments work</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {[
              ["1", "Pay securely", "Bookings and form fills are paid via Razorpay (cards, UPI, netbanking)."],
              ["2", `${PLATFORM_COMMISSION_PERCENT}% commission`, `LegalFlow keeps ${PLATFORM_COMMISSION_PERCENT}% of every consultation. Lawyers receive ${100 - PLATFORM_COMMISSION_PERCENT}%.`],
              ["3", "Wallet payouts", "Lawyer earnings land in their wallet and can be withdrawn to their bank."],
            ].map(([title, body]) => (
              <div key={title}>
                <div className="font-heading text-lg font-bold text-gold-500">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-legal-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
