"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/Logo";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "CLIENT",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      const signInRes = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (signInRes?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-legal flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-bold text-primary-800">Create your account</h1>
          <p className="mt-2 text-sm text-legal-muted">
            Join as a client or a lawyer on LegalFlow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-8">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input
              id="name"
              className="input"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Aarav Sharma"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="label">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["CLIENT", "Client", "I need legal help"],
                ["LAWYER", "Lawyer", "I offer services"],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, role: value })}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    form.role === value
                      ? "border-gold-400 bg-gold-50 ring-2 ring-gold-200"
                      : "border-primary-200 bg-white hover:border-primary-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-primary-800">{label}</div>
                  <div className="text-xs text-legal-muted">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p className="text-center text-sm text-legal-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-gold-500 hover:text-gold-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
