import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ocrImage } from "@/lib/ocr/tesseract";
import { extractPdfText, rasterizeFirstPage } from "@/lib/forms/pdf";
import { readFile } from "@/lib/storage/blob";
import { detectFormFields, sanitizeForModel } from "@/lib/ai/deepseek";
import type { DetectedField } from "@/lib/ai/deepseek";
import { getProfileContext } from "@/lib/profile";
import { fillFromProfile } from "@/lib/forms/engine";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: { fields: true },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (form.status === "PROCESSING") {
    return NextResponse.json({ error: "Form is already being processed" }, { status: 409 });
  }

  await prisma.form.update({ where: { id: form.id }, data: { status: "PROCESSING" } });

  try {
    const bytes = await readFile(form.fileUrl);
    let ocrText = "";
    let ocrConfidence = 0;

    if (form.fileType === "application/pdf") {
      ocrText = await extractPdfText(bytes);
      if (ocrText.length < 50) {
        const page = await rasterizeFirstPage(bytes);
        if (page) {
          const res = await ocrImage(page);
          if (res.text.length > ocrText.length) {
            ocrText = res.text;
            ocrConfidence = res.confidence;
          }
        }
      }
    } else {
      const res = await ocrImage(bytes);
      ocrText = res.text;
      ocrConfidence = res.confidence;
    }

    if (!ocrText.trim()) {
      await prisma.form.update({
        where: { id: form.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "No text could be extracted from this document. Try a clearer scan." },
        { status: 422 }
      );
    }

    // Detect logical fields — via DeepSeek (with OCR text sanitized to
    // neutralise embedded instructions), falling back to a heuristic.
    let detected: DetectedField[];
    try {
      detected = await detectFormFields(ocrText);
    } catch {
      detected = heuristicFields(ocrText);
    }
    if (detected.length === 0) detected = heuristicFields(ocrText);

    // Fill from the profile knowledge base FIRST; only missing fields remain.
    const ctx = await getProfileContext(session.user.id);
    const { fields, autoFilled, missing } = fillFromProfile(detected, ctx);

    // Persist fields
    await prisma.formField.deleteMany({ where: { formId: form.id } });
    await prisma.formField.createMany({
      data: fields.map((f, i) => ({
        formId: form.id,
        label: f.label,
        fieldType: f.fieldType,
        order: f.order || i + 1,
        value: f.value,
        confidence: f.autoFilled ? 0.95 : ocrConfidence || 0.5,
      })),
    });

    await prisma.form.update({
      where: { id: form.id },
      data: {
        status: missing === 0 ? "FILLED" : "DRAFT",
        ocrText: ocrText.slice(0, 20000),
        filledData: fields.reduce<Record<string, string>>((acc, f) => {
          acc[f.label] = f.value;
          return acc;
        }, {}),
      },
    });

    return NextResponse.json({
      status: missing === 0 ? "FILLED" : "DRAFT",
      fields,
      autoFilled,
      missing,
      missingLabels: fields.filter((f) => !f.autoFilled).map((f) => f.label),
      ocrConfidence,
    });
  } catch (err) {
    await prisma.form.update({
      where: { id: form.id },
      data: { status: "FAILED" },
    });
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Heuristic field detection used when the DeepSeek API is not
 * configured. Picks label-like lines ending in ":" from OCR text.
 */
function heuristicFields(text: string): DetectedField[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fields: DetectedField[] = [];
  const seen = new Set<string>();
  let order = 1;

  for (const line of lines) {
    const m = line.match(/^([A-Z][A-Za-z &'\-()]{2,60})\s*:?\s*$/);
    if (!m) continue;
    const label = m[1].trim();
    // Skip title/header lines (e.g. "RENTAL AGREEMENT") and signature blocks.
    if (label === label.toUpperCase()) continue;
    if (/SIGNATURE|ACKNOWLEDGEMENT|DECLARATION\s*$/.test(label)) continue;
    if (label.length < 3 || label.length > 60) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    fields.push({ label, fieldType: "text", order: order++ });
    if (fields.length >= 25) break;
  }

  return fields;
}
