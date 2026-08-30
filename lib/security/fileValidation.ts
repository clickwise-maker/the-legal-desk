import path from "path";

const ALLOWED_MIMES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]);

const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
];

const MALICIOUS_PATTERNS: Array<{ test: (buf: Buffer, str: string) => boolean; reason: string }> = [
  { test: (buf) => buf.subarray(0, 2).toString("hex") === "4d5a", reason: "Executable (MZ) header detected" },
  { test: (buf) => buf.subarray(0, 4).toString() === "\x7fELF", reason: "Executable (ELF) header detected" },
  { test: (_, str) => /<\s*script/i.test(str.slice(0, 4000)), reason: "Embedded <script> detected" },
  { test: (_, str) => /<\?php/i.test(str.slice(0, 4000)), reason: "Embedded PHP code detected" },
  { test: (_, str) => /eval\s*\(/i.test(str.slice(0, 4000)), reason: "Suspicious eval() detected" },
  { test: (_, str) => /base64\s*,/i.test(str.slice(0, 8000)) && str.includes("data:text/html"), reason: "Embedded HTML data URI" },
];

export function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  // Remove path traversal and control chars, keep alphanum, dot, dash, underscore
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/\.{2,}/g, ".");
  return cleaned.slice(0, 120) || "file";
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIMES.has(mime.toLowerCase());
}

export function validateMagicBytes(buffer: Buffer, mime: string): boolean {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (m === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (m === "image/webp") {
    return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  }
  if (m === "application/pdf") {
    return buffer.subarray(0, 4).toString() === "%PDF";
  }
  return false;
}

export function scanMalicious(buffer: Buffer): { safe: boolean; reason?: string } {
  const str = buffer.toString("utf8", 0, Math.min(buffer.length, 8000));
  for (const p of MALICIOUS_PATTERNS) {
    if (p.test(buffer, str)) return { safe: false, reason: p.reason };
  }
  // Check for excessive null bytes (binary masquerading as text)
  if (buffer.length > 100 && buffer.subarray(0, 100).includes(0)) {
    // Allow PDF/PNG nulls, but flag if text file contains many nulls
    const textLike = str.trim().length > 50 && !str.includes("%PDF") && !buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (textLike) return { safe: false, reason: "Binary null bytes in text file" };
  }
  return { safe: true };
}

export function validateUpload(opts: {
  buffer: Buffer;
  mime: string;
  fileName: string;
  maxBytes: number;
}): { ok: true; sanitizedName: string } | { ok: false; error: string } {
  const sanitizedName = sanitizeFilename(opts.fileName);
  if (!isAllowedMime(opts.mime)) return { ok: false, error: `File type ${opts.mime} not allowed. Use PDF, PNG, JPEG, WEBP.` };
  if (opts.buffer.length > opts.maxBytes) return { ok: false, error: `File too large — max ${Math.round(opts.maxBytes / 1024 / 1024)} MB` };
  if (opts.buffer.length === 0) return { ok: false, error: "Empty file" };
  // Path traversal already handled by sanitize, but double-check
  if (opts.fileName.includes("..") || opts.fileName.includes("/") || opts.fileName.includes("\\")) {
    return { ok: false, error: "Invalid filename" };
  }
  if (!validateMagicBytes(opts.buffer, opts.mime)) {
    return { ok: false, error: `File signature does not match MIME type ${opts.mime}. Possible spoofed file.` };
  }
  const scan = scanMalicious(opts.buffer);
  if (!scan.safe) return { ok: false, error: `File rejected: ${scan.reason}` };
  // Image dimension guard — rough check via file size vs. decompressed size (prevent zip bomb)
  // For true dimensions, caller can use sharp if available; here we just cap buffer
  if (opts.buffer.length > 25 * 1024 * 1024) return { ok: false, error: "Image too large" };
  return { ok: true, sanitizedName };
}

// Secure temp handling for FormPilot pipeline — prevent command/path injection
export function secureTempPath(baseDir: string, fileName: string): string {
  const safe = sanitizeFilename(fileName);
  const resolved = path.resolve(baseDir, safe);
  if (!resolved.startsWith(path.resolve(baseDir))) throw new Error("Path traversal detected");
  return resolved;
}
