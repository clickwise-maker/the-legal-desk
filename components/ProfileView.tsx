"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";
import { LawyerSettings } from "@/components/LawyerSettings";

type SectionInfo = {
  id: string;
  title: string;
  description: string;
  filled: number;
  total: number;
  percent: number;
  missing: string[];
};

type ProfileData = {
  user: Record<string, string | number | null>;
  completion: number;
  sections: SectionInfo[];
  items: Array<{ id: string; category: string; label: string; value: string; approved: boolean; sourceFormId: string | null }>;
  grouped: Record<string, Array<{ id: string; label: string; value: string }>>;
  education: Array<Record<string, string | number | null> & { id: string }>;
  family: Array<Record<string, string | boolean | null> & { id: string }>;
  documents: Array<Record<string, string | null> & { id: string }>;
  financial: Array<Record<string, string | null> & { id: string }>;
};

const SECTION_FIELDS: Record<string, Array<{ key: string; label: string; user?: string; type?: string }>> = {
  PERSONAL: [
    { key: "name", label: "Full name", user: "name" },
    { key: "firstName", label: "First name", user: "firstName" },
    { key: "middleName", label: "Middle name", user: "middleName" },
    { key: "lastName", label: "Last name", user: "lastName" },
    { key: "fathers_name", label: "Father's name" },
    { key: "mothers_name", label: "Mother's name" },
    { key: "dateOfBirth", label: "Date of birth", user: "dateOfBirth", type: "date" },
    { key: "gender", label: "Gender", user: "gender" },
    { key: "marital_status", label: "Marital status" },
    { key: "nationality", label: "Nationality", user: "nationality" },
  ],
  CONTACT: [
    { key: "phone", label: "Primary phone", user: "phone", type: "tel" },
    { key: "alternatePhone", label: "Alternate phone", user: "alternatePhone", type: "tel" },
    { key: "email", label: "Email address", user: "email", type: "email" },
  ],
  ADDRESS: [
    { key: "addressLine1", label: "Address line 1", user: "addressLine1" },
    { key: "addressLine2", label: "Address line 2", user: "addressLine2" },
    { key: "village", label: "Village / locality", user: "village" },
    { key: "city", label: "City", user: "city" },
    { key: "district", label: "District", user: "district" },
    { key: "state", label: "State", user: "state" },
    { key: "country", label: "Country", user: "country" },
    { key: "pincode", label: "PIN code", user: "pincode" },
    { key: "permanentAddress", label: "Permanent address", user: "permanentAddress" },
    { key: "correspondenceAddress", label: "Correspondence address", user: "correspondenceAddress" },
  ],
  PROFESSIONAL: [
    { key: "occupation", label: "Occupation", user: "occupation" },
    { key: "companyName", label: "Employer", user: "companyName" },
    { key: "designation", label: "Designation", user: "designation" },
    { key: "workAddress", label: "Work address", user: "workAddress" },
    { key: "experienceYears", label: "Years of experience", user: "experienceYears", type: "number" },
    { key: "previousEmployer", label: "Previous employer", user: "previousEmployer" },
  ],
};

const EDUCATION_FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: "qualification", label: "Qualification" },
  { key: "institution", label: "Institution" },
  { key: "boardUniversity", label: "Board / University" },
  { key: "passingYear", label: "Year of passing", type: "number" },
  { key: "percentage", label: "Percentage", type: "number" },
  { key: "cgpa", label: "CGPA", type: "number" },
  { key: "certificateReference", label: "Certificate reference" },
];

const FAMILY_FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: "relationship", label: "Relationship" },
  { key: "name", label: "Name" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "occupation", label: "Occupation" },
];

const DOC_CATEGORIES = ["PAN", "Aadhaar", "Passport", "Voter ID", "Driving licence", "Bank statement", "Other"];
const FIN_CATEGORIES = ["INCOME", "BANK", "TAX", "INVESTMENT", "GENERAL"];

function fieldValue(data: ProfileData, field: { key: string; label: string; user?: string; type?: string }): string {
  if (field.user) {
    const v = data.user[field.user];
    if (v === null || v === undefined) return "";
    return String(v);
  }
  const item = data.items.find((i) => i.label.toLowerCase() === field.label.toLowerCase());
  return item?.value ?? "";
}

