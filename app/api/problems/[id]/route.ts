import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z
  .object({
    title: z.string().min(5).max(120).trim().optional(),
    description: z.string().min(20).max(5000).trim().optional(),
    category: z.string().min(2).max(50).trim().optional(),
    location: z.string().max(100).trim().optional().nullable(),
    status: z.enum(["CLOSED"]).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

function sanitizeText(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 5000);
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const problem = await prisma.legalProblem.findUnique({
    where: { id: params.id },
    include: {
      responses: {
        include: {
          lawyer: { select: { id: true, name: true, avatarUrl: true } },
          lawyerProfile: { select: { city: true, experienceYears: true, isVerified: true } },
        },
      },
    },
  });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // IDOR: only owner or ADMIN or responding lawyer can view
  const isOwner = problem.ownerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isResponder = problem.responses.some((r) => r.lawyerId === session.user.id);
  if (!isOwner && !isAdmin && !isResponder) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Strip private user data: only first name, no email/phone
  const owner = await prisma.user.findUnique({ where: { id: problem.ownerId }, select: { name: true } });
  const safeOwner = owner ? { firstName: owner.name.split(" ")[0] } : null;

  // Ensure responses never expose email/phone — we selected only public fields above
  return NextResponse.json({ ...problem, owner: safeOwner });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const problem = await prisma.legalProblem.findUnique({ where: { id: params.id }, include: { _count: { select: { responses: true } } } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (problem.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  // Edit only while no lawyer has responded, unless closing
  const isCloseOnly = parsed.data.status === "CLOSED" && Object.keys(parsed.data).length === 1;
  if (problem._count.responses > 0 && !isCloseOnly) {
    return NextResponse.json({ error: "Cannot edit after a lawyer has responded. You can still close the post." }, { status: 409 });
  }
  if (problem.status === "CLOSED" && parsed.data.status !== "CLOSED") {
    return NextResponse.json({ error: "Post is closed" }, { status: 409 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title) data.title = sanitizeText(parsed.data.title);
  if (parsed.data.description) data.description = sanitizeText(parsed.data.description);
  if (parsed.data.category) data.category = sanitizeText(parsed.data.category);
  if (parsed.data.location !== undefined) data.location = parsed.data.location ? sanitizeText(parsed.data.location) : null;
  if (parsed.data.status) data.status = parsed.data.status;

  const updated = await prisma.legalProblem.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const problem = await prisma.legalProblem.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (problem.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Only allow delete if no responses
  const count = await prisma.lawyerResponse.count({ where: { problemId: params.id } });
  if (count > 0) return NextResponse.json({ error: "Cannot delete after responses" }, { status: 409 });
  await prisma.legalProblem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
