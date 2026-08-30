"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button } from "@/components/ui";

type Problem = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  status: string;
  createdAt: string;
  _count?: { responses: number };
};

export function ProblemsView() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Civil");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/problems", { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) setProblems(data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, location: location || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setTitle("");
      setDescription("");
      setLocation("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(id: string) {
    const res = await fetch(`/api/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    if (res.ok) load();
    else alert((await res.json().catch(() => ({}))).error ?? "Failed to close");
  }

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl font-bold text-primary-800">My Legal Problems</h1>
        <p className="mt-2 text-legal-muted">Post a legal problem, track responses, and close when resolved. Only you can see your posts; lawyers see only title, category, location, and your first name.</p>

        <Card className="mt-8 p-6">
          <h2 className="font-heading font-bold text-primary-800">Create a new problem</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <input className="input" placeholder="Title (5-120 chars)" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={120} />
            <textarea className="input min-h-[100px]" placeholder="Description (20-5000 chars) — be specific, no scripts" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={20} maxLength={5000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Civil</option>
                <option>Criminal</option>
                <option>Family</option>
                <option>Property</option>
                <option>Corporate</option>
                <option>Consumer</option>
                <option>Employment</option>
              </select>
              <input className="input" placeholder="Location (city/state, optional)" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Posting…" : "Post Problem"}
            </Button>
          </form>
        </Card>

        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold text-primary-800">Your posts</h2>
          {loading ? (
            <p className="mt-4 text-legal-muted">Loading…</p>
          ) : problems.length === 0 ? (
            <p className="mt-4 text-legal-muted">No problems yet. Create one above.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {problems.map((p) => (
                <li key={p.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-primary-800">{p.title}</div>
                      <div className="mt-1 text-sm text-legal-muted">{p.category} · {p.location ?? "—"} · {p.status} · {new Date(p.createdAt).toLocaleDateString()}</div>
                      <p className="mt-2 text-sm text-legal-700 line-clamp-3">{p.description}</p>
                      <div className="mt-2 text-xs text-legal-muted">{p._count?.responses ?? 0} lawyer responses</div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Link href={`/problems/${p.id}`} className="btn-outline text-sm">View</Link>
                      {p.status === "OPEN" && <button onClick={() => handleClose(p.id)} className="btn-ghost text-sm">Close</button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
