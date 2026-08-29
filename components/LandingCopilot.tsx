"use client";

import Link from "next/link";

const QUICK_ACTIONS = [
  {
    label: "Book Lawyers",
    desc: "Verified advocates, live availability, escrow-protected payment.",
    href: "/lawyers",
  },
  {
    label: "Fill a Form",
    desc: "Upload any legal form — auto-fill from your profile in minutes.",
    href: "/forms",
  },
  {
    label: "My Dashboard",
    desc: "Forms, bookings, wallet balance and transactions in one place.",
    href: "/dashboard",
  },
];

export function LandingCopilot() {
  return (
    <section className="border-y border-primary-100 bg-primary-50/50 py-20">
      <div className="container-legal">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="badge bg-gold-50 text-gold-500 ring-1 ring-gold-100">LegalFlow Copilot</span>
            <h2 className="mt-4 font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
              Ask anything. The desk answers.
            </h2>
            <p className="mt-4 text-lg text-legal-muted">
              Get instant help booking a lawyer, filling a form from your saved
              profile, or understanding your dashboard — with clear guidance on
              fees and escrow before you commit.
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("legalflow:copilot:open"))}
              className="btn-gold mt-6 text-base"
            >
              Chat with the Copilot
            </button>
            <Link
              href="/copilot"
              className="mt-3 ml-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-gold-500"
            >
              Open full Copilot workspace
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <p className="mt-3 text-xs text-legal-muted">
              The Copilot is available on every page via the gold chat bubble.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {QUICK_ACTIONS.map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="font-heading text-base font-bold text-primary-800">{a.label}</span>
                <p className="mt-2 text-sm leading-relaxed text-legal-muted">{a.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-500">
                  Open
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
