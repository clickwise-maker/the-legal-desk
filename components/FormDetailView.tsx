"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDate, formatINR } from "@/lib/constants";
import { usePayment } from "@/lib/use-payment";
import { StatusBadge, Badge, Card, Button } from "@/components/ui";

type FormField = { id: string; label: string; fieldType: string; value: string; confidence: number; order: number };
type MatchMetrics = {
  detected: number;
  autoFillable: number;
  missing: number;
  matchPercent: number;
  autoFilledLabels: string[];
  missingLabels: string[];
};
type FormDetail = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  status: string;
  price: number;
  createdAt: string;
  ocrText: string;
  fields: FormField[];
  metrics: MatchMetrics | null;
  booking: { id: string; lawyer: { name: string } } | null;
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-primary-50/60 px-4 py-3">
      <div className="font-heading text-xl font-bold text-primary-800">{value}</div>
      <div className="mt-0.5 text-xs text-legal-muted">{label}</div>
    </div>
  );
}

type FieldStatus = "profile" | "manual" | "empty";

// Derive where a field's current value came from, for the review screen.
function fieldStatus(f: FormField): FieldStatus {
  if (!f.value || !f.value.trim()) return "empty";
  return f.confidence >= 0.8 ? "profile" : "manual";
}

function SourceBadge({ f }: { f: FormField }) {
  const s = fieldStatus(f);
  if (s === "profile") {
    return <Badge tone="green">✓ Profile</Badge>;
  }
  if (s === "manual") {
    return <Badge tone="gold">⚠️ Manual — please verify</Badge>;
  }
  return <Badge tone="red">❌ Needs input</Badge>;
}

