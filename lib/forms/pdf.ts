import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox,
  PDFRadioGroup,
} from "pdf-lib";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * Extract text from a digital PDF using pdftotext (poppler).
 * Returns empty string for scanned/blank PDFs.
 */
export async function extractPdfText(pdfBytes: Buffer): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lf-pdf-"));
  const src = path.join(dir, "input.pdf");
  await fs.writeFile(src, pdfBytes);
  try {
    const { stdout } = await execFileAsync("pdftotext", [src, "-"]);
    return stdout.trim();
  } catch {
    return "";
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * Rasterize the first page of a PDF to a PNG buffer for OCR.
 */
export async function rasterizeFirstPage(pdfBytes: Buffer): Promise<Buffer | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lf-raster-"));
  const src = path.join(dir, "input.pdf");
  await fs.writeFile(src, pdfBytes);
  try {
    await execFileAsync("pdftoppm", ["-png", "-r", "200", "-f", "1", "-l", "1", "-singlefile", src, path.join(dir, "page")]);
    const out = path.join(dir, "page.png");
    return await fs.readFile(out);
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * Get interactive AcroForm field names for a PDF, if any.
 */
export async function getAcroFormFields(pdfBytes: Buffer): Promise<string[]> {
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = doc.getForm();
    const fields = form.getFields().map((f) => {
      try {
        return f.getName();
      } catch {
        return "";
      }
    });
    return fields.filter(Boolean);
  } catch {
    return [];
  }
}

type PdfFieldValue = { name: string; value: string };

/**
 * Fill interactive AcroForm fields. Returns the new PDF bytes.
 */
export async function fillAcroForm(pdfBytes: Buffer, values: PdfFieldValue[]): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  for (const field of fields) {
    const name = safeName(field);
    const match = values.find((v) => normalizeKey(v.name) === normalizeKey(name));
    if (!match || !match.value) continue;
    try {
      if (field instanceof PDFTextField) {
        field.setText(match.value);
      } else if (field instanceof PDFDropdown) {
        field.select(match.value);
      } else if (field instanceof PDFCheckBox) {
        field.check();
      } else if (field instanceof PDFRadioGroup) {
        try {
          field.select(match.value);
        } catch {
          /* keep */
        }
      }
    } catch {
      // skip unfillable fields
    }
  }
  form.flatten();
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Fill a flat (non-interactive) form by overlaying values as a watermark
 * list of detected fields on a fresh copy of the PDF. If the first page
 * can be rasterized, values are placed over a visual grid for context.
 */
export async function overlayFilledCopy(pdfBytes: Buffer, values: PdfFieldValue[]): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const rendered = await rasterizeFirstPage(pdfBytes);
  let bgImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;

  if (rendered) {
    try {
      bgImage = await doc.embedPng(rendered);
    } catch {
      try {
        bgImage = await doc.embedJpg(rendered);
      } catch {
        bgImage = null;
      }
    }
  }

  const page = doc.getPages()[0] ?? doc.addPage([612, 792]);
  const { width, height } = page.getSize();

  if (bgImage) {
    page.drawImage(bgImage, { x: 0, y: 0, width, height });
  }

  // Semi-transparent legend so underlying form stays readable
  const boxY = height - 20;
  page.drawRectangle({
    x: 20,
    y: boxY - 90,
    width: width - 40,
    height: 90,
    color: rgb(1, 1, 1),
    opacity: 0.88,
    borderColor: rgb(0.82, 0.62, 0.18),
    borderWidth: 1,
  });

  page.drawText("LegalFlow AI Auto-Fill Summary", {
    x: 32,
    y: boxY - 24,
    size: 13,
    font: helvBold,
    color: rgb(0.1, 0.21, 0.36),
  });

  let y = boxY - 48;
  let count = 0;
  for (const v of values) {
    if (!v.value) continue;
    if (count >= 6) break;
    const text = `${v.name}: ${v.value}`.slice(0, 110);
    page.drawText(text, {
      x: 32,
      y,
      size: 9,
      font: helv,
      color: rgb(0.2, 0.25, 0.33),
      maxWidth: width - 70,
    });
    y -= 13;
    count += 1;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_:./-]/g, "");
}

function safeName(field: { getName: () => string }): string {
  try {
    return field.getName();
  } catch {
    return "";
  }
}
