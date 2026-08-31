"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { nextDays } from "@/lib/scheduling";
import { initials } from "@/lib/constants";
import { usePayment } from "@/lib/use-payment";
import { Stars, Badge, Card, Button } from "@/components/ui";
import { useCurrency } from "@/components/use-currency";
import type { Session } from "next-auth";

type Lawyer = {
  id: string;
  name: string;
  bio: string;
  barCouncilId: string;
  experienceYears: number;
  hourlyRate: number;
  commissionPercent: number;
  city: string | null;
  state?: string | null;
  jurisdiction?: string | null;
  languages?: string[] | null;
  consultationModes?: string[] | null;
  courtsOfPractice?: string[] | null;
  enrolmentYear?: number | null;
  isVerified: boolean;
  verifiedAt?: string | null;
  specializations: string[];
  rating: number;
  ratingCount: number;
  bookingCount: number;
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
};

type Slot = { start: string; label: string };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function LawyerDetail({ session }: { session: Session | null }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pay, status: payStatus, error: payError } = usePayment();
  const { format } = useCurrency();

  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [days] = useState(() => nextDays(7));
  const [selectedDate, setSelectedDate] = useState(days[0].key);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<"RAZORPAY" | "WALLET">("RAZORPAY");
  const [title, setTitle] = useState("Consultation");
  const [description, setDescription] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadLawyer = useCallback(async () => {
    const res = await fetch(`/api/lawyers/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    setLawyer(await res.json());
    setLoading(false);
  }, [id]);

  const loadSlots = useCallback(async (date: string) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/lawyers/${id}/slots?date=${date}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLawyer();
  }, [loadLawyer]);

  useEffect(() => {
    if (lawyer) loadSlots(selectedDate);
  }, [lawyer, selectedDate, loadSlots]);

  if (loading) {
    return <div className="card h-96 animate-pulse bg-primary-50/50" />;
  }

  if (!lawyer) {
    return (
      <div className="card p-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary-800">Lawyer not found</h1>
        <a href="/lawyers" className="btn-outline mt-5">Back to lawyers</a>
      </div>
    );
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setBookingError("");
    if (!lawyer) return;
    if (!selectedSlot) {
      setBookingError("Please select a time slot.");
      return;
    }
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=/lawyers/${id}`);
      return;
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lawyerProfileId: id, startTime: selectedSlot, title, description, payWith }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBookingError(data.error ?? "Could not create booking");
      return;
    }

    if (payWith === "WALLET") {
      setSuccess(true);
      return;
    }

    try {
      await pay({
        type: "BOOKING",
        referenceId: data.bookingId,
        orderId: data.orderId,
        amountInr: data.amountInr,
        description: `${lawyer.name} — ${title}`,
        customerName: session.user.name ?? undefined,
        customerEmail: session.user.email ?? undefined,
      });
      setSuccess(true);
    } catch {
      // error surfaced via payError
    }
  }

  if (success) {
    return (
      <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold text-primary-800">Consultation booked!</h1>
        <p className="mt-3 text-legal-muted">
          Your session with {lawyer.name} is confirmed. Find it in your dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
          <Button variant="outline" onClick={() => router.push("/lawyers")}>Book another</Button>
        </div>
      </div>
    );
  }

  const netRate = lawyer.hourlyRate;
  const lawyerGets = Math.round(lawyer.hourlyRate * (1 - lawyer.commissionPercent / 100) * 100) / 100;

  return (
    <div className="container-legal py-10">
      <a href="/lawyers" className="text-sm font-medium text-gold-500 hover:text-gold-400">← All lawyers</a>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Profile */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-xl font-bold text-white">
                {initials(lawyer.name)}
              </span>
              <div>
                <h1 className="font-heading text-xl font-bold text-primary-800">{lawyer.name}</h1>
                <p className="text-sm text-legal-muted">{lawyer.city ?? "India"} · Bar ID {lawyer.barCouncilId}</p>
                {lawyer.isVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="gray">Unverified</Badge>}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Stars score={lawyer.rating} />
              <span className="text-sm text-legal-muted">
                {lawyer.rating > 0 ? `${lawyer.rating} · ${lawyer.ratingCount} reviews` : "No reviews yet"}
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-legal-muted">{lawyer.bio}</p>

            <dl className="mt-5 space-y-3 border-t border-primary-100 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-legal-muted">Experience</dt>
                <dd className="font-semibold text-primary-800">{lawyer.experienceYears} years</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-legal-muted">Rate</dt>
                <dd className="font-semibold text-primary-800">{format(lawyer.hourlyRate)}/hr</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-legal-muted">Consultations</dt>
                <dd className="font-semibold text-primary-800">{lawyer.bookingCount}</dd>
              </div>
              {lawyer.state && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">State</dt>
                  <dd className="font-semibold text-primary-800">{lawyer.state}</dd>
                </div>
              )}
              {lawyer.jurisdiction && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">Jurisdiction</dt>
                  <dd className="font-semibold text-primary-800">{lawyer.jurisdiction}</dd>
                </div>
              )}
              {lawyer.enrolmentYear && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">Enrolled</dt>
                  <dd className="font-semibold text-primary-800">{lawyer.enrolmentYear}</dd>
                </div>
              )}
              {lawyer.languages && (lawyer.languages as string[]).length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">Languages</dt>
                  <dd className="font-semibold text-primary-800">{(lawyer.languages as string[]).join(", ")}</dd>
                </div>
              )}
              {lawyer.consultationModes && (lawyer.consultationModes as string[]).length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">Modes</dt>
                  <dd className="font-semibold text-primary-800">{(lawyer.consultationModes as string[]).join(", ")}</dd>
                </div>
              )}
              {lawyer.courtsOfPractice && (lawyer.courtsOfPractice as string[]).length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-legal-muted">Courts</dt>
                  <dd className="font-semibold text-primary-800">{(lawyer.courtsOfPractice as string[]).join(", ")}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-legal-muted">Registration</dt>
                <dd className="font-semibold text-primary-800">{lawyer.barCouncilId}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {lawyer.specializations.map((s) => (
                <span key={s} className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">{s}</span>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-primary-50 p-4 text-xs leading-relaxed text-primary-700">
              {lawyer.commissionPercent}% platform commission is deducted from your payment. The lawyer receives{" "}
              <strong>{format(lawyerGets)}</strong> per hour.
            </div>
          </Card>
        </div>

        {/* Booking */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="font-heading text-xl font-bold text-primary-800">Book a consultation</h2>
            <p className="mt-1 text-sm text-legal-muted">Pick a day, then a free 60-minute slot.</p>

            {/* Date picker */}
            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDate(d.key)}
                  className={`rounded-lg border px-2 py-3 text-center transition ${
                    selectedDate === d.key
                      ? "border-gold-400 bg-gold-50 ring-2 ring-gold-200"
                      : "border-primary-200 bg-white hover:border-primary-300"
                  }`}
                >
                  <div className="text-xs font-medium text-legal-muted">{d.weekday}</div>
                  <div className="mt-1 text-sm font-bold text-primary-800">{d.label}</div>
                </button>
              ))}
            </div>

            {/* Slots */}
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-primary-800">
                Available slots on {DAY_LABELS[days.find((d) => d.key === selectedDate)?.date.getDay() ?? 0]} {selectedDate}
              </h3>
              {slotsLoading ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-lg bg-primary-50" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="mt-3 rounded-lg bg-primary-50 p-4 text-sm text-legal-muted">
                  No free slots on this day. Pick another date.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSelectedSlot(s.start)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                        selectedSlot === s.start
                          ? "border-gold-400 bg-gold-400 text-white shadow-gold"
                          : "border-primary-200 bg-white text-primary-800 hover:border-gold-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Booking form */}
            <form onSubmit={handleBook} className="mt-6 space-y-4 border-t border-primary-100 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="title">Topic</label>
                  <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="pay">Payment method</label>
                  <select id="pay" className="input" value={payWith} onChange={(e) => setPayWith(e.target.value as "RAZORPAY" | "WALLET")}>
                    <option value="RAZORPAY">Razorpay (card / UPI / netbanking)</option>
                    <option value="WALLET">Wallet balance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="desc">Details (optional)</label>
                <textarea
                  id="desc"
                  className="input min-h-24"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what you need help with…"
                />
              </div>

              <div className="rounded-lg bg-primary-50 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary-700">Consultation (1 hour)</span>
                  <span className="font-semibold text-primary-800">{format(netRate)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-primary-600">
                  <span>Platform commission ({lawyer.commissionPercent}%)</span>
                  <span>Deducted</span>
                </div>
              </div>

              {(bookingError || payError) && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {bookingError || payError}
                </p>
              )}

              <Button variant="gold" type="submit" className="w-full" disabled={payStatus === "processing" || !session?.user?.id}>
                {!session?.user?.id
                  ? "Sign in to book"
                  : payStatus === "processing"
                  ? "Processing…"
                  : `Confirm booking · ${format(netRate)}`}
              </Button>
              {!session?.user?.id && (
                <p className="text-center text-xs text-legal-muted">
                  You will be asked to sign in after booking.
                </p>
              )}
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
