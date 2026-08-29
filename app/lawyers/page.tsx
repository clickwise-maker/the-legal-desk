import { Suspense } from "react";
import Link from "next/link";
import { LawyersList } from "@/components/LawyersList";

export default function LawyersPage() {
  return (
    <div className="container-legal py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
            Find a verified lawyer
          </h1>
          <p className="mt-3 text-lg text-legal-muted">
            Book a consultation by specialization, city, or name. Secure payment,
            12% platform commission — you pay exactly the listed rate.
          </p>
        </div>
        <Link href="/lawyers/onboarding" className="btn-gold">
          Become a lawyer
        </Link>
      </div>
      <div className="mt-8">
        <Suspense fallback={<div className="card h-40 animate-pulse bg-primary-50/50" />}>
          <LawyersList />
        </Suspense>
      </div>
    </div>
  );
}
