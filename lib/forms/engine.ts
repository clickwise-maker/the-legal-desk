import type { DetectedField } from "@/lib/ai/deepseek";
import type { ProfileContext } from "@/lib/profile";
import { profileLookup, normalizeLabel, saveProfileItems } from "@/lib/profile";

export type EngineField = DetectedField & {
  value: string;
  autoFilled: boolean;
};

/**
 * Fill detected fields from the profile knowledge base first.
 * Fields with no match stay empty — those are the only ones the user is asked for.
 */
export function fillFromProfile(
  detected: DetectedField[],
  ctx: ProfileContext
): { fields: EngineField[]; autoFilled: number; missing: number } {
  const lookup = profileLookup(ctx);
  const fields: EngineField[] = detected.map((f) => {
    const value = lookup.get(normalizeLabel(f.label)) ?? "";
    return { ...f, value, autoFilled: Boolean(value) };
  });
  return {
    fields,
    autoFilled: fields.filter((f) => f.autoFilled).length,
    missing: fields.filter((f) => !f.autoFilled).length,
  };
}

/**
 * Save user-entered answers into the profile knowledge base so future
 * forms reuse them. Returns the count saved.
 */
export async function saveAnswersToProfile(
  userId: string,
  fields: { label: string; value: string }[],
  formId: string
): Promise<number> {
  const entries = fields
    .filter((f) => f.value && f.value.trim())
    .map((f) => ({ label: f.label, value: f.value.trim(), sourceFormId: formId }));
  if (entries.length === 0) return 0;
  return saveProfileItems(userId, entries, { approved: true });
}

/**
 * Fields that still have no value — the missing info to ask next.
 */
export function stillMissing(fields: { label: string; value: string }[]): string[] {
  return fields.filter((f) => !f.value || !f.value.trim()).map((f) => f.label);
}

export type FormMatchMetrics = {
  detected: number;
  autoFillable: number;
  missing: number;
  matchPercent: number;
  autoFilledLabels: string[];
  missingLabels: string[];
};

/**
 * Compute profile-match metrics for a set of detected fields: how many map
 * to the knowledge base, how many would still need manual answers.
 */
export function computeFormMetrics(
  fields: { label: string; value: string }[],
  ctx: ProfileContext
): FormMatchMetrics {
  const lookup = profileLookup(ctx);
  let autoFillable = 0;
  const autoFilledLabels: string[] = [];
  const missingLabels: string[] = [];

  for (const f of fields) {
    const hit = lookup.get(normalizeLabel(f.label));
    if (hit) {
      autoFillable += 1;
      autoFilledLabels.push(f.label);
    } else {
      missingLabels.push(f.label);
    }
  }

  const detected = fields.length;
  const missing = detected - autoFillable;
  const matchPercent = detected === 0 ? 0 : Math.round((autoFillable / detected) * 100);

  return { detected, autoFillable, missing, matchPercent, autoFilledLabels, missingLabels };
}

/**
 * Re-match the current detected fields against the profile KB and fill the
 * still-empty ones. Returns the updated fields plus match metrics.
 */
export async function autofillFromProfile(
  fields: { id: string; label: string; value: string }[],
  ctx: ProfileContext
): Promise<{ fields: { id: string; label: string; value: string }[]; filledCount: number; metrics: FormMatchMetrics }> {
  const lookup = profileLookup(ctx);
  let filledCount = 0;
  const next = fields.map((f) => {
    if (f.value && f.value.trim()) return f;
    const value = lookup.get(normalizeLabel(f.label)) ?? "";
    if (value) filledCount += 1;
    return { ...f, value };
  });
  return { fields: next, filledCount, metrics: computeFormMetrics(next, ctx) };
}