export function ProfileView({ role }: { role?: string }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [docForm, setDocForm] = useState<Record<string, string>>({});
  const [docFile, setDocFile] = useState<File | null>(null);
  const [finForm, setFinForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "Request failed");
    return d;
  }

  async function saveSection(sectionId: string) {
    if (!data) return;
    setMessage("");
    setError("");
    try {
      const fields = SECTION_FIELDS[sectionId];
      const userPayload: Record<string, unknown> = {};
      const kbItems: Array<{ label: string; value: string }> = [];

      for (const f of fields) {
        const input = document.querySelector<HTMLInputElement>(`[data-field="${sectionId}:${f.key}"]`);
        const raw = input?.value ?? "";
        if (f.user) {
          const key = f.user;
          if (f.type === "number") {
            userPayload[key] = raw ? Number(raw) : null;
          } else if (f.type === "date") {
            userPayload[key] = raw ? `${raw}T00:00:00.000Z` : null;
          } else {
            userPayload[key] = raw || null;
          }
        } else {
          kbItems.push({ label: f.label, value: raw });
        }
      }

      if (Object.keys(userPayload).length > 0) {
        await api("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userPayload),
        });
      }
      if (kbItems.length > 0) {
        await api("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: kbItems.map((i) => ({ ...i, approved: true })) }),
        });
      }
      setMessage(`${SECTION_FIELDS[sectionId] ? sectionTitle(sectionId) : "Section"} saved. Reused in every form.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function sectionTitle(id: string): string {
    const map: Record<string, string> = {
      PERSONAL: "Personal Information",
      CONTACT: "Contact Information",
      ADDRESS: "Address",
      PROFESSIONAL: "Professional",
      EDUCATION: "Education",
      FAMILY: "Family",
      IDENTIFICATION: "Identity & Documents",
      FINANCIAL: "Financial / Tax",
      CUSTOM: "Custom Fields",
    };
    return map[id] ?? id;
  }

  async function addEducation() {
    await api("/api/profile/education", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load();
  }

  async function saveEducation(id: string, key: string, value: string) {
    try {
      const body: Record<string, unknown> = { id };
      if (key === "passingYear") body[key] = value ? Number(value) : null;
      else if (key === "percentage" || key === "cgpa") body[key] = value ? Number(value) : null;
      else body[key] = value || null;
      await api("/api/profile/education", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeEducation(id: string) {
    await api("/api/profile/education", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function addFamily() {
    await api("/api/profile/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load();
  }

  async function saveFamily(id: string, key: string, value: string) {
    try {
      const body: Record<string, unknown> = { id };
      if (key === "dateOfBirth") body[key] = value ? `${value}T00:00:00.000Z` : null;
      else if (key === "dependentStatus") body[key] = value === "true";
      else body[key] = value || null;
      await api("/api/profile/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeFamily(id: string) {
    await api("/api/profile/family", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function addDocument() {
    setError("");
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(docForm)) if (v) fd.set(k, v);
      if (docFile) fd.set("file", docFile);
      await api("/api/profile/documents", { method: "POST", body: fd });
      setDocForm({});
      setDocFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeDocument(id: string) {
    await api("/api/profile/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function addFinancial() {
    setError("");
    try {
      await api("/api/profile/financial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: finForm.category || "GENERAL",
          label: finForm.label,
          value: finForm.value,
        }),
      });
      setFinForm({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeFinancial(id: string) {
    await api("/api/profile/financial", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function addCustomField() {
    setError("");
    if (!customLabel.trim()) {
      setError("Enter a field label");
      return;
    }
    await api("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ label: customLabel, value: customValue, approved: true }] }),
    });
    setCustomLabel("");
    setCustomValue("");
    await load();
  }

  async function updateCustomItem(id: string, value: string) {
    const item = data?.items.find((i) => i.id === id);
    if (!item) return;
    await api("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ label: item.label, value, category: item.category }] }),
    });
    await load();
  }

  async function handlePhoto(file: File) {
    setUploadingPhoto(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      await api("/api/profile/photo", { method: "POST", body: fd });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const customItems = useMemo(() => data?.items.filter((i) => i.category === "CUSTOM") ?? [], [data]);

  if (loading) return <div className="card h-96 animate-pulse bg-primary-50/50" />;
  if (!data) {
    return (
      <div className="card p-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary-800">Sign in to view your profile</h1>
        <Link href="/login" className="btn-outline mt-5">Sign in</Link>
      </div>
    );
  }

  const photoUrl = data.user.profilePhotoUrl as string | null;

  return (
    <div className="container-legal py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-primary-800">Your profile</h1>
          <p className="mt-1 text-legal-muted">
            One profile, reused by every form and CV. A field is only required when a form actually needs it.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/forms" className="btn-outline">Fill a form</Link>
          <Link href="/cv" className="btn-gold">Generate CV</Link>
        </div>
      </div>

      {/* Header: photo + overall completion */}
      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center gap-6">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover ring-4 ring-gold-200" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 font-heading text-3xl font-bold text-primary-700">
              {String(data.user.name ?? "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-xl font-bold text-primary-800">{data.user.name}</h2>
              <Badge tone="primary">{data.user.email}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-primary-50">
                <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${data.completion}%` }} />
              </div>
              <span className="text-sm font-bold text-primary-800">{data.completion}%</span>
            </div>
          </div>
          <label className="btn-outline cursor-pointer text-sm">
            {uploadingPhoto ? "Uploading…" : "Upload photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhoto(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Card>

      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      {/* Role-based: lawyers get the Lawyer Profile configuration */}
      {role === "LAWYER" && (
        <div className="mt-6">
          <LawyerSettings />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Flat sections */}
        {(["PERSONAL", "CONTACT", "ADDRESS", "PROFESSIONAL"] as const).map((sid) => {
          const section = data.sections.find((s) => s.id === sid);
          return (
            <Card key={sid} className="p-6">
              <SectionHeader section={section} title={sectionTitle(sid)} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {SECTION_FIELDS[sid].map((f) => (
                  <div key={f.key} className={f.key === "permanentAddress" || f.key === "correspondenceAddress" ? "sm:col-span-2" : ""}>
                    <label className="label" htmlFor={`${sid}:${f.key}`}>{f.label}</label>
                    <input
                      id={`${sid}:${f.key}`}
                      data-field={`${sid}:${f.key}`}
                      type={f.type ?? "text"}
                      className="input"
                      defaultValue={fieldValue(data, f)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" className="btn-primary" onClick={() => saveSection(sid)}>Save section</button>
              </div>
            </Card>
          );
        })}

        {/* Education */}
        <Card className="p-6">
          <SectionHeader section={data.sections.find((s) => s.id === "EDUCATION")} title="Education" />
          <p className="mt-1 text-sm text-legal-muted">Add as many qualifications as you have.</p>
          <div className="mt-4 space-y-4">
            {data.education.map((e) => (
              <div key={e.id} className="rounded-lg border border-primary-100 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {EDUCATION_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="label" htmlFor={`edu-${e.id}-${f.key}`}>{f.label}</label>
                      <input
                        id={`edu-${e.id}-${f.key}`}
                        type={f.type ?? "text"}
                        className="input"
                        defaultValue={e[f.key] != null ? String(e[f.key]) : ""}
                        onBlur={(ev) => {
                          if (ev.target.value !== String(e[f.key] ?? "")) saveEducation(e.id, f.key, ev.target.value);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" className="btn-ghost text-sm text-red-600" onClick={() => removeEducation(e.id)}>Remove</button>
                </div>
              </div>
            ))}
            {data.education.length === 0 && (
              <p className="rounded-lg bg-primary-50 p-5 text-center text-sm text-legal-muted">No education records yet.</p>
            )}
          </div>
          <button type="button" className="btn-outline mt-5" onClick={addEducation}>+ Add qualification</button>
        </Card>

        {/* Family */}
        <Card className="p-6">
          <SectionHeader section={data.sections.find((s) => s.id === "FAMILY")} title="Family" />
          <p className="mt-1 text-sm text-legal-muted">Family members and dependants.</p>
          <div className="mt-4 space-y-4">
            {data.family.map((m) => (
              <div key={m.id} className="rounded-lg border border-primary-100 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {FAMILY_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="label" htmlFor={`fam-${m.id}-${f.key}`}>{f.label}</label>
                      <input
                        id={`fam-${m.id}-${f.key}`}
                        type={f.type ?? "text"}
                        className="input"
                        defaultValue={m[f.key] != null ? String(m[f.key]).slice(0, 10) : ""}
                        onBlur={(ev) => {
                          if (ev.target.value !== String(m[f.key] ?? "").slice(0, 10)) saveFamily(m.id, f.key, ev.target.value);
                        }}
                      />
                    </div>
                  ))}
                  <div className="flex items-end gap-2">
                    <label className="label flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-gold-500"
                        defaultChecked={Boolean(m.dependentStatus)}
                        onChange={(e) => saveFamily(m.id, "dependentStatus", String(e.target.checked))}
                      />
                      Dependant
                    </label>
                    <button type="button" className="btn-ghost text-sm text-red-600" onClick={() => removeFamily(m.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
            {data.family.length === 0 && (
              <p className="rounded-lg bg-primary-50 p-5 text-center text-sm text-legal-muted">No family members yet.</p>
            )}
          </div>
          <button type="button" className="btn-outline mt-5" onClick={addFamily}>+ Add family member</button>
        </Card>

        {/* Identity & Documents */}
        <Card className="p-6">
          <SectionHeader section={data.sections.find((s) => s.id === "IDENTIFICATION")} title="Identity & Documents" />
          <p className="mt-1 text-sm text-legal-muted">Document numbers are masked for privacy.</p>

          <div className="mt-4 space-y-2">
            {data.documents.length === 0 && (
              <p className="rounded-lg bg-primary-50 p-5 text-center text-sm text-legal-muted">No documents saved yet.</p>
            )}
            {data.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-primary-100 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-primary-800">{d.documentType}</div>
                  <div className="text-xs text-legal-muted">
                    {d.documentNumber && <span>{d.documentNumber} · </span>}
                    {d.expiryDate && <span>expires {d.expiryDate} · </span>}
                    {d.issuingAuthority}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.fileUrl && <Badge tone="green">file</Badge>}
                  <button type="button" className="btn-ghost text-sm text-red-600" onClick={() => removeDocument(d.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-primary-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="docType">Document type</label>
                <select id="docType" className="input" value={docForm.documentType ?? ""} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}>
                  <option value="">Select…</option>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="docNumber">Document number</label>
                <input id="docNumber" className="input" value={docForm.documentNumber ?? ""} onChange={(e) => setDocForm({ ...docForm, documentNumber: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="docIssue">Issue date</label>
                <input id="docIssue" type="date" className="input" value={docForm.issueDate ?? ""} onChange={(e) => setDocForm({ ...docForm, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="docExpiry">Expiry date</label>
                <input id="docExpiry" type="date" className="input" value={docForm.expiryDate ?? ""} onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="docAuth">Issuing authority</label>
                <input id="docAuth" className="input" value={docForm.issuingAuthority ?? ""} onChange={(e) => setDocForm({ ...docForm, issuingAuthority: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="docFile">Attach document (optional)</label>
                <input id="docFile" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="input" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <button type="button" className="btn-primary mt-4" onClick={addDocument}>Add document</button>
          </div>
        </Card>

        {/* Financial / Tax */}
        <Card className="p-6">
          <SectionHeader section={data.sections.find((s) => s.id === "FINANCIAL")} title="Financial / Tax" />
          <p className="mt-1 text-sm text-legal-muted">Access-controlled. Values are masked and never logged.</p>

          <div className="mt-4 space-y-2">
            {data.financial.length === 0 && (
              <p className="rounded-lg bg-primary-50 p-5 text-center text-sm text-legal-muted">No financial details saved.</p>
            )}
            {data.financial.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-primary-100 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-primary-800">{f.label}</div>
                  <div className="text-xs text-legal-muted">{f.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-legal-muted">{f.value}</span>
                  <button type="button" className="btn-ghost text-sm text-red-600" onClick={() => removeFinancial(f.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg bg-primary-50 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="finCat">Category</label>
                <select id="finCat" className="input" value={finForm.category ?? ""} onChange={(e) => setFinForm({ ...finForm, category: e.target.value })}>
                  <option value="">Select…</option>
                  {FIN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="finLabel">Label</label>
                <input id="finLabel" className="input" placeholder="e.g. Annual income" value={finForm.label ?? ""} onChange={(e) => setFinForm({ ...finForm, label: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="finValue">Value</label>
                <input id="finValue" className="input" placeholder="e.g. ₹12,00,000" value={finForm.value ?? ""} onChange={(e) => setFinForm({ ...finForm, value: e.target.value })} />
              </div>
            </div>
            <button type="button" className="btn-primary mt-4" onClick={addFinancial}>Add entry</button>
          </div>
        </Card>

        {/* Custom fields */}
        <Card className="p-6 lg:col-span-2">
          <SectionHeader section={data.sections.find((s) => s.id === "CUSTOM")} title="Custom Fields" />
          <p className="mt-1 text-sm text-legal-muted">
            Any field a form asks for that isn&apos;t predefined. Add it once and it&apos;s reused forever.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <input className="input w-64" placeholder="Field label (e.g. Property type)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            <input className="input w-64" placeholder="Value" value={customValue} onChange={(e) => setCustomValue(e.target.value)} />
            <button type="button" className="btn-primary" onClick={addCustomField}>Add field</button>
          </div>

          {customItems.length > 0 && (
            <ul className="mt-5 space-y-2">
              {customItems.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 text-sm font-medium text-primary-800">{it.label}</span>
                  <input
                    className="input"
                    defaultValue={it.value}
                    onBlur={(e) => {
                      if (e.target.value !== it.value) updateCustomItem(it.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({ section, title }: { section?: SectionInfo; title: string }) {
  const percent = section?.percent ?? 0;
  const tone = percent === 100 ? "green" : percent >= 50 ? "gold" : "red";
  const label = percent === 100 ? "Complete" : `${percent}%`;
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold text-primary-800">{title}</h2>
      <span className="flex items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        {section && section.percent === 100 && (
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </span>
    </div>
  );
}
