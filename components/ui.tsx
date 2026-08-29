import { cn } from "@/lib/constants";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "outline" | "ghost";
}) {
  const variants = {
    primary: "btn-primary",
    gold: "btn-gold",
    outline: "btn-outline",
    ghost: "btn-ghost",
  } as const;
  return <button className={cn(variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function Badge({
  className,
  tone = "primary",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "primary" | "gold" | "green" | "red" | "gray";
}) {
  const tones = {
    primary: "bg-primary-50 text-primary-700 ring-1 ring-primary-100",
    gold: "bg-gold-50 text-gold-500 ring-1 ring-gold-100",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-1 ring-red-100",
    gray: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  } as const;
  return <span className={cn("badge", tones[tone], className)} {...props} />;
}

export function Stars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gold-500" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={cn("h-4 w-4", i <= Math.round(score) ? "fill-gold-400" : "fill-primary-100")}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "gold" | "green" | "red" | "gray" | "primary"; label: string }> = {
    PENDING: { tone: "gold", label: "Pending" },
    CONFIRMED: { tone: "primary", label: "Confirmed" },
    COMPLETED: { tone: "green", label: "Completed" },
    CANCELLED: { tone: "red", label: "Cancelled" },
    NO_SHOW: { tone: "red", label: "No-show" },
    UPLOADED: { tone: "gray", label: "Uploaded" },
    PROCESSING: { tone: "gold", label: "Processing" },
    FILLED: { tone: "primary", label: "Filled" },
    DRAFT: { tone: "gold", label: "Draft" },
    FAILED: { tone: "red", label: "Failed" },
  };
  const s = map[status] ?? { tone: "gray" as const, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
