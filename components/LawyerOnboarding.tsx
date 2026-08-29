"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/constants";
import {
  ONBOARDING_SPECIALIZATIONS,
  COURTS_OF_PRACTICE,
  enrolmentYearOptions,
} from "@/lib/constants";
import { Badge } from "@/components/ui";

type Application = {
  name: string;
  phone: string;
  practiceEmail: string;
  chamberAddress: string;
  barCouncilId: string;
  enrolmentYear: number | null;
  aibeCopNumber: string;
  specializations: string[];
  courtsOfPractice: string[];
  experienceYears: number;
  barIdDocUrl: string;
  photoUrl: string;
  onboardingStatus: string;
  credentialsVerifiedAt: string | null;
};

const EMPTY: Application = {
  name: "",
  phone: "",
  practiceEmail: "",
  chamberAddress: "",
  barCouncilId: "",
  enrolmentYear: null,
  aibeCopNumber: "",
  specializations: [],
  courtsOfPractice: [],
  experienceYears: 0,
  barIdDocUrl: "",
  photoUrl: "",
  onboardingStatus: "NOT_STARTED",
  credentialsVerifiedAt: null,
};

const STEPS = [
  { n: 1, label: "Profile", desc: "Personal & credentials" },
  { n: 2, label: "Verification Documents", desc: "Uploads" },
  { n: 3, label: "Expertise & Courts", desc: "Practice areas" },
];

const YEARS = enrolmentYearOptions();

