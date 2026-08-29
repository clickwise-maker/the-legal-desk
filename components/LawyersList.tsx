"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPECIALIZATIONS, initials } from "@/lib/constants";
import { Stars, Badge } from "@/components/ui";
import { useCurrency } from "@/components/use-currency";

type Lawyer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  city: string | null;
  experienceYears: number;
  hourlyRate: number;
  isVerified: boolean;
  specializations: string[];
  rating: number;
  ratingCount: number;
  bookingCount: number;
};

export function LawyersList({ initialQuery }: { initialQuery?: string }) {
  const searchParams = useSearchParams();
  const { format } = useCurrency();
  const [q, setQ] = useState(initialQuery ?? searchParams.get("q") ?? "");
  const [spec, setSpec] = useState(searchParams.get("specialization") ?? "");
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLawyers = useCallback(async (query: string, specName: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (specName) params.set("specialization", specName);
    const res = await fetch(`/api/lawyers?${params.toString()}`);
    const data = await res.json();
    setLawyers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLawyers(q, spec);
  }, [fetchLawyers, q, spec]);

  return (
    <div>
      {/* Filters */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-legal-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="input pl-9"
              placeholder="Search by name, practice area, or keyword…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input md:w-64" value={spec} onChange={(e) => setSpec(e.target.value)}>
            <option value="">All specializations</option>
            {SPECIALIZATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-64 animate-pulse bg-primary-50/50" />
          ))}
        </div>
      ) : lawyers.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <h2 className="font-heading text-xl font-bold text-primary-800">No lawyers found</h2>
          <p className="mt-2 text-sm text-legal-muted">Try a different search or specialization.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {lawyers.map((l) => (
            <Link key={l.id} href={`/lawyers/${l.id}`} className="card group p-6 transition hover:shadow-gold">
              <div className="flex items-start justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {initials(l.name)}
                </span>
                <div className="flex flex-col items-end gap-1">
                  {l.isVerified ? (
                    <Badge tone="green">Verified</Badge>
                  ) : (
                    <Badge tone="gray">Unverified</Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Stars score={l.rating} />
                    <span className="text-xs text-legal-muted">({l.ratingCount})</span>
                  </div>
                </div>
              </div>

              <h2 className="mt-4 font-heading text-lg font-bold text-primary-800 group-hover:text-primary-600">
                {l.name}
              </h2>
              <p className="mt-1 text-sm text-legal-muted">
                {l.experienceYears} yrs exp · {l.city ?? "—"} · {l.bookingCount} consultations
              </p>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-legal-muted">{l.bio}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {l.specializations.slice(0, 3).map((s) => (
                  <span key={s} className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-100">{s}</span>
                ))}
                {l.specializations.length > 3 && (
                  <span className="badge bg-gold-50 text-gold-500 ring-1 ring-gold-100">+{l.specializations.length - 3}</span>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-primary-100 pt-4">
                <div>
                  <span className="font-heading text-xl font-bold text-primary-800">{format(l.hourlyRate)}</span>
                  <span className="text-sm text-legal-muted">/hr</span>
                </div>
                <span className="btn-primary group-hover:bg-primary-700">Book now</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
