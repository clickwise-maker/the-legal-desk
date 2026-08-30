import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LawyerRequestsView } from "@/components/LawyerRequestsView";

export const metadata = { title: "Lawyer Requests — LegalFlow" };

export default async function LawyerRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/lawyer/requests");
  if (session.user.role !== "LAWYER" && session.user.role !== "ADMIN") redirect("/dashboard");
  return <LawyerRequestsView />;
}
