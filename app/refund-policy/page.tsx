import { REFUND_POLICY } from "@/lib/legal/policies";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Refund Policy — LegalFlow" };

export default function RefundPage() {
  return <LegalPage {...REFUND_POLICY} />;
}
