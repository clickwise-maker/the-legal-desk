import { createWorker } from "tesseract.js";

/**
 * Extract text from an image (PNG/JPEG) using Tesseract.js.
 * Runs in Node.js. For PDFs, callers rasterize the first page first.
 */
export async function ocrImage(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });
  try {
    const { data } = await worker.recognize(buffer);
    return {
      text: (data.text ?? "").trim(),
      confidence: data.confidence ?? 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Detect whether a buffer looks like a PDF by magic bytes.
 */
export function isPdf(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}
