import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProblemDetail({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const problem = await prisma.legalProblem.findUnique({
    where: { id: params.id },
    include: {
      responses: {
        include: {
          lawyer: { select: { name: true, avatarUrl: true } },
          lawyerProfile: { select: { city: true, isVerified: true } },
        },
      },
    },
  });
  if (!problem) return <div className="container-legal py-10">Not found</div>;
  if (problem.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    // Allow responder lawyer to view via API, but page is for owner
    return <div className="container-legal py-10">Forbidden</div>;
  }

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-primary-800">{problem.title}</h1>
        <p className="mt-2 text-sm text-legal-muted">{problem.category} · {problem.location ?? "—"} · {problem.status}</p>
        <p className="mt-4 whitespace-pre-line text-legal-700">{problem.description}</p>
        <h2 className="mt-8 font-heading font-bold text-primary-800">Lawyer Responses ({problem.responses.length})</h2>
        {problem.responses.length === 0 ? (
          <p className="mt-2 text-legal-muted">No responses yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {problem.responses.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="font-semibold text-primary-800">{r.lawyer.name} {r.lawyerProfile.isVerified ? "✓" : ""}</div>
                <p className="mt-2 text-sm text-legal-700">{r.message}</p>
                <div className="mt-2 text-xs text-legal-muted">{new Date(r.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
