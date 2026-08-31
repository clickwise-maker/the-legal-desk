import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatDate, formatINR, initials } from "@/lib/constants";
import { StatusBadge, Badge, Card } from "@/components/ui";
import { WalletCard } from "@/components/WalletCard";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { getOrCreateSubscription } from "@/lib/billing/subscription";
import { detectPricingRegion, getAutoFormPrice, getWalletCurrency, formatMoney } from "@/lib/billing/pricing";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;

  const [bookings, forms, wallet, lawyerProfile, upcoming, profileItems, profileUser, subscription, cityStateCountry, clients, legalProblems, lawyerStats] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: userId },
      include: {
        lawyer: { select: { name: true, avatarUrl: true } },
        lawyerProfile: { select: { city: true } },
        form: { select: { title: true } },
        rating: { select: { score: true } },
      },
      orderBy: { startTime: "desc" },
      take: 8,
    }),
    prisma.form.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { fields: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 6 } },
    }),
    role === "LAWYER" ? prisma.lawyerProfile.findUnique({ where: { userId } }) : Promise.resolve(null),
    prisma.booking.findMany({
      where: {
        clientId: userId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: new Date() },
      },
      include: { lawyer: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    prisma.profileItem.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, address: true, city: true, state: true, country: true, pincode: true, dateOfBirth: true, occupation: true, companyName: true },
    }),
    getOrCreateSubscription(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { city: true, state: true, country: true } }),
    prisma.client.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.legalProblem.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" }, take: 5, include: { _count: { select: { responses: true } } } }),
    role === "LAWYER"
      ? Promise.all([
          prisma.legalProblem.count({ where: { status: "OPEN" } }),
          prisma.problemHold.count({ where: { lawyerId: userId, status: "ACTIVE", expiresAt: { gt: new Date() } } }),
          prisma.lawyerResponse.count({ where: { lawyerId: userId } }),
          prisma.booking.findMany({ where: { lawyerId: userId, status: "CONFIRMED" }, select: { price: true, commissionAmount: true, lawyerEarning: true } }),
          prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
          prisma.payoutAccount.findUnique({ where: { userId } }),
        ])
      : Promise.resolve(null),
  ]);

  const profileFields = [
    profileUser?.name,
    profileUser?.phone,
    profileUser?.address,
    profileUser?.city,
    profileUser?.state,
    profileUser?.pincode,
    profileUser?.dateOfBirth,
    profileUser?.occupation,
    profileUser?.companyName,
  ];
  const structuredFilled = profileFields.filter(Boolean).length;
  const profileCompletion = Math.min(
    100,
    Math.round(((structuredFilled + Math.min(profileItems, 4)) / 13) * 100)
  );

  const completedBookings = bookings.filter((b) => b.status === "COMPLETED").length;
  const completedForms = forms.filter((f) => f.status === "COMPLETED").length;
  const cases = completedBookings + completedForms;

  const pricingRegion = detectPricingRegion(cityStateCountry ?? { city: null, state: null, country: null });
  const remaining = Math.max(0, subscription.clientLimit - subscription.clientsUsed);
  const walletCurrency = (wallet as unknown as { currency?: "INR" | "USD" })?.currency ?? getWalletCurrency(cityStateCountry ?? { country: null });
  const autoFormForStats = getAutoFormPrice(cityStateCountry ?? { country: null });
  const stats = [
    { label: "Upcoming consultations", value: upcoming.length, href: "/dashboard#upcoming" },
    { label: "Cases handled", value: cases, href: "/dashboard#cases" },
    { label: "Forms", value: forms.length, href: "/forms" },
    { label: "Wallet", value: formatMoney(wallet?.balance ?? 0, walletCurrency), href: "/dashboard#wallet" },
  ];

  return (
    <div className="container-legal py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-primary-800">
            Welcome back, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-legal-muted">
            {role === "LAWYER" ? "Your practice at a glance." : "Your legal desk at a glance."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/lawyers" className="btn-primary">Book a lawyer</Link>
          <Link href="/forms" className="btn-gold">Fill a form</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:shadow-gold">
            <div className="text-sm text-legal-muted">{s.label}</div>
            <div className="mt-2 font-heading text-2xl font-bold text-primary-800">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Subscription / Plan card — always visible */}
      <div className="mt-6">
        <SubscriptionCard
          plan={subscription.plan}
          status={subscription.status}
          clientLimit={subscription.clientLimit}
          clientsUsed={subscription.clientsUsed}
          remaining={remaining}
          periodEnd={subscription.periodEnd.toISOString()}
          periodStart={subscription.periodStart.toISOString()}
          pricingRegion={pricingRegion}
          city={cityStateCountry?.city}
          state={cityStateCountry?.state}
        />
      </div>

      {/* Lawyer banner */}
      {role === "LAWYER" && lawyerProfile && (
        <div className="mt-8 rounded-xl bg-primary-700 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold">Your law practice</h2>
              <p className="mt-1 text-primary-100">
                {lawyerProfile.isVerified ? "Verified" : "Pending verification"} · {lawyerProfile.experienceYears} yrs ·
                {formatINR(lawyerProfile.hourlyRate)}/hr · {lawyerProfile.commissionRate}% platform commission
              </p>
            </div>
            <Link href="/lawyers" className="btn-gold">View profile</Link>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-2">
          {/* Upcoming appointments */}
          <section id="upcoming">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-primary-800">Upcoming appointments</h2>
              <Link href="/lawyers" className="text-sm font-semibold text-gold-500 hover:text-gold-400">Book more</Link>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming consultations"
                body="Find a verified lawyer and book a slot in minutes."
                cta={{ href: "/lawyers", label: "Browse lawyers" }}
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {upcoming.map((b) => (
                  <li key={b.id} className="card flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
                        {initials(b.lawyer.name)}
                      </span>
                      <div>
                        <div className="font-semibold text-primary-800">{b.lawyer.name}</div>
                        <div className="text-sm text-legal-muted">{b.title}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary-800">{formatDateTime(b.startTime)}</div>
                      <StatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cases */}
          <section id="cases">
            <h2 className="font-heading text-xl font-bold text-primary-800">Recent activity</h2>
            {bookings.length === 0 && forms.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                body="Book your first consultation or upload a form to get started."
                cta={{ href: "/forms", label: "Upload a form" }}
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {bookings.slice(0, 5).map((b) => (
                  <li key={b.id} className="card flex items-center justify-between p-4">
                    <div>
                      <div className="font-semibold text-primary-800">{b.title}</div>
                      <div className="text-sm text-legal-muted">
                        {b.lawyer.name} · {b.lawyerProfile.city ?? "—"} · {formatDateTime(b.startTime)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary-800">{formatINR(b.price)}</div>
                      <StatusBadge status={b.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* My Legal Problems */}
          <section id="problems">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-primary-800">My Legal Problems</h2>
              <Link href="/problems" className="text-sm font-semibold text-gold-500 hover:text-gold-400">View all</Link>
            </div>
            {legalProblems.length === 0 ? (
              <p className="mt-4 text-sm text-legal-muted">No problems posted yet. <Link href="/problems" className="text-gold-500 hover:underline">Post one</Link></p>
            ) : (
              <ul className="mt-4 space-y-3">
                {legalProblems.map((p) => (
                  <li key={p.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary-800">{p.title}</div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 text-sm text-legal-muted">{p.category} · {p.location ?? "—"} · {p._count.responses} responses</div>
                    <div className="mt-2 flex gap-2">
                      <Link href={`/problems/${p.id}`} className="btn-outline text-xs">View</Link>
                      {p.status === "OPEN" && p._count.responses === 0 && <span className="text-xs text-legal-muted">Posted</span>}
                      {p._count.responses > 0 && <span className="text-xs text-emerald-600">Lawyers Interested</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Lawyer Overview (only for lawyers) */}
          {role === "LAWYER" && lawyerStats && (
            <section id="lawyer-overview">
              <h2 className="font-heading text-xl font-bold text-primary-800">Lawyer Overview</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">New eligible leads</div>
                  <div className="font-heading text-2xl font-bold text-primary-800">{lawyerStats[0]}</div>
                  <Link href="/lawyer/requests" className="text-xs text-gold-500 hover:underline">View leads</Link>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">Lead quota</div>
                  <div className="font-heading text-lg font-bold text-primary-800">{subscription.clientsUsed}/{subscription.clientLimit} used · {remaining} remaining</div>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">Active holds</div>
                  <div className="font-heading text-xl font-bold text-primary-800">{(lawyerStats[1] as number)}</div>
                  <div className="text-xs text-legal-muted">3-day holds</div>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">Total responses</div>
                  <div className="font-heading text-xl font-bold text-primary-800">{lawyerStats[2] as number}</div>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">Earnings (gross)</div>
                  <div className="font-heading text-xl font-bold text-primary-800">{formatMoney((lawyerStats[3] as { price: number }[]).reduce((s, b) => s + (b as unknown as { price: number }).price, 0), walletCurrency)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-sm text-legal-muted">Payout account</div>
                  <div className="text-sm font-semibold text-primary-800">{(lawyerStats[5] as { kycStatus: string } | null)?.kycStatus ?? "NOT_STARTED"}</div>
                  <Link href="/profile" className="text-xs text-gold-500 hover:underline">Setup payout</Link>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-primary-800">Your profile</h3>
              <Link href="/profile" className="text-sm font-semibold text-gold-500 hover:text-gold-400">Edit</Link>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-legal-muted">One profile, reused everywhere</span>
              <span className="font-semibold text-primary-800">{profileCompletion}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary-50">
              <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="mt-3 text-sm text-legal-muted">
              {profileCompletion < 50
                ? "Complete your profile and answers get reused in every form — no more re-typing."
                : "Your answers auto-fill forms and CVs. Add a photo to polish your CV."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/profile" className="btn-outline flex-1 text-center text-sm">Complete profile</Link>
              <Link href="/cv" className="btn-gold flex-1 text-center text-sm">Build CV</Link>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-primary-800">LegalFlow Copilot</h3>
              <Link href="/copilot" className="text-sm font-semibold text-gold-500 hover:text-gold-400">Open</Link>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-legal-muted">
              Book a lawyer, fill a form, check compliance, or get a summary of your account — all in one conversation.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/copilot" className="btn-gold flex-1 text-center text-sm">Chat now</Link>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary-50 to-gold-50">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-primary-800">ScheduleAI</h3>
              <span className="badge bg-gold-100 text-gold-700">New</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-legal-muted">
              Event types, availability, and bookings — now native inside LegalFlow. Same login, same design.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/scheduleai" className="btn-gold flex-1 text-center text-sm">Open ScheduleAI</Link>
            </div>
          </Card>

          <div id="wallet">
            {(() => {
              const remainingForms = wallet ? Math.floor((wallet.balance ?? 0) / autoFormForStats.amount) : 0;
              return (
                <WalletCard
                  balance={wallet?.balance ?? 0}
                  currency={walletCurrency}
                  userId={userId}
                  autoFormPrice={autoFormForStats.amount}
                  autoFormCurrency={autoFormForStats.currency}
                  remainingForms={remainingForms}
                />
              );
            })()}
          </div>

          {/* Recent forms */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-primary-800">Your forms</h3>
              <Link href="/forms" className="text-sm font-semibold text-gold-500 hover:text-gold-400">All</Link>
            </div>
            {forms.length === 0 ? (
              <p className="mt-4 text-sm text-legal-muted">No forms yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {forms.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <Link href={`/forms/${f.id}`} className="flex items-center justify-between rounded-lg border border-primary-100 px-4 py-3 transition hover:border-gold-300">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-primary-800">{f.title}</div>
                        <div className="text-xs text-legal-muted">{f._count.fields} fields detected</div>
                      </div>
                      <StatusBadge status={f.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Transactions */}
          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary-800">Recent transactions</h3>
            {!wallet || wallet.transactions.length === 0 ? (
              <p className="mt-4 text-sm text-legal-muted">No transactions yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {wallet.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-primary-800">{t.description}</div>
                      <div className="text-xs text-legal-muted">{formatDateTime(t.createdAt)}</div>
                    </div>
                    <span className={t.amount >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                      {t.amount >= 0 ? "+" : ""}
                      {formatMoney(t.amount, ((t as unknown as { currency?: "INR" | "USD" }).currency ?? "INR") as "INR" | "USD")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="card mt-4 flex flex-col items-center justify-center p-10 text-center">
      <h3 className="font-heading font-bold text-primary-800">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-legal-muted">{body}</p>
      <Link href={cta.href} className="btn-outline mt-5">{cta.label}</Link>
    </div>
  );
}
