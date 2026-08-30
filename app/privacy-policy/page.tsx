import { PRIVACY_POLICY } from "@/lib/legal/policies";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy Policy — LegalFlow" };

export default function PrivacyPolicyPage() {
  return <LegalPage {...PRIVACY_POLICY} />;
}
