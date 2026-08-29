import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FormDetailView } from "@/components/FormDetailView";

export default async function FormDetailPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <div className="container-legal py-20">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <h1 className="font-heading text-2xl font-bold text-primary-800">Sign in required</h1>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/login" className="btn-primary">Sign in</a>
            <a href="/signup" className="btn-gold">Create account</a>
          </div>
        </div>
      </div>
    );
  }
  return <FormDetailView />;
}
