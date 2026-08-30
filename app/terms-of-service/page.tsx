import { TERMS_POLICY } from "@/lib/legal/policies";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms of Service — LegalFlow" };

export default function TermsPage() {
  return <LegalPage {...TERMS_POLICY} />;
}
