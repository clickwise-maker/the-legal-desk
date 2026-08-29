import Link from "next/link";
import { cn } from "@/lib/constants";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 shadow-gold">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
          <path d="M22 12v9H2v-9" />
        </svg>
      </span>
      <span className="font-heading text-xl font-bold tracking-tight text-primary-800">
        Legal<span className="text-gold-500">Flow</span>
      </span>
    </Link>
  );
}
