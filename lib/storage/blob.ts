import { put, del } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Upload a file either to Vercel Blob (production) or to the local
 * filesystem (development fallback). Returns a publicly fetchable URL.
 */
export async function uploadFile({
  buffer,
  fileName,
  contentType,
  prefix = "legalflow",
}: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  prefix?: string;
}): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && !token.startsWith("vercel_blob_rw_your")) {
    const blob = await put(`${prefix}/${randomUUID()}-${fileName}`, buffer, {
      access: "public",
      contentType,
    });
    return blob.url;
  }

  // Local fallback
  const dir = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? ".uploads");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}-${fileName.replace(/[^\w.\-]/g, "_")}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

/**
 * Read a file back from either Vercel Blob (remote URL) or the
 * local filesystem fallback (/uploads/... -> .uploads/...).
 */
export async function readFile(url: string): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    const relative = url.replace(/^\/uploads\//, "");
    return fs.readFile(path.join(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? ".uploads", relative));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFile(url: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && !token.startsWith("vercel_blob_rw_your") && url.startsWith("https://")) {
    try {
      await del(url);
    } catch {
      // ignore
    }
    return;
  }
  if (url.startsWith("/uploads/")) {
    try {
      await fs.unlink(path.join(process.cwd(), url));
    } catch {
      // ignore
    }
  }
}
