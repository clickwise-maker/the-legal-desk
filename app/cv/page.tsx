import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CvGenerator } from "@/components/CvGenerator";

export const metadata = {
  title: "CV generator | LegalFlow",
};

export default async function CvPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/cv");
  return <CvGenerator />;
}
