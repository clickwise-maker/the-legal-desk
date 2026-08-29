import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SPECIALIZATIONS } from "@/lib/constants";
import { LandingCopilot } from "@/components/LandingCopilot";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const primaryCta = session?.user ? "/dashboard" : "/signup";
  const primaryLabel = session?.user ? "Go to Dashboard" : "Create free account";

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative bg-primary-700">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(214,158,46,0.18), transparent 45%), radial-gradient(circle at 80% 0%, rgba(47,85,168,0.5), transparent 50%)",
          }}
          aria-hidden="true"
        />
        <div className="container-legal relative py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="badge bg-white/10 text-gold-300 ring-1 ring-white/15">
                Lawyers · Forms · AI — unified
              </span>
              <h1 className="mt-5 font-heading text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                The legal desk,{" "}
                <span className="text-gold-300">reimagined.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-100">
                Book verified lawyers in minutes, upload any legal form and let
                AI fill it for you, then manage cases, payments and documents
                from one dashboard.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href={primaryCta} className="btn-gold text-base">
                  {primaryLabel}
                </Link>
                <Link href="/lawyers" className="btn text-base text-white ring-1 ring-white/30 hover:bg-white/10">
                  Browse lawyers
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-8">
                {[
                  ["50,000+", "forms filled"],
                  ["2,400+", "verified lawyers"],
                  ["₹0", "setup fees"],
                ].map(([stat, label]) => (
                  <div key={label}>
                    <div className="font-heading text-2xl font-bold text-white">{stat}</div>
                    <div className="text-sm text-primary-200">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="card p-6 shadow-gold">
                <div className="flex items-center justify-between border-b border-primary-100 pb-4">
                  <span className="font-heading font-bold text-primary-800">Rental Agreement</span>
                  <span className="badge bg-gold-50 text-gold-500 ring-1 ring-gold-100">AI Filled</span>
                </div>
                {[
                  ["Full name", "Aarav Sharma", 0.99],
                  ["Address", "MG Road, Bengaluru", 0.97],
                  ["Property type", "Apartment", 0.95],
                  ["Tenure (months)", "12", 0.93],
                ].map(([label, value, conf]) => (
                  <div key={label as string} className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-legal-muted">{label}</span>
                      <span className="font-semibold text-primary-800">{value}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-primary-50">
                      <div className="h-full rounded-full bg-gold-400" style={{ width: `${Number(conf) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mt-6 flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3">
                  <span className="text-sm text-primary-700">Confidence score</span>
                  <span className="font-heading text-lg font-bold text-primary-800">96%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature modules */}
      <section className="container-legal py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
            Three tools. One platform.
          </h2>
          <p className="mt-4 text-lg text-legal-muted">
            LegalFlow merges scheduling, a legal marketplace and AI form-filling
            into a single workflow.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="card p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-gold-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="mt-5 font-heading text-xl font-bold text-primary-800">Book Lawyers</h3>
            <p className="mt-3 text-sm leading-relaxed text-legal-muted">
              Browse verified lawyers by specialization, see live availability,
              and book consultations in minutes with secure payments.
            </p>
            <Link href="/lawyers" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold-500 hover:text-gold-400">
              Find a lawyer
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <div className="card p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-400 text-primary-900">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>
            <h3 className="mt-5 font-heading text-xl font-bold text-primary-800">AI Form Filling</h3>
            <p className="mt-3 text-sm leading-relaxed text-legal-muted">
              Upload a PDF or photo. OCR extracts it, AI detects every field and
              fills your answer — download the completed form for ₹5.
            </p>
            <Link href="/forms" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold-500 hover:text-gold-400">
              Fill a form
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <div className="card p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </div>
            <h3 className="mt-5 font-heading text-xl font-bold text-primary-800">Unified Dashboard</h3>
            <p className="mt-3 text-sm leading-relaxed text-legal-muted">
              Bookings, forms, cases and your wallet balance — all in one place,
              with a transparent transaction history.
            </p>
            <Link href="/dashboard" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-gold-500 hover:text-gold-400">
              Open dashboard
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Copilot launcher */}
      <LandingCopilot />

      {/* How it works */}
      <section className="border-y border-primary-100 bg-white py-20">
        <div className="container-legal">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
              From signup to signed in minutes
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              ["01", "Create your account", "Sign up with email. Optional: your profile speeds up AI form filling."],
              ["02", "Book a lawyer or upload a form", "Browse by specialization and slot — or drop a PDF/photo."],
              ["03", "AI does the paperwork", "OCR + DeepSeek extract, detect and fill every field automatically."],
              ["04", "Download or share", "Get the completed form, or share it directly with your lawyer."],
            ].map(([num, title, body]) => (
              <div key={num} className="relative">
                <div className="font-heading text-5xl font-black text-primary-100">{num}</div>
                <h3 className="mt-3 font-heading text-lg font-bold text-primary-800">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-legal-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specializations */}
      <section className="container-legal py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
            Every practice area covered
          </h2>
          <p className="mt-4 text-lg text-legal-muted">
            Connect with specialists across every major legal domain.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {SPECIALIZATIONS.map((s) => (
            <Link
              key={s}
              href={`/lawyers?q=${encodeURIComponent(s)}`}
              className="rounded-full border border-primary-200 bg-white px-5 py-2 text-sm font-medium text-primary-700 transition hover:border-gold-300 hover:text-gold-500"
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-800 py-16">
        <div className="container-legal text-center">
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">
            Ready to simplify your legal life?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-200">
            Join LegalFlow today. Book consultations, fill forms with AI, and
            manage everything from one dashboard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href={primaryCta} className="btn-gold text-base">
              {primaryLabel}
            </Link>
            <Link href="/lawyers" className="btn text-base text-white ring-1 ring-white/30 hover:bg-white/10">
              Explore lawyers
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
