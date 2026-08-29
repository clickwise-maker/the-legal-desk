"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";

type ProfileItem = {
  id: string;
  category: string;
  label: string;
  value: string;
  approved: boolean;
};

type ProfileData = {
  user: {
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    profilePhotoUrl: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    dateOfBirth: string | null;
    occupation: string | null;
    companyName: string | null;
  } | null;
  items: ProfileItem[];
};

const SECTION_ORDER = ["EMPLOYMENT", "EDUCATION", "FAMILY", "IDENTIFICATION", "CONTACT", "ADDRESS", "FINANCIAL", "PERSONAL"];

const SECTION_LABEL: Record<string, string> = {
  EMPLOYMENT: "Work experience",
  EDUCATION: "Education",
  FAMILY: "Family",
  IDENTIFICATION: "Identification",
  CONTACT: "Contact",
  ADDRESS: "Address",
  FINANCIAL: "Financial",
  PERSONAL: "Personal details",
};

export function CvGenerator() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<"classic" | "modern">("modern");

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="card h-96 animate-pulse bg-primary-50/50" />;
  if (!data?.user) {
    return (
      <div className="card p-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary-800">Sign in to build your CV</h1>
        <Link href="/login" className="btn-outline mt-5">Sign in</Link>
      </div>
    );
  }

  const u = data.user;
  const photo = u.profilePhotoUrl ?? u.avatarUrl;

  const sections = SECTION_ORDER.map((cat) => ({
    cat,
    label: SECTION_LABEL[cat] ?? cat,
    items: data.items.filter((i) => i.category === cat && i.value),
  })).filter((s) => s.items.length > 0);

  const addressLine = [u.address, u.city, u.state, u.pincode].filter(Boolean).join(", ");

  return (
    <div className="container-legal py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-primary-800">CV generator</h1>
          <p className="mt-1 text-legal-muted">
            Built instantly from your profile knowledge base. No form-filling needed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/profile" className="btn-outline">Edit profile</Link>
          <button className="btn-gold" onClick={() => window.print()}>Export PDF / Print</button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-primary-800">Template</span>
        {(["modern", "classic"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTemplate(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              template === t
                ? "bg-primary-700 text-white"
                : "bg-white text-primary-700 ring-1 ring-primary-200 hover:bg-primary-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div id="cv-sheet" className={`cv-sheet mt-8 ${template === "classic" ? "cv-classic" : "cv-modern"}`}>
        <div className="cv-head">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Portrait" className="cv-photo" />
          )}
          <div>
            <h2 className="font-heading text-3xl font-bold text-primary-900">{u.name}</h2>
            <p className="mt-1 text-lg text-gold-600">{u.occupation || u.companyName || "Professional"}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-legal-muted">
              {u.email && <span className="cv-contact">{u.email}</span>}
              {u.phone && <span className="cv-contact">{u.phone}</span>}
              {addressLine && <span className="cv-contact">{addressLine}</span>}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.cat}>
              <h3 className="cv-section-title">{s.label}</h3>
              <ul className="cv-section-body">
                {s.items.map((it) => (
                  <li key={it.id} className="cv-row">
                    <span className="cv-row-label">{it.label}</span>
                    <span className="cv-row-value">{it.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {sections.length === 0 && (
            <p className="rounded-lg bg-primary-50 p-6 text-center text-legal-muted">
              Your knowledge base is empty. <Link href="/forms" className="font-medium text-gold-600 hover:underline">Fill a form</Link> to start building your profile, then come back here.
            </p>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-primary-100 pt-4">
          <Badge tone="primary">LegalFlow CV</Badge>
          <span className="text-xs text-legal-muted">Generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      <style>{`
        .cv-sheet { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2.5rem; color: #1a365d; }
        .cv-photo { width: 5.5rem; height: 5.5rem; border-radius: 9999px; object-fit: cover; }
        .cv-modern .cv-head { display: flex; gap: 1.5rem; align-items: center; }
        .cv-classic { border-left: 6px solid #d69e2e; }
        .cv-classic .cv-head { border-bottom: 2px solid #d69e2e; padding-bottom: 1rem; }
        .cv-section-title { font-size: 0.95rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: #b7791f; border-bottom: 1px solid #fefcbf; padding-bottom: 0.35rem; }
        .cv-section-body { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.45rem; }
        .cv-row { display: flex; gap: 0.75rem; font-size: 0.95rem; }
        .cv-row-label { width: 11rem; flex-shrink: 0; font-weight: 600; color: #2b6cb0; }
        .cv-row-value { color: #2d3748; }
        @media print {
          body * { visibility: hidden; }
          #cv-sheet, #cv-sheet * { visibility: visible; }
          #cv-sheet { position: absolute; inset: 0; border: none; border-radius: 0; }
          .cv-photo { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
