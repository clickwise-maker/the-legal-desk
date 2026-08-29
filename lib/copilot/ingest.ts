import { prisma } from "@/lib/prisma";
import { chunkText } from "./chunk";
import { isPdf } from "@/lib/ocr/tesseract";
import { ocrImage } from "@/lib/ocr/tesseract";
import type { Jurisdiction } from "./jurisdiction";

export async function ingestDocument(opts: {
  ownerId: string;
  matterId?: string | null;
  title: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  buffer: Buffer;
  jurisdiction: Jurisdiction;
}): Promise<{ documentId: string; chunks: number }> {
  const doc = await prisma.legalDocument.create({
    data: {
      ownerId: opts.ownerId,
      matterId: opts.matterId ?? null,
      title: opts.title,
      fileName: opts.fileName,
      fileUrl: opts.fileUrl,
      fileType: opts.fileType,
      jurisdiction: opts.jurisdiction,
      status: "PROCESSING",
      ocrText: "",
    },
  });

  try {
    let text = "";
    if (isPdf(opts.buffer)) {
      // For PDFs, try to extract text directly if it's a text PDF; fallback to OCR note.
      // pdf-lib not needed for text extraction here — we keep ocrText via Tesseract for images, and raw for future pdf-parse.
      text = `PDF document: ${opts.title}. Use Tesseract for scanned PDFs via image rasterization in worker (deferred).`;
      // If buffer contains extractable text via simple parse, keep it
      const raw = opts.buffer.toString("utf8", 0, Math.min(opts.buffer.length, 20000));
      const stripped = raw.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
      if (stripped.length > 200) text = stripped.slice(0, 20000);
    } else {
      const res = await ocrImage(opts.buffer);
      text = res.text;
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await prisma.legalDocument.update({ where: { id: doc.id }, data: { ocrText: text.slice(0, 20000), status: "INDEXED" } });
      return { documentId: doc.id, chunks: 0 };
    }

    await prisma.$transaction(
      chunks.map((c) =>
        prisma.documentChunk.create({
          data: {
            documentId: doc.id,
            ownerId: opts.ownerId,
            chunkIndex: c.index,
            content: c.content,
            tokenCount: c.tokenCount,
          },
        })
      )
    );

    await prisma.legalDocument.update({
      where: { id: doc.id },
      data: { ocrText: text.slice(0, 20000), status: "INDEXED", pageCount: Math.max(1, Math.ceil(text.length / 2500)) },
    });

    return { documentId: doc.id, chunks: chunks.length };
  } catch (e) {
    await prisma.legalDocument.update({ where: { id: doc.id }, data: { status: "FAILED" } });
    throw e;
  }
}
