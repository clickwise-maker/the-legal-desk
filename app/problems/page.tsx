import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ProblemsView } from "@/components/ProblemsView";

export const metadata = { title: "My Legal Problems — LegalFlow" };

export default async function ProblemsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/problems");
  return <ProblemsView />;
}
