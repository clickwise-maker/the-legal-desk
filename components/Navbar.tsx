import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export async function Navbar() {
  const session = await getServerSession(authOptions);

  const links = [
    { href: "/copilot", label: "Copilot" },
    { href: "/lawyers", label: "Lawyers" },
    { href: "/forms", label: "Forms" },
    { href: "/scheduleai", label: "ScheduleAI" },
    { href: "/pricing", label: "Pricing" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-primary-100/70 bg-white/90 backdrop-blur">
      <div className="container-legal flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-primary-700 transition hover:text-gold-500"
            >
              {l.label}
            </Link>
          ))}
          {session?.user && (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-primary-700 transition hover:text-gold-500">
                Dashboard
              </Link>
              <Link href="/profile" className="text-sm font-medium text-primary-700 transition hover:text-gold-500">
                Profile
              </Link>
              <Link href="/cv" className="text-sm font-medium text-primary-700 transition hover:text-gold-500">
                CV
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="btn-primary hidden sm:inline-flex">
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white"
                title={session.user.name ?? "Account"}
              >
                {(session.user.name ?? "U").slice(0, 1).toUpperCase()}
              </Link>
              <LogoutButton className="btn-ghost hidden items-center gap-1.5 border border-red-100 text-sm text-red-600 hover:bg-red-50 sm:inline-flex" />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">
                Sign in
              </Link>
              <Link href="/signup" className="btn-gold">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
