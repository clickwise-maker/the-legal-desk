import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Serves files from the local upload fallback directory (.uploads).
 * In production, use Vercel Blob (no local serving needed).
 * Requires authentication and ownership check to prevent IDOR.
 */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const relative = params.path.join("/");
  const uploadDir = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? ".uploads");
  const filePath = path.resolve(uploadDir, relative);

  // Guard against path traversal
  if (!filePath.startsWith(uploadDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // IDOR check: file must be owned by requester or admin, or be public onboarding doc where ownership is checked via DB
  const fileUrl = `/uploads/${relative}`;
  const isAdmin = session.user.role === "ADMIN";
  let owned = isAdmin;
  if (!owned) {
    // Check Form, LegalDocument, User profile photo, onboarding, etc.
    const [form, legalDoc, userPhoto] = await Promise.all([
      prisma.form.findFirst({ where: { fileUrl, ownerId: session.user.id }, select: { id: true } }),
      prisma.legalDocument.findFirst({ where: { fileUrl, ownerId: session.user.id }, select: { id: true } }),
      prisma.user.findFirst({ where: { id: session.user.id, OR: [{ profilePhotoUrl: fileUrl }, { avatarUrl: fileUrl }] }, select: { id: true } }),
    ]);
    // Also allow onboarding files under onboarding/{userId}/ (already scoped by prefix)
    const isOwnOnboarding = relative.startsWith(`onboarding/${session.user.id}/`);
    owned = Boolean(form || legalDoc || userPhoto || isOwnOnboarding);
  }
  if (!owned) {
    return NextResponse.json({ error: "Forbidden: file not owned by you" }, { status: 403 });
  }

  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    }[ext];
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
