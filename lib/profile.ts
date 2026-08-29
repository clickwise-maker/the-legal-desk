import { prisma } from "@/lib/prisma";
import type { ProfileItem, User } from "@prisma/client";

export type ProfileContext = {
  items: ProfileItem[];
  user: User | null;
};

/**
 * Load the user's profile knowledge base (ProfileItem rows) plus the
 * structured fields on the User row. Returns a map keyed by normalized
 * label so the form engine can look up answers for detected fields.
 */
export async function getProfileContext(userId: string): Promise<ProfileContext> {
  const [items, user] = await Promise.all([
    prisma.profileItem.findMany({
      where: { userId, approved: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  return { items, user };
}

/**
 * Build a lookup map: normalized-label -> value, from the profile KB
 * plus structured user fields (name, email, phone, address, etc.).
 */
export function profileLookup(ctx: ProfileContext): Map<string, string> {
  const map = new Map<string, string>();
  const set = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) map.set(normalizeLabel(label), value.trim());
  };

  for (const it of ctx.items) {
    if (!map.has(normalizeLabel(it.label))) set(it.label, it.value);
  }

  const u = ctx.user;
  if (u) {
    set("Full name", u.name);
    set("Name", u.name);
    set("Applicant name", u.name);
    set("Email", u.email);
    set("Email address", u.email);
    set("Phone", u.phone);
    set("Phone number", u.phone);
    set("Mobile number", u.phone);
    set("Primary phone", u.phone);
    set("Alternate phone", u.alternatePhone);
    set("Address", u.address);
    set("Address line 1", u.address ?? u.addressLine1);
    set("Address line 2", u.addressLine2);
    set("City", u.city);
    set("State", u.state);
    set("Pincode", u.pincode);
    set("PIN code", u.pincode);
    set("Postal code", u.pincode);
    set("Date of birth", u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : undefined);
    set("DOB", u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : undefined);
    set("Occupation", u.occupation);
    set("Profession", u.occupation);
    set("Company name", u.companyName);
    set("Employer name", u.companyName);
    set("Employer", u.companyName);
    set("First name", u.firstName);
    set("Given name", u.firstName);
    set("Middle name", u.middleName);
    set("Last name", u.lastName);
    set("Surname", u.lastName);
    set("Family name", u.lastName);
    set("Gender", u.gender);
    set("Nationality", u.nationality);
    set("Designation", u.designation);
    set("Job title", u.designation);
    set("Work address", u.workAddress);
    set("Previous employer", u.previousEmployer);
    set("District", u.district);
    set("Country", u.country);
    set("Village", u.village);
    set("Permanent address", u.permanentAddress);
    set("Correspondence address", u.correspondenceAddress);
    if (u.experienceYears != null) set("Years of experience", String(u.experienceYears));
    set("Experience", u.experienceYears != null ? `${u.experienceYears} years` : undefined);
  }

  return map;
}

/**
 * Render the profile KB as a compact context block for the AI.
 */
export function profileContextForAI(ctx: ProfileContext): string {
  const lines: string[] = [];
  const byCat = new Map<string, string[]>();
  for (const it of ctx.items) {
    if (!it.value) continue;
    const arr = byCat.get(it.category) ?? [];
    arr.push(`${it.label}: ${it.value}`);
    byCat.set(it.category, arr);
  }
  Array.from(byCat.entries()).forEach(([cat, vals]) => {
    lines.push(`${cat}:\n  ${vals.join("\n  ")}`);
  });
  const u = ctx.user;
  if (u) {
    const personal: string[] = [`Name: ${u.name}`, `Email: ${u.email}`];
    if (u.phone) personal.push(`Phone: ${u.phone}`);
    if (u.dateOfBirth) personal.push(`Date of birth: ${u.dateOfBirth.toISOString().slice(0, 10)}`);
    if (u.city) personal.push(`City: ${u.city}`);
    if (u.state) personal.push(`State: ${u.state}`);
    if (u.pincode) personal.push(`Pincode: ${u.pincode}`);
    if (u.address) personal.push(`Address: ${u.address}`);
    if (u.occupation) personal.push(`Occupation: ${u.occupation}`);
    if (u.companyName) personal.push(`Company: ${u.companyName}`);
    lines.unshift(`PERSONAL:\n  ${personal.join("\n  ")}`);
  }
  return lines.join("\n");
}

/**
 * Best-effort categorization of a field label into a profile category.
 */
export function categorizeLabel(label: string): string {
  const l = label.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/name|surname|given|full.?name/i, "PERSONAL"],
    [/email|phone|mobile|telephone|contact|whatsapp|fax/i, "CONTACT"],
    [/address|street|city|state|pincode|pin code|postal|zip|district|country|locality/i, "ADDRESS"],
    [/employer|company|occupation|profession|job|designation|salary|income|work|business|office/i, "EMPLOYMENT"],
    [/education|degree|qualification|school|college|university|course|year of (pass|completion)|marks|gpa/i, "EDUCATION"],
    [/father|mother|spouse|husband|wife|marital|family|relative|guardian|children/i, "FAMILY"],
    [/pan|aadhaar|voter|passport|driving|license|id number|identification|uan|account|bank|ifsc|insurance|itin/i, "IDENTIFICATION"],
  ];
  for (const [re, cat] of rules) {
    if (re.test(l)) return cat;
  }
  return "CUSTOM";
}

/**
 * Normalize a field label for matching (case/space/punct-insensitive).
 */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[\s_:./()-]+/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Upsert a batch of profile items for the user (deduplicated by key).
 */
export async function saveProfileItems(
  userId: string,
  items: Array<{ label: string; value: string; sourceFormId?: string | null }>,
  opts: { approved?: boolean } = {}
): Promise<number> {
  let saved = 0;
  for (const it of items) {
    const value = (it.value ?? "").trim();
    if (!value) continue;
    const category = categorizeLabel(it.label);
    const key = normalizeLabel(it.label);
    if (!key) continue;

    await prisma.profileItem.upsert({
      where: { userId_key: { userId, key } },
      update: {
        value,
        label: it.label,
        category,
        sourceFormId: it.sourceFormId ?? undefined,
        approved: opts.approved ?? true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        key,
        label: it.label,
        value,
        category,
        sourceFormId: it.sourceFormId ?? undefined,
        approved: opts.approved ?? true,
      },
    });
    saved += 1;
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Profile sections & completion
// ---------------------------------------------------------------------------

export type ProfileFieldDef = {
  key: string; // normalized KB key (e.g. "first_name")
  label: string;
  user?: string; // User column when stored on the structured row
};

export type ProfileSectionDef = {
  id: string;
  title: string;
  description: string;
  fields: ProfileFieldDef[];
  record?: "education" | "family"; // repeatable-record section
};

export const PROFILE_SECTIONS: ProfileSectionDef[] = [
  {
    id: "PERSONAL",
    title: "Personal Information",
    description: "Basic identity details.",
    fields: [
      { key: "full_name", label: "Full name", user: "name" },
      { key: "first_name", label: "First name", user: "firstName" },
      { key: "middle_name", label: "Middle name", user: "middleName" },
      { key: "last_name", label: "Last name", user: "lastName" },
      { key: "fathers_name", label: "Father's name" },
      { key: "mothers_name", label: "Mother's name" },
      { key: "date_of_birth", label: "Date of birth", user: "dateOfBirth" },
      { key: "gender", label: "Gender", user: "gender" },
      { key: "marital_status", label: "Marital status" },
      { key: "nationality", label: "Nationality", user: "nationality" },
    ],
  },
  {
    id: "CONTACT",
    title: "Contact Information",
    description: "How to reach you.",
    fields: [
      { key: "primary_phone", label: "Primary phone", user: "phone" },
      { key: "alternate_phone", label: "Alternate phone", user: "alternatePhone" },
      { key: "email", label: "Email address", user: "email" },
    ],
  },
  {
    id: "ADDRESS",
    title: "Address",
    description: "Residence and correspondence addresses.",
    fields: [
      { key: "address_line_1", label: "Address line 1", user: "addressLine1" },
      { key: "address_line_2", label: "Address line 2", user: "addressLine2" },
      { key: "village", label: "Village / locality", user: "village" },
      { key: "city", label: "City", user: "city" },
      { key: "district", label: "District", user: "district" },
      { key: "state", label: "State", user: "state" },
      { key: "country", label: "Country", user: "country" },
      { key: "pin_code", label: "PIN code", user: "pincode" },
      { key: "permanent_address", label: "Permanent address", user: "permanentAddress" },
      { key: "correspondence_address", label: "Correspondence address", user: "correspondenceAddress" },
    ],
  },
  {
    id: "PROFESSIONAL",
    title: "Professional",
    description: "Occupation and employment details.",
    fields: [
      { key: "occupation", label: "Occupation", user: "occupation" },
      { key: "employer", label: "Employer", user: "companyName" },
      { key: "designation", label: "Designation", user: "designation" },
      { key: "work_address", label: "Work address", user: "workAddress" },
      { key: "experience", label: "Years of experience", user: "experienceYears" },
      { key: "previous_employer", label: "Previous employer", user: "previousEmployer" },
    ],
  },
  {
    id: "EDUCATION",
    title: "Education",
    description: "Qualifications — add as many as you have.",
    record: "education",
    fields: [
      { key: "qualification", label: "Qualification" },
      { key: "institution", label: "Institution" },
      { key: "board_university", label: "Board / University" },
      { key: "passing_year", label: "Year of passing" },
      { key: "percentage", label: "Percentage" },
      { key: "cgpa", label: "CGPA" },
      { key: "certificate_reference", label: "Certificate reference" },
    ],
  },
  {
    id: "FAMILY",
    title: "Family",
    description: "Family members and dependants.",
    record: "family",
    fields: [
      { key: "relationship", label: "Relationship" },
      { key: "name", label: "Name" },
      { key: "date_of_birth", label: "Date of birth" },
      { key: "occupation", label: "Occupation" },
      { key: "dependent_status", label: "Dependant" },
    ],
  },
  {
    id: "IDENTIFICATION",
    title: "Identity & Documents",
    description: "Government IDs and certificates. Document numbers are masked.",
    fields: [
      { key: "document_type", label: "Document type" },
      { key: "document_number", label: "Document number" },
      { key: "issue_date", label: "Issue date" },
      { key: "expiry_date", label: "Expiry date" },
      { key: "issuing_authority", label: "Issuing authority" },
    ],
  },
  {
    id: "FINANCIAL",
    title: "Financial / Tax",
    description: "Income, tax and banking details. Values are masked and access-controlled.",
    fields: [
      { key: "income", label: "Annual income" },
      { key: "bank_account", label: "Bank account" },
      { key: "ifsc", label: "IFSC" },
      { key: "pan", label: "PAN" },
      { key: "aadhaar", label: "Aadhaar" },
    ],
  },
  {
    id: "CUSTOM",
    title: "Custom Fields",
    description: "Anything else a form might ask for.",
    fields: [],
  },
];

const USER_ALIAS: Record<string, string> = {
  name: "full_name",
  email: "email",
  phone: "primary_phone",
  address: "address_line_1",
  city: "city",
  state: "state",
  pincode: "pin_code",
  dateOfBirth: "date_of_birth",
  occupation: "occupation",
  companyName: "employer",
};

/**
 * Value of a structured user column, flattened for a section field.
 */
export function userFieldValue(user: Record<string, unknown>, field: ProfileFieldDef): string {
  if (!field.user) return "";
  const raw = user[field.user];
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw);
}

/**
 * Per-section completion from the structured row, KB items and records.
 */
export function computeSections(data: {
  user: Record<string, unknown>;
  items: ProfileItem[];
  education: unknown[];
  family: unknown[];
}): { id: string; title: string; description: string; filled: number; total: number; percent: number; missing: string[] }[] {
  const itemByKey = new Map<string, string>();
  for (const it of data.items) {
    if (it.value && it.value.trim()) itemByKey.set(it.key, it.value.trim());
  }

  return PROFILE_SECTIONS.map((s) => {
    let filled = 0;
    let total = 0;
    const missing: string[] = [];

    if (s.record === "education" || s.record === "family") {
      const rows = data[s.record];
      total = 1;
      filled = rows.length > 0 ? 1 : 0;
      if (!filled) missing.push(`Add at least one ${s.record === "education" ? "education" : "family"} record`);
    } else {
      for (const f of s.fields) {
        total += 1;
        const value = f.user ? userFieldValue(data.user, f) : itemByKey.get(f.key) ?? "";
        if (value && value.trim()) filled += 1;
        else missing.push(f.label);
      }
    }

    const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
    return { id: s.id, title: s.title, description: s.description, filled, total, percent, missing };
  });
}

export function overallCompletion(sections: ReturnType<typeof computeSections>): number {
  const total = sections.reduce((acc, s) => acc + s.total, 0);
  const filled = sections.reduce((acc, s) => acc + s.filled, 0);
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

/**
 * Mask a sensitive value: keep first 3 and last 2 characters.
 */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return "";
  const v = String(value);
  if (v.length <= 5) return "•••";
  return `${v.slice(0, 3)}•••${v.slice(-2)}`;
}
