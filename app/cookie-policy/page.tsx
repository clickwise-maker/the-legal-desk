import { COOKIE_POLICY } from "@/lib/legal/policies";
import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Cookie Policy — LegalFlow" };

export default function CookiePage() {
  return <LegalPage {...COOKIE_POLICY} />;
}
