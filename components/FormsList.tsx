"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, formatINR } from "@/lib/constants";
import { StatusBadge, Badge } from "@/components/ui";

type FormItem = {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  status: string;
  price: number;
  createdAt: string;
  _count: { fields: number };
};

export function FormsList() {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/forms");
      const data = await res.json();
      setForms(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title.trim() || file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/forms", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setTitle("");
      await load();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Upload */}
      <div className="card p-6">
        <label className="label" htmlFor="title">Form title (optional)</label>
        <input
          id="title"
          className="input max-w-md"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Rental Agreement"
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`mt-4 rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-gold-400 bg-gold-50" : "border-primary-200 bg-primary-50/30"
          }`}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gold-50 text-gold-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6M9 15l3-3 3 3" />
            </svg>
          </div>
          <h3 className="mt-4 font-heading font-bold text-primary-800">Upload a legal form</h3>
          <p className="mt-1 text-sm text-legal-muted">
            Drag & drop a PDF, PNG, JPEG or WEBP here — or
          </p>
          <label className="btn-primary mt-4 inline-flex cursor-pointer">
            {uploading ? "Uploading…" : "Browse files"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-4 text-xs text-legal-muted">
            AI OCR extracts your form, detects every field, and fills it. {formatINR(5)} per form after processing.
          </p>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
          )}
        </div>
      </div>

      {/* List */}
      <div>
        <h2 className="font-heading text-xl font-bold text-primary-800">Your forms</h2>
        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-20 animate-pulse bg-primary-50/50" />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="card mt-4 p-10 text-center">
            <h3 className="font-heading font-bold text-primary-800">No forms yet</h3>
            <p className="mt-2 text-sm text-legal-muted">Upload your first form above to get AI-assisted filling.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {forms.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/forms/${f.id}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-5 transition hover:border-gold-300"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-600 text-white">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-primary-800">{f.title}</div>
                      <div className="text-xs text-legal-muted">
                        {f.fileName} · {f._count.fields} fields · {formatDate(f.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={f.status} />
                    <span className="text-sm font-semibold text-primary-800">{formatINR(f.price)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
