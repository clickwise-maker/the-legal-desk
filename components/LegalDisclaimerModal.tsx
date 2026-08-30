"use client";

import { useEffect, useState } from "react";
import { LEGAL_POLICY_VERSION, LEGAL_DISCLAIMER_TITLE, LEGAL_DISCLAIMER_BODY } from "@/lib/legal/policy";

export function LegalDisclaimerModal() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/consent", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        // Only show if authenticated and not consented for current version
        if (res.status === 401) {
          // Guest — check localStorage fallback, but server consent will be required after login
          const local = typeof window !== "undefined" ? localStorage.getItem(`legalflow_consent_${LEGAL_POLICY_VERSION}`) : null;
          if (!local) setOpen(true);
          return;
        }
        if (!data.consented) setOpen(true);
      } catch {
        // Fail closed — don't block app if API unavailable
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAgree() {
    if (!checked) {
      setError("Please check the agreement box to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true, version: LEGAL_POLICY_VERSION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          // Guest — store locally, but server consent will be required after login
          localStorage.setItem(`legalflow_consent_${LEGAL_POLICY_VERSION}`, "1");
          setOpen(false);
          return;
        }
        throw new Error(data.error ?? "Could not save consent");
      }
      // Success — also mirror to localStorage for fast re-check before next server call
      localStorage.setItem(`legalflow_consent_${LEGAL_POLICY_VERSION}`, "1");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save consent");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="legal-disclaimer-title">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl md:p-8">
        <h2 id="legal-disclaimer-title" className="font-heading text-xl font-bold text-primary-800 md:text-2xl">
          {LEGAL_DISCLAIMER_TITLE}
        </h2>
        <p className="mt-1 text-xs text-legal-muted">Version {LEGAL_POLICY_VERSION} · Effective 2026-08-30</p>
        <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-lg bg-primary-50 p-4 text-sm leading-relaxed text-legal-700">
          <p className="whitespace-pre-line">{LEGAL_DISCLAIMER_BODY}</p>
          <p className="mt-3 text-xs text-legal-muted">
            This notice will be shown again if the legal policy version changes. Consent is stored securely with your account.
          </p>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-primary-100 p-3 hover:bg-primary-50">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-primary-300 text-gold-500 focus:ring-gold-400"
            aria-label="I agree to the legal disclaimer"
          />
          <span className="text-sm font-medium text-primary-800">
            I have read and agree that LegalFlow is a technology platform, not a law firm, and no advocate-client relationship is created automatically.
          </span>
        </label>
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleAgree}
            disabled={!checked || loading}
            className="btn-gold min-w-[140px] disabled:opacity-50"
            aria-disabled={!checked || loading}
          >
            {loading ? "Saving…" : "I Agree — Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
