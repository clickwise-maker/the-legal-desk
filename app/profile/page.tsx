import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ProfileView } from "@/components/ProfileView";

export const metadata = {
  title: "Profile & settings | LegalFlow",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/profile");
  return <ProfileView role={session.user.role} />;
}
