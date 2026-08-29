"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/Logo";

type Mode = "password" | "otp";

const AUTH_MODES = [
  { id: "gmail", label: "Gmail", icon: "G" },
  { id: "otp", label: "Secure OTP", icon: "OTP" },
  { id: "epos", label: "EPOS", icon: "EP" },
  { id: "eproxy", label: "e-Proxy", icon: "PX" },
  { id: "biometric", label: "Biometric", icon: "✱" },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("password");
  const [form, setForm] = useState({ email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }
      const next = params.get("callbackUrl") ?? "/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: form.email,
        password: otp,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid or expired OTP. Please try again.");
        return;
      }
      const next = params.get("callbackUrl") ?? "/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(resend = false) {
    setOtpLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/otp/${resend ? "resend" : "request"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send OTP");
        if (data.resendAfterMs) startCooldown(data.resendAfterMs);
        return;
      }
      setOtpSent(true);
      setOtpDevCode(data.devCode ?? "");
      if (data.resendAfterMs) startCooldown(data.resendAfterMs);
      else startCooldown(60000);
    } catch {
      setError("Could not send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  function startCooldown(ms: number) {
    setCooldown(Math.ceil(ms / 1000));
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <div className="container-legal flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-bold text-primary-800">Welcome back</h1>
          <p className="mt-2 text-sm text-legal-muted">Sign in securely to your LegalFlow account.</p>
        </div>

        <div className="card p-8">
          {/* Auth mode tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-primary-50 p-1">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${mode === "password" ? "bg-white text-primary-800 shadow-sm" : "text-legal-muted hover:text-primary-700"}`}
              onClick={() => setMode("password")}
            >
              Password
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${mode === "otp" ? "bg-white text-primary-800 shadow-sm" : "text-legal-muted hover:text-primary-700"}`}
              onClick={() => setMode("otp")}
            >
              Email OTP
            </button>
          </div>

          {/* Mode badge strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {AUTH_MODES.map((m) => (
              <span
                key={m.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                  m.id === "otp" || m.id === "gmail"
                    ? "bg-gold-50 text-gold-600 ring-gold-200"
                    : "bg-primary-50 text-legal-muted ring-primary-100"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold">{m.icon}</span>
                {m.label}
              </span>
            ))}
          </div>

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="text-xs font-medium text-gold-500 hover:text-gold-400"
                    onClick={() => {
                      setMode("otp");
                      setError("");
                    }}
                  >
                    Forgot password? Use OTP
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  className="input"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Your password"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="otpEmail">Email</label>
                <input
                  id="otpEmail"
                  type="email"
                  className="input"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => requestOtp(false)}
                  disabled={otpLoading || !form.email}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {otpLoading ? "Sending code…" : "Send OTP"}
                </button>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="otpCode">6-digit code</label>
                    <input
                      id="otpCode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="input text-center font-mono text-lg tracking-widest"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                    />
                    {otpDevCode && (
                      <p className="mt-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-600">
                        Dev mode — your code: <span className="font-mono font-bold">{otpDevCode}</span>
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={loading || otp.length !== 6} className="btn-gold w-full disabled:opacity-60">
                    {loading ? "Verifying…" : "Verify & sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestOtp(true)}
                    disabled={cooldown > 0 || otpLoading}
                    className="btn-ghost w-full text-sm disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : otpLoading ? "Resending…" : "Resend OTP"}
                  </button>
                </>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-sm text-legal-muted">
            New to LegalFlow?{" "}
            <Link href="/signup" className="font-semibold text-gold-500 hover:text-gold-400">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-legal-muted">
            EPOS, e-Proxy and biometric login are rolling out to verified accounts soon.
          </p>
        </div>
      </div>
    </div>
  );
}
