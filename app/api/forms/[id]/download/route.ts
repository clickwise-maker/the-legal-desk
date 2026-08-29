import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage/blob";
import { fillAcroForm, overlayFilledCopy, getAcroFormFields } from "@/lib/forms/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({
    where: { id: params.id },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (form.status !== "COMPLETED") {
    return NextResponse.json({ error: "Please complete payment to download the filled form" }, { status: 402 });
  }

  try {
    const bytes = await readFile(form.fileUrl);

    // Image uploads can't be "re-filled" — render a PDF summary instead.
    if (form.fileType !== "application/pdf") {
      return renderSummaryPdf(form, session.user.name ?? "Client");
    }

    const values = form.fields.map((f) => ({ name: f.label, value: f.value }));
    const acroNames = await getAcroFormFields(bytes);

    let out: Buffer;
    if (acroNames.length > 0) {
      out = await fillAcroForm(bytes, values);
    } else {
      out = await overlayFilledCopy(bytes, values);
    }

    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName(form.fileName)}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function renderSummaryPdf(form: { title: string; fields: { label: string; value: string }[] }, ownerName: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 792 - 90, width: 612, height: 90, color: rgb(0.1, 0.21, 0.36) });
  page.drawText("LegalFlow AI Filled Form", { x: 40, y: 740, size: 20, font: helvBold, color: rgb(0.84, 0.62, 0.18) });
  page.drawText(`${form.title}  •  ${ownerName}`, { x: 40, y: 716, size: 11, font: helv, color: rgb(0.9, 0.93, 0.97) });

  let y = 660;
  page.drawText("Detected fields and filled values:", { x: 40, y, size: 13, font: helvBold, color: rgb(0.1, 0.21, 0.36) });
  y -= 24;

  for (const f of form.fields) {
    page.drawText(`${f.label}:`, { x: 40, y, size: 11, font: helvBold, color: rgb(0.3, 0.35, 0.45) });
    const value = f.value || "(left blank)";
    page.drawText(value.slice(0, 90), { x: 230, y, size: 11, font: helv, color: rgb(0.2, 0.25, 0.33) });
    y -= 18;
    if (y < 60) break;
  }

  const out = await doc.save();
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName(form.title)}-filled.pdf"`,
    },
  });
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_") || "form.pdf";
}
