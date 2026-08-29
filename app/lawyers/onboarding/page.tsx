import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LawyerOnboarding } from "@/components/LawyerOnboarding";

export const metadata: Metadata = {
  title: "Lawyer onboarding | LegalFlow",
  description: "Register as a LegalFlow lawyer — credentials, documents and practice areas in three steps.",
};

export default async function LawyerOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/lawyers/onboarding");
  return <LawyerOnboarding />;
}
