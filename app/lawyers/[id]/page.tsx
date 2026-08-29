import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LawyerDetail } from "@/components/LawyerDetail";

export default async function LawyerDetailPage() {
  const session = await getServerSession(authOptions);
  return <LawyerDetail session={session} />;
}