export function FormDetailView() {
  const { id } = useParams<{ id: string }>();
  const { pay, status: payStatus, error: payError } = usePayment();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [saveMap, setSaveMap] = useState<Record<string, boolean>>({});
  const [showFilled, setShowFilled] = useState(false);
  const [editingAll, setEditingAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/forms/${id}`);
    if (res.ok) {
      const d = await res.json();
      setForm(d);
      setSaveMap((prev) => {
        const next = { ...prev };
        for (const f of d.fields as FormField[]) if (!(f.label in next)) next[f.label] = true;
        return next;
      });
    } else {
      setError("Form not found");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { missing, filled } = useMemo(() => {
    const all = form?.fields ?? [];
    return {
      missing: all.filter((f) => !f.value || !f.value.trim()),
      filled: all.filter((f) => f.value && f.value.trim()),
    };
  }, [form]);

  async function handleProcess() {
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/forms/${id}/process`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Processing failed");
        setProcessing(false);
        await load();
        return;
      }
      const auto = data.autoFilled ?? 0;
      const miss = data.missing ?? 0;
      setMessage(
        miss === 0
          ? `Filled ${auto} field${auto === 1 ? "" : "s"} automatically from your profile. Nothing more needed.`
          : `Filled ${auto} field${auto === 1 ? "" : "s"} from your profile. Answer the ${miss} remaining below.`
      );
      await load();
    } catch {
      setError("Processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function updateField(label: string, value: string) {
    if (!form) return;
    const fields = form.fields.map((f) => (f.label === label ? { ...f, value } : f));
    setForm({ ...form, fields });
  }

  async function handleSaveAndContinue() {
    if (!form) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/forms/${id}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: missing.map((f) => ({
            label: f.label,
            value: f.value,
            fieldType: f.fieldType,
            order: f.order,
            saveToProfile: saveMap[f.label] ?? true,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (data.savedToProfile > 0) {
        setMessage(`Saved ${data.savedToProfile} answer${data.savedToProfile === 1 ? "" : "s"} to your profile — they'll be reused in future forms.`);
      } else {
        setMessage("Values saved.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoFill() {
    if (!form) return;
    setAutofilling(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/forms/${id}/autofill`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Auto-fill failed");
      const m = data.metrics;
      setMessage(
        `Auto-filled ${data.filledCount} field${data.filledCount === 1 ? "" : "s"} from your profile. ` +
        `${m.missing} of ${m.detected} fields still need your input.`
      );
      setEditingAll(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-fill failed");
    } finally {
      setAutofilling(false);
    }
  }

  async function handleSaveDraft() {
    if (!form) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const fieldsToSave = editingAll ? form.fields : missing;
      const res = await fetch(`/api/forms/${id}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fieldsToSave.map((f) => ({
            label: f.label,
            value: f.value,
            fieldType: f.fieldType,
            order: f.order,
            saveToProfile: saveMap[f.label] ?? true,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage(
        data.missingCount === 0
          ? "Draft saved — all fields filled. You can pay & download now."
          : `Draft saved. ${data.missingCount} field${data.missingCount === 1 ? "" : "s"} still missing — you can continue later.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePayAndDownload() {
    if (!form) return;
    setError("");
    const res = await fetch(`/api/forms/${id}/pay`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create payment");
      return;
    }
    if (data.alreadyPaid) {
      await download();
      return;
    }
    try {
      await pay({
        type: "FORM",
        referenceId: id,
        orderId: data.orderId,
        amountInr: data.amountInr,
        description: `AI form filling: ${form.title}`,
      });
      await download();
    } catch {
      // error handled below
    }
  }

  async function handleSubmitForm() {
    if (!form) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/forms/${id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");
      setMessage("Form submitted. Your filled copy is ready to download.");
      setConfirming(false);
      await load();
      await download();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function download() {
    setDownloading(true);
    setError("");
    try {
      const res = await fetch(`/api/forms/${id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = form?.fileName ?? "filled-form.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Filled form downloaded.");
      await load();
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <div className="card h-96 animate-pulse bg-primary-50/50" />;
  if (!form) {
    return (
      <div className="card p-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary-800">Form not found</h1>
        <a href="/forms" className="btn-outline mt-5">Back to forms</a>
      </div>
    );
  }

  const canDownload = form.status === "COMPLETED";

  return (
    <div className="container-legal py-10">
      <Link href="/forms" className="text-sm font-medium text-gold-500 hover:text-gold-400">← All forms</Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header card */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-heading text-2xl font-bold text-primary-800">{form.title}</h1>
                  <StatusBadge status={form.status} />
                </div>
                <p className="mt-1 text-sm text-legal-muted">
                  {form.fileName} · {formatDate(form.createdAt)} · {form.fileType}
                </p>
              </div>
              <a
                href={form.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-outline"
              >
                View original
              </a>
            </div>

            {form.booking && (
              <p className="mt-4 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
                Shared with your lawyer <strong>{form.booking.lawyer.name}</strong> for consultation.
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-5 flex flex-wrap gap-3">
              {(form.status === "UPLOADED" || form.status === "FAILED") && (
                <Button variant="primary" onClick={handleProcess} disabled={processing}>
                  {processing ? "Running OCR + AI…" : "Process with AI"}
                </Button>
              )}
              {form.status === "PROCESSING" && (
                <div className="flex items-center gap-2 text-sm text-gold-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
                  AI is reading your form…
                </div>
              )}
              {canDownload && (
                <Button variant="gold" onClick={download} disabled={downloading}>
                  {downloading ? "Downloading…" : "Download filled PDF"}
                </Button>
              )}
            </div>

            {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</p>}
            {(error || payError) && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error || payError}</p>
            )}
          </Card>

          {/* Form workspace — stats, auto-fill, review, draft */}
          {(form.status === "FILLED" || form.status === "DRAFT") && (
            <>
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-primary-800">
                      {missing.length === 0 ? "All fields filled" : `${missing.length} question${missing.length === 1 ? "" : "s"} left`}
                    </h2>
                    <p className="mt-1 text-sm text-legal-muted">
                      {missing.length === 0
                        ? "Everything was answered from your profile. Pay and download the filled PDF."
                        : "Answer only what's missing — answers are saved to your profile and reused in future forms."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="primary">{filled.length} filled from profile</Badge>
                    {missing.length > 0 && <Badge tone="gold">{missing.length} missing</Badge>}
                  </div>
                </div>

                {/* Profile-match stats */}
                {form.metrics && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <Metric label="Profile match" value={`${form.metrics.matchPercent}%`} />
                    <Metric label="Detected fields" value={form.metrics.detected} />
                    <Metric label="Auto-fillable" value={form.metrics.autoFillable} />
                    <Metric label="Missing" value={form.metrics.missing} />
                  </div>
                )}

                {/* Workspace actions */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="primary" onClick={handleAutoFill} disabled={autofilling}>
                    {autofilling ? "Auto-filling…" : "Auto-fill"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingAll(true)}>Review fields</Button>
                  <Button variant="outline" onClick={() => setEditingAll(true)}>Fill manually</Button>
                  <Button variant="ghost" onClick={handleSaveDraft} disabled={saving}>
                    {saving ? "Saving…" : "Save draft"}
                  </Button>
                </div>

                {missing.length > 0 && !editingAll ? (
                  <>
                    <div className="mt-6 space-y-5">
                      {missing.map((f) => (
                        <div key={f.id ?? f.label}>
                          <label className="label">{f.label}</label>
                          <textarea
                            className="input min-h-11"
                            rows={f.value.length > 60 ? 3 : 1}
                            value={f.value}
                            onChange={(e) => updateField(f.label, e.target.value)}
                            disabled={canDownload}
                          />
                          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-legal-muted">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-gold-500"
                              checked={saveMap[f.label] ?? true}
                              onChange={(e) => setSaveMap({ ...saveMap, [f.label]: e.target.checked })}
                            />
                            Save to my profile so it&apos;s reused in future forms
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button variant="primary" onClick={handleSaveAndContinue} disabled={saving}>
                        {saving ? "Saving…" : "Save & continue"}
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-legal-muted">
                      You can leave some blank and save a draft — you&apos;ll only be asked for what&apos;s still missing.
                    </p>
                  </>
                ) : (
                  <div className="mt-6">
                    {missing.length === 0 && !editingAll && (
                      <div className="flex flex-wrap gap-3">
                        <Button variant="gold" onClick={handlePayAndDownload} disabled={payStatus === "processing" || downloading}>
                          {payStatus === "processing" || downloading
                            ? "Processing…"
                            : `Pay ${formatINR(form.price)} & download`}
                        </Button>
                        <Button variant="outline" onClick={() => setConfirming(true)} disabled={submitting}>
                          Submit form
                        </Button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-legal-muted">
                      Review every answer, then submit. Pay once to download the filled PDF and share it with your
                      lawyer during a booked consultation.
                    </p>
                  </div>
                )}
              </Card>

              {/* Full field editor for Review / Fill manually */}
              {editingAll && (
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-lg font-bold text-primary-800">Review all fields</h2>
                    <button type="button" className="btn-ghost text-sm" onClick={() => setEditingAll(false)}>Back to summary</button>
                  </div>
                  <p className="mt-1 text-sm text-legal-muted">Edit any value. Changes below are saved when you click Save changes.</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge tone="green">✓ filled from your profile</Badge>
                    <Badge tone="gold">⚠️ entered manually — verify</Badge>
                    <Badge tone="red">❌ still needs your input</Badge>
                  </div>
                  <div className="mt-5 space-y-4">
                    {form.fields.map((f) => (
                      <div key={f.id ?? f.label}>
                        <div className="flex items-center justify-between gap-3">
                          <label className="label">{f.label}</label>
                          <SourceBadge f={f} />
                        </div>
                        <textarea
                          className="input min-h-11"
                          rows={f.value.length > 60 ? 3 : 1}
                          value={f.value}
                          onChange={(e) => updateField(f.label, e.target.value)}
                          disabled={canDownload}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button variant="primary" onClick={handleSaveDraft} disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Auto-filled values, collapsed */}
              {filled.length > 0 && (
                <Card className="p-6">
                  <button
                    type="button"
                    onClick={() => setShowFilled(!showFilled)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-heading text-lg font-bold text-primary-800">
                      Auto-filled from your profile ({filled.length})
                    </span>
                    <span className="text-sm text-gold-500">{showFilled ? "Hide" : "Show"}</span>
                  </button>
                  {showFilled && (
                    <ul className="mt-4 divide-y divide-primary-50">
                      {filled.map((f) => (
                        <li key={f.id ?? f.label} className="flex justify-between gap-4 py-2 text-sm">
                          <span className="text-primary-800">{f.label}</span>
                          <span className="max-w-[60%] text-right text-legal-muted">{f.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </>
          )}

          {/* No fields detected */}
          {form.fields.length === 0 && (
            <Card className="p-10 text-center">
              {form.status === "PROCESSING" ? (
                <p className="text-legal-muted">Detecting fields…</p>
              ) : (
                <>
                  <h2 className="font-heading text-lg font-bold text-primary-800">No fields detected yet</h2>
                  <p className="mt-2 text-sm text-legal-muted">
                    {form.status === "UPLOADED"
                      ? "Run the AI processor to extract fields from this form."
                      : "This document didn't produce detectable fields."}
                  </p>
                </>
              )}
            </Card>
          )}

          {/* Share with lawyer */}
          {form.status === "COMPLETED" && (
            <Card className="p-6">
              <h2 className="font-heading text-lg font-bold text-primary-800">Share with a lawyer</h2>
              <p className="mt-1 text-sm text-legal-muted">
                Book a consultation and attach this filled form for review.
              </p>
              <Link href="/lawyers" className="btn-gold mt-4">Find a lawyer</Link>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary-800">OCR preview</h3>
            <p className="mt-1 text-xs text-legal-muted">
              Raw text extracted from your document.
            </p>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-primary-50 p-4 text-xs leading-relaxed text-primary-800 whitespace-pre-wrap">
              {form.ocrText || "(No text extracted yet)"}
            </pre>
          </Card>

          <Card className="p-6">
            <h3 className="font-heading text-lg font-bold text-primary-800">Pricing</h3>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-legal-muted">AI form filling</span>
              <span className="font-heading text-lg font-bold text-primary-800">{formatINR(form.price)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-legal-muted">
              Pay once, download the filled PDF, and share it with your lawyer
              during a booked consultation.
            </p>
          </Card>

          {form.status === "FILLED" && missing.length === 0 && (
            <div className="rounded-xl border border-gold-200 bg-gold-50 p-5">
              <div className="flex items-center gap-2 text-gold-500">
                <Badge tone="gold">Almost done</Badge>
              </div>
              <p className="mt-2 text-sm text-primary-800">
                Pay {formatINR(form.price)} to unlock the downloadable filled PDF.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm & Submit modal */}
      {confirming && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-900/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-heading text-xl font-bold text-primary-800">Confirm your answers</h2>
            <p className="mt-1 text-sm text-legal-muted">
              Review each value before submitting. This is your final copy — you can still edit later if needed.
            </p>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-primary-100 p-3">
              {form.fields.map((f) => (
                <li key={f.id ?? f.label} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-800">{f.label}</p>
                    <p className="truncate text-legal-muted">{f.value}</p>
                  </div>
                  <div className="shrink-0">
                    <SourceBadge f={f} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="gold" onClick={handleSubmitForm} disabled={submitting}>
                {submitting ? "Submitting…" : "Confirm & submit"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
                Keep editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
