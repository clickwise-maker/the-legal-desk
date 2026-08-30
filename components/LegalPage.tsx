import Link from "next/link";

export function LegalPage({
  title,
  intro,
  version,
  lastUpdated,
  sections,
}: {
  title: string;
  intro: string;
  version: string;
  lastUpdated: string;
  sections: Array<{ heading: string; body: string[] }>;
}) {
  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl bg-primary-50 p-4 text-sm">
          <Link href="/" className="text-gold-600 hover:text-gold-500">
            ← Back to Home
          </Link>
        </div>
        <h1 className="mt-6 font-heading text-3xl font-bold text-primary-800">{title}</h1>
        <p className="mt-2 text-sm text-legal-muted">
          Version {version} · Last updated {lastUpdated}
        </p>
        <p className="mt-4 leading-relaxed text-legal-700">{intro}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.heading} className="card p-6">
              <h2 className="font-heading text-lg font-bold text-primary-800">{s.heading}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-legal-700">
                {s.body.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-legal-muted">
          For questions, contact grievance@legalflow.example — see Privacy Policy for grievance details.
        </p>
      </div>
    </div>
  );
}
