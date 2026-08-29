import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FormsList } from "@/components/FormsList";

export default async function FormsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <div className="container-legal py-20">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <h1 className="font-heading text-2xl font-bold text-primary-800">Sign in to fill forms</h1>
          <p className="mt-3 text-sm text-legal-muted">
            Create a free account to upload forms, run AI filling, and download completed documents.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/login" className="btn-primary">Sign in</a>
            <a href="/signup" className="btn-gold">Create account</a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="container-legal py-10">
      <h1 className="font-heading text-3xl font-bold text-primary-800 sm:text-4xl">
        AI form filling
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-legal-muted">
        Upload any legal form. OCR extracts the text, AI detects every field,
        and your details are filled automatically — download for {`\u20B9`}5.
      </p>
      <div className="mt-8">
        <FormsList />
      </div>
    </div>
  );
}
