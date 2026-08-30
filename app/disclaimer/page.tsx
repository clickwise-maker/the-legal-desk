import { DISCLAIMER_POLICY } from "@/lib/legal/policies";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Disclaimer — LegalFlow" };

export default function DisclaimerPage() {
  return <LegalPage {...DISCLAIMER_POLICY} />;
}
