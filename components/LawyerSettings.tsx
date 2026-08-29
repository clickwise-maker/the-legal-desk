"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui";
import { SPECIALIZATIONS } from "@/lib/constants";

type LawyerProfile = {
  id: string;
  barCouncilId: string;
  experienceYears: number;
  hourlyRate: number;
  commissionPercent: number;
  bio: string;
  city: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  specializations: string[];
};

const FALLBACK: LawyerProfile = {
  id: "",
  barCouncilId: "",
  experienceYears: 0,
  hourlyRate: 0,
  commissionPercent: 12,
  bio: "",
  city: "",
  isAvailable: true,
  isVerified: false,
  specializations: [],
};

export function LawyerSettings() {
  const [form, setForm] = useState<LawyerProfile>(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/lawyers/me");
    if (res.ok) {
      setForm(await res.json());
    } else if (res.status !== 404) {
      setError("Could not load your lawyer profile.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSpec(name: string) {
    setForm((f) => ({
      ...f,
      specializations: f.specializations.includes(name)
        ? f.specializations.filter((s) => s !== name)
        : [...f.specializations, name],
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/lawyers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barCouncilId: form.barCouncilId,
          experienceYears: Number(form.experienceYears || 0),
          hourlyRate: Number(form.hourlyRate || 0),
          bio: form.bio,
          city: form.city ?? "",
          isAvailable: form.isAvailable,
          specializations: form.specializations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setForm((f) => ({ ...f, ...data }));
      setMessage("Lawyer profile saved. Updates are live on the marketplace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-primary-800">Lawyer Profile</h2>
        <div className="flex gap-2">
          {form.isVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="gray">Pending verification</Badge>}
          <Badge tone={form.isAvailable ? "green" : "red"}>{form.isAvailable ? "Accepting bookings" : "Unavailable"}</Badge>
        </div>
      </div>
      <p className="mt-1 text-sm text-legal-muted">
        Configure how you appear to clients. A {form.commissionPercent}% platform commission applies to bookings.
      </p>

      {!loaded ? (
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-primary-50/50" />
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="bcid">Bar Council ID</label>
              <input
                id="bcid"
                className="input"
                value={form.barCouncilId}
                onChange={(e) => setForm({ ...form, barCouncilId: e.target.value })}
                placeholder="e.g. BAR/MAH/2015/12345"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="city">City</label>
              <input
                id="city"
                className="input"
                value={form.city ?? ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Mumbai"
              />
            </div>
            <div>
              <label className="label" htmlFor="exp">Experience (years)</label>
              <input
                id="exp"
                type="number"
                min={0}
                max={60}
                className="input"
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="rate">Consultation fee (₹/hour)</label>
              <input
                id="rate"
                type="number"
                min={0}
                step={50}
                className="input"
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="label">Specializations</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => {
                const active = form.specializations.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpec(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                      active
                        ? "bg-gold-500 text-primary-900 ring-gold-400"
                        : "bg-white text-primary-700 ring-primary-200 hover:border-gold-300 hover:text-gold-500"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="bio">Professional bio</label>
            <textarea
              id="bio"
              className="input min-h-24"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell clients about your practice, experience and approach…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-primary-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold-500"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
            />
            Accepting new consultations
          </label>

          {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

          <div className="flex items-center justify-between">
            <button type="submit" disabled={saving} className="btn-gold disabled:opacity-60">
              {saving ? "Saving…" : "Save lawyer profile"}
            </button>
            <LinkToMarketplace />
          </div>
        </form>
      )}
    </Card>
  );
}

function LinkToMarketplace() {
  return (
    <a href="/lawyers" className="text-sm font-semibold text-gold-500 hover:text-gold-400">
      View marketplace →
    </a>
  );
}
