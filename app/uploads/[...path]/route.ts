import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * Serves files from the local upload fallback directory (.uploads).
 * In production, use Vercel Blob (no local serving needed).
 */
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const relative = params.path.join("/");
  const uploadDir = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? ".uploads");
  const filePath = path.resolve(uploadDir, relative);

  // Guard against path traversal
  if (!filePath.startsWith(uploadDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      headers: { "Content-Type": type ?? "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
