export const PLATFORM_COMMISSION_PERCENT = 12;
export const FORM_FILL_PRICE = 5;

export const SPECIALIZATIONS = [
  "Criminal Law",
  "Family Law",
  "Corporate Law",
  "Property & Real Estate",
  "Tax Law",
  "Intellectual Property",
  "Civil Litigation",
  "Employment Law",
  "Immigration Law",
  "Contract Law",
  "Consumer Protection",
  "Bankruptcy & Insolvency",
] as const;

export const LEGAL_CATEGORIES = [
  { label: "Family Law", color: "#d69e2e" },
  { label: "Property", color: "#1a365d" },
  { label: "Taxation", color: "#2f855a" },
  { label: "Corporate", color: "#2b6cb0" },
];

// Lawyer onboarding — expertise tag options (areas of practice)
export const ONBOARDING_SPECIALIZATIONS = [
  "Civil",
  "Criminal",
  "Corporate",
  "Family",
  "Intellectual Property",
  "Real Estate",
  "Tax Law",
] as const;

// Lawyer onboarding — courts of practice tag options
export const COURTS_OF_PRACTICE = [
  "Supreme Court of India",
  "High Court",
  "District/Sessions Court",
  "Consumer Forum",
  "Tribunals",
] as const;

export const ENROLMENT_YEAR_START = 1980;
export const ENROLMENT_YEAR_END = new Date().getFullYear();

export function enrolmentYearOptions(): number[] {
  const years: number[] = [];
  for (let y = ENROLMENT_YEAR_END; y >= ENROLMENT_YEAR_START; y--) years.push(y);
  return years;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calcCommission(price: number, percent = PLATFORM_COMMISSION_PERCENT) {
  const commissionAmount = Math.round(price * (percent / 100) * 100) / 100;
  const lawyerEarning = Math.round((price - commissionAmount) * 100) / 100;
  return { commissionAmount, lawyerEarning };
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
