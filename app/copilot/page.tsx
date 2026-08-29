import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CopilotWorkspace } from "@/components/CopilotWorkspace";

export const metadata: Metadata = {
  title: "Copilot",
  description: "Ask LegalFlow Copilot to book a lawyer, fill a form, or summarise your account.",
};

export default async function CopilotPage() {
  const session = await getServerSession(authOptions);
  return <CopilotWorkspace authed={Boolean(session?.user?.id)} />;
}
