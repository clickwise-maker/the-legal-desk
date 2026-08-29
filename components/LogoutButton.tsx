"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * Functional logout: invalidates pending OTP tokens server-side, clears the
 * NextAuth session, and redirects immediately to the login page.
 */
export function LogoutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Session cleanup still happens via signOut below.
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={className ?? "btn-ghost flex items-center gap-1.5 text-sm"}
      title="Log out of LegalFlow"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}
