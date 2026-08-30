"use client";

import { useEffect, useState } from "react";

type Problem = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  status: string;
  ownerFirstName: string;
  responseCount: number;
  createdAt: string;
};

export function LawyerRequestsView() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (location) q.set("location", location);
    const res = await fetch(`/api/lawyer/requests?${q.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.problems)) {
      setProblems(data.problems);
      setRemaining(data.remaining);
      setLimit(data.limit);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function handleRespond(id: string) {
    const message = msg[id];
    if (!message || message.trim().length < 20) {
      alert("Response must be 20-2000 characters");
      return;
    }
    setSending(id);
    const res = await fetch(`/api/problems/${id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Failed");
    } else {
      setMsg((m) => ({ ...m, [id]: "" }));
      load();
    }
    setSending(null);
  }

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-3xl font-bold text-primary-800">Open Legal Problems</h1>
        <p className="mt-2 text-legal-muted">Eligible OPEN problems only. You see title, category, location, and client first name — never email/phone. One response per problem. Monthly allowance: {remaining ?? "—"} / {limit ?? 10} remaining.</p>

        <div className="mt-6 flex gap-3">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option>Civil</option>
            <option>Criminal</option>
            <option>Family</option>
            <option>Property</option>
            <option>Corporate</option>
            <option>Consumer</option>
            <option>Employment</option>
          </select>
          <input className="input" placeholder="Filter by location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <button onClick={load} className="btn-primary">Filter</button>
        </div>

        {loading ? (
          <p className="mt-6 text-legal-muted">Loading…</p>
        ) : problems.length === 0 ? (
          <p className="mt-6 text-legal-muted">No open problems match your filters.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {problems.map((p) => (
              <li key={p.id} className="card p-5">
                <div className="font-semibold text-primary-800">{p.title}</div>
                <div className="text-sm text-legal-muted">{p.category} · {p.location ?? "—"} · by {p.ownerFirstName} · {new Date(p.createdAt).toLocaleDateString()}</div>
                <p className="mt-2 text-sm text-legal-700">{p.description}</p>
                <div className="mt-3">
                  <textarea className="input min-h-[80px]" placeholder="Your response (20-2000 chars, no scripts)" value={msg[p.id] ?? ""} onChange={(e) => setMsg((m) => ({ ...m, [p.id]: e.target.value }))} maxLength={2000} />
                  <button onClick={() => handleRespond(p.id)} disabled={sending === p.id} className="btn-gold mt-2">
                    {sending === p.id ? "Sending…" : "Submit Response"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