export function LawyerOnboarding() {
  const [form, setForm] = useState<Application>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verifyState, setVerifyState] = useState<"idle" | "checking" | "verified" | "failed">("idle");
  const [verifyResult, setVerifyResult] = useState<string>("");

  const barFileInput = useRef<HTMLInputElement>(null);
  const photoFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/lawyers/onboarding");
        if (res.ok) {
          const data = await res.json();
          const app = data.application;
          if (app) {
            setForm({ ...EMPTY, ...app, credentialsVerifiedAt: app.credentialsVerifiedAt ?? null });
            setVerifyState(app.credentialsVerifiedAt ? "verified" : "idle");
          } else {
            setForm((f) => ({ ...f, name: data.user?.name ?? "", phone: data.user?.phone ?? "" }));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof Application>(key: K, value: Application[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[String(key)];
      return next;
    });
  };

  const toggle = (key: "specializations" | "courtsOfPractice", value: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value],
    }));
  };

  function validateStep(n: number): boolean {
    const next: Record<string, string> = {};
    if (n === 1) {
      if (!form.name.trim()) next.name = "Full name is required.";
      if (!form.phone.trim()) next.phone = "Contact number is required.";
      if (!form.practiceEmail.trim()) next.practiceEmail = "Practice email is required.";
      else if (!/^\S+@\S+\.\S+$/.test(form.practiceEmail)) next.practiceEmail = "Enter a valid email.";
      if (!form.chamberAddress.trim()) next.chamberAddress = "Office/chamber address is required.";
      if (!form.barCouncilId.trim()) next.barCouncilId = "Bar Council enrolment number is required.";
      if (!form.enrolmentYear) next.enrolmentYear = "Select your year of enrolment.";
    }
    if (n === 2) {
      if (!form.barIdDocUrl) next.barIdDocUrl = "Bar Council ID / enrolment certificate is required.";
      if (!form.photoUrl) next.photoUrl = "Profile photograph is required.";
    }
    if (n === 3) {
      if (form.specializations.length === 0) next.specializations = "Select at least one area of expertise.";
      if (form.courtsOfPractice.length === 0) next.courtsOfPractice = "Select at least one court of practice.";
      if (form.experienceYears == null || form.experienceYears < 0) next.experienceYears = "Enter years of experience.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(3, s + 1));
      setErrors({});
    }
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
    setErrors({});
  }

  async function saveProgress() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/lawyers/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, step, action: "save" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Progress saved as a draft. You can continue later from anywhere.");
    } catch (err) {
      setMessage("");
      setErrors((e) => ({ ...e, form: err instanceof Error ? err.message : "Save failed" }));
    } finally {
      setSaving(false);
    }
  }

  async function submitApplication() {
    if (!validateStep(3) || !canSubmit) return;
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/lawyers/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, step: 3, action: "submit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");
      setSubmitted(true);
    } catch (err) {
      setErrors((e) => ({ ...e, form: err instanceof Error ? err.message : "Submit failed" }));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCredentials() {
    if (!form.barCouncilId.trim()) {
      setErrors((e) => ({ ...e, barCouncilId: "Enter your Bar Council enrolment number first." }));
      return;
    }
    setVerifyState("checking");
    setVerifyResult("");
    try {
      const res = await fetch("/api/lawyers/onboarding/verify-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barCouncilId: form.barCouncilId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      if (data.verified) {
        setVerifyState("verified");
        setVerifyResult(
          `${data.registeredName} · ${data.state} Bar Council · enrolled ${data.yearOfEnrolment} · ${data.matchPercent}% match`
        );
      } else {
        setVerifyState("failed");
        setVerifyResult(data.message ?? "Verification failed. Check the number and try again.");
      }
    } catch (err) {
      setVerifyState("failed");
      setVerifyResult(err instanceof Error ? err.message : "Verification failed. Please retry.");
    }
  }

  async function handleUpload(kind: "barId" | "photo", file: File) {
    setErrors((e) => {
      const next = { ...e };
      delete next[kind === "barId" ? "barIdDocUrl" : "photoUrl"];
      return next;
    });
    try {
      const fd = new FormData();
      fd.set("type", kind);
      fd.set("file", file);
      const res = await fetch("/api/lawyers/onboarding/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (kind === "barId") setForm((f) => ({ ...f, barIdDocUrl: data.url }));
      else setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [kind === "barId" ? "barIdDocUrl" : "photoUrl"]: err instanceof Error ? err.message : "Upload failed",
      }));
    }
  }

  const mandatoryComplete =
    Boolean(form.name.trim()) &&
    Boolean(form.phone.trim()) &&
    Boolean(form.practiceEmail.trim()) &&
    Boolean(form.chamberAddress.trim()) &&
    Boolean(form.barCouncilId.trim()) &&
    Boolean(form.enrolmentYear) &&
    Boolean(form.barIdDocUrl) &&
    Boolean(form.photoUrl) &&
    form.specializations.length > 0 &&
    form.courtsOfPractice.length > 0 &&
    form.experienceYears >= 0;

  const canSubmit = mandatoryComplete && verifyState === "verified";

  if (loading) return <div className="card h-96 animate-pulse bg-primary-50/50" />;

  if (submitted) {
    return (
      <div className="container-legal py-10">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 className="mt-5 font-heading text-2xl font-bold text-primary-800">Application submitted</h1>
          <p className="mt-3 text-legal-muted">
            Thank you, {form.name.split(" ")[0]}. Your lawyer application is under review. We&apos;ll verify your
            credentials and notify you once your profile goes live on the marketplace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-gold">Go to dashboard</Link>
            <Link href="/lawyers" className="btn-outline">View marketplace</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="badge bg-gold-50 text-gold-500 ring-1 ring-gold-100">Lawyer onboarding</span>
          <h1 className="mt-4 font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
            Register as a LegalFlow lawyer
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-legal-muted">
            Complete three short steps to apply. Save progress any time and come back later.
          </p>
        </div>

        {/* Stepper */}
        <ol className="mt-8 flex items-center">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <li key={s.n} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <button
                  type="button"
                  onClick={() => s.n < step && setStep(s.n)}
                  className={cn("group flex items-center gap-3", s.n < step ? "cursor-pointer" : "cursor-default")}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full font-heading text-sm font-bold ring-2 transition",
                      done && "bg-emerald-500 text-white ring-emerald-200",
                      active && "bg-gold-500 text-primary-900 ring-gold-300",
                      !done && !active && "bg-primary-50 text-legal-muted ring-primary-100"
                    )}
                  >
                    {done ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      s.n
                    )}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className={cn("block text-sm font-bold", active ? "text-primary-800" : "text-legal-muted")}>
                      {s.label}
                    </span>
                    <span className="block text-xs text-legal-muted">{s.desc}</span>
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={cn("mx-3 h-0.5 flex-1 rounded", step > s.n ? "bg-emerald-400" : "bg-primary-100")} />
                )}
              </li>
            );
          })}
        </ol>

        {/* Step 1 — Profile */}
        {step === 1 && (
          <div className="card mt-8 space-y-5 p-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-primary-800">Personal details</h2>
              <p className="text-sm text-legal-muted">How clients and the registry will know you.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name}>
                <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Aarav Sharma" />
              </Field>
              <Field label="Contact number" error={errors.phone}>
                <input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98XXXXXX00" />
              </Field>
              <Field label="Practice email" error={errors.practiceEmail} className="sm:col-span-2">
                <input className="input" type="email" value={form.practiceEmail} onChange={(e) => set("practiceEmail", e.target.value)} placeholder="you@chambers.com" />
              </Field>
              <Field label="Office / chamber address" error={errors.chamberAddress} className="sm:col-span-2">
                <textarea className="input min-h-20" value={form.chamberAddress} onChange={(e) => set("chamberAddress", e.target.value)} placeholder="Chamber no., building, court complex, city" />
              </Field>
            </div>

            <div className="border-t border-primary-100 pt-5">
              <h3 className="font-heading text-base font-bold text-primary-800">Professional credentials</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="State Bar Council enrolment number" error={errors.barCouncilId}>
                  <div className="flex gap-2">
                    <input className="input flex-1" value={form.barCouncilId} onChange={(e) => set("barCouncilId", e.target.value)} placeholder="e.g. MAH/1234/2015" />
                    <button
                      type="button"
                      onClick={verifyCredentials}
                      disabled={verifyState === "checking"}
                      className="btn-primary whitespace-nowrap disabled:opacity-60"
                    >
                      {verifyState === "checking" ? (
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                          Checking…
                        </span>
                      ) : verifyState === "verified" ? "Verified" : "Verify Credentials"}
                    </button>
                  </div>
                </Field>
                <Field label="Year of enrolment" error={errors.enrolmentYear}>
                  <select className="input" value={form.enrolmentYear ?? ""} onChange={(e) => set("enrolmentYear", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </Field>
                <Field label="AIBE / Certificate of Practice (COP) number" hint="Optional" className="sm:col-span-2">
                  <input className="input" value={form.aibeCopNumber} onChange={(e) => set("aibeCopNumber", e.target.value)} placeholder="Optional" />
                </Field>
              </div>

              {verifyResult && (
                <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm", verifyState === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                  {verifyResult}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary-100 pt-5">
              <button type="button" onClick={saveProgress} disabled={saving} className="btn-ghost disabled:opacity-60">
                {saving ? "Saving…" : "Save Progress"}
              </button>
              <button type="button" onClick={next} className="btn-gold">Continue → Documents</button>
            </div>
          </div>
        )}

        {/* Step 2 — Verification Documents */}
        {step === 2 && (
          <div className="card mt-8 space-y-6 p-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-primary-800">Verification documents</h2>
              <p className="text-sm text-legal-muted">Uploads help our team verify your identity before your profile goes live.</p>
            </div>

            <UploadBlock
              title="Bar Council ID / Enrolment Certificate"
              desc="Drag & drop or browse — PDF, JPEG or PNG (max 8 MB)"
              accept=".pdf,.jpg,.jpeg,.png"
              file={form.barIdDocUrl}
              error={errors.barIdDocUrl}
              isImage={false}
              inputRef={barFileInput}
              onPick={(f) => handleUpload("barId", f)}
              onRemove={() => set("barIdDocUrl", "")}
            />

            <UploadBlock
              title="Profile Photograph"
              desc="A clear headshot for your marketplace profile — JPEG, PNG or WEBP"
              accept="image/*"
              file={form.photoUrl}
              error={errors.photoUrl}
              isImage
              inputRef={photoFileInput}
              onPick={(f) => handleUpload("photo", f)}
              onRemove={() => set("photoUrl", "")}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary-100 pt-5">
              <div className="flex gap-2">
                <button type="button" onClick={back} className="btn-outline">← Back</button>
                <button type="button" onClick={saveProgress} disabled={saving} className="btn-ghost disabled:opacity-60">
                  {saving ? "Saving…" : "Save Progress"}
                </button>
              </div>
              <button type="button" onClick={next} className="btn-gold">Continue → Expertise</button>
            </div>
          </div>
        )}

        {/* Step 3 — Expertise & Courts */}
        {step === 3 && (
          <div className="card mt-8 space-y-6 p-6">
            <div>
              <h2 className="font-heading text-lg font-bold text-primary-800">Expertise & courts</h2>
              <p className="text-sm text-legal-muted">Tell clients where you practise and what you handle.</p>
            </div>

            <TagSelect
              title="Areas of expertise"
              hint="Select all that apply"
              options={ONBOARDING_SPECIALIZATIONS as readonly string[]}
              selected={form.specializations}
              onToggle={(v) => toggle("specializations", v)}
              error={errors.specializations}
            />

            <TagSelect
              title="Courts of practice"
              hint="Select all that apply"
              options={COURTS_OF_PRACTICE as readonly string[]}
              selected={form.courtsOfPractice}
              onToggle={(v) => toggle("courtsOfPractice", v)}
              error={errors.courtsOfPractice}
            />

            <Field label="Experience in years" error={errors.experienceYears}>
              <input
                className="input sm:max-w-xs"
                type="number"
                min={0}
                max={60}
                value={form.experienceYears}
                onChange={(e) => set("experienceYears", Number(e.target.value))}
                placeholder="e.g. 6"
              />
            </Field>

            {errors.form && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{errors.form}</p>}

            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-4 text-sm text-primary-700">
              {verifyState === "verified" ? (
                <p><strong className="text-emerald-700">Credentials verified.</strong> Your application is ready to submit.</p>
              ) : (
                <p>
                  Your Bar Council enrolment number must be <strong>verified</strong> (Step 1) before you can submit.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary-100 pt-5">
              <div className="flex gap-2">
                <button type="button" onClick={back} className="btn-outline">← Back</button>
                <button type="button" onClick={saveProgress} disabled={saving} className="btn-ghost disabled:opacity-60">
                  {saving ? "Saving…" : "Save Progress"}
                </button>
              </div>
              <button
                type="button"
                onClick={submitApplication}
                disabled={!canSubmit || submitting}
                className="btn-gold disabled:cursor-not-allowed disabled:opacity-40"
                title={canSubmit ? "Submit your application" : "Complete all mandatory fields, uploads and credential verification to submit."}
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          </div>
        )}

        {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label} {hint && <span className="font-normal text-legal-muted">({hint})</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TagSelect({
  title,
  hint,
  options,
  selected,
  onToggle,
  error,
}: {
  title: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="label">
        {title} {hint && <span className="font-normal text-legal-muted">({hint})</span>}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold ring-1 transition",
                active
                  ? "bg-gold-500 text-primary-900 ring-gold-400"
                  : "bg-white text-primary-700 ring-primary-200 hover:border-gold-300 hover:text-gold-500"
              )}
            >
              {active && <span className="mr-1.5">✓</span>}
              {opt}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function UploadBlock({
  title,
  desc,
  accept,
  file,
  error,
  isImage,
  inputRef,
  onPick,
  onRemove,
}: {
  title: string;
  desc: string;
  accept: string;
  file: string;
  error?: string;
  isImage: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const [drag, setDrag] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{title}</label>
        {file && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-red-600 hover:text-red-500">
            Remove
          </button>
        )}
      </div>
      {file ? (
        <div className="mt-2 flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file} alt="Profile preview" className="h-16 w-16 rounded-lg object-cover ring-2 ring-gold-200" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-emerald-600 ring-1 ring-emerald-200">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-emerald-700">Uploaded successfully</p>
            <p className="truncate text-xs text-legal-muted">{file}</p>
          </div>
          <Badge tone="green">✓</Badge>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
            drag ? "border-gold-400 bg-gold-50" : "border-primary-200 bg-primary-50/40 hover:border-gold-300 hover:bg-gold-50/40"
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 ring-1 ring-primary-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-primary-800">Drag &amp; drop here or click to browse</span>
          <span className="text-xs text-legal-muted">{desc}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
