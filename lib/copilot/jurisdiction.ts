export const JURISDICTIONS = ["GLOBAL", "IN", "US", "UK", "EU", "CA", "AU", "SG"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  GLOBAL: "Global",
  IN: "India",
  US: "United States",
  UK: "United Kingdom",
  EU: "European Union",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
};

export function parseJurisdiction(input?: string | null): Jurisdiction {
  const v = (input ?? "GLOBAL").toUpperCase().trim();
  return (JURISDICTIONS as readonly string[]).includes(v) ? (v as Jurisdiction) : "GLOBAL";
}

export function jurisdictionPromptHint(j: Jurisdiction): string {
  if (j === "GLOBAL") return "You are a worldwide legal copilot. Cite the governing jurisdiction for every rule you mention.";
  if (j === "IN") return "You are an India-focused legal copilot (BNS/BNSS/BSA 2023, CPA 2019, IT Act). Distinguish pre-2024 IPC/CrPC vs post-2024 BNS/BNSS where relevant.";
  return `You are a ${JURISDICTION_LABELS[j]} legal copilot. Anchor answers in ${JURISDICTION_LABELS[j]} law and note cross-border limits.`;
}
