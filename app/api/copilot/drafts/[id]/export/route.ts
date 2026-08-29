import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ONLYOFFICE-ready: Photo/PDF → OCR → AI draft → DOCX/PDF → editable → export
// MVP uses pdf-lib for PDF and docx for DOCX; swap to ONLYOFFICE DocumentServer integration via WOPI callback when licensed.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const draft = await prisma.draft.findFirst({ where: { id: params.id, ownerId: session.user.id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const format = new URL(req.url).searchParams.get("format") ?? "pdf";

  if (format === "docx") {
    // Lightweight DOCX via docx pacakege — graceful fallback to text if not installed
    try {
      // @ts-ignore - docx types resolved at runtime
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(draft.title)] }),
              ...draft.content.split("\n").map((line) => {
                if (line.startsWith("# ")) return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(2))] });
                if (line.startsWith("## ")) return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.slice(3))] });
                return new Paragraph({ children: [new TextRun(line)] });
              }),
            ],
          },
        ],
      });
      const buffer = await Packer.toBuffer(doc);
      return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${draft.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.docx"`,
        },
      });
    } catch {
      return new NextResponse(draft.content, {
        headers: { "Content-Type": "text/plain", "Content-Disposition": `attachment; filename="${draft.title}.txt"` },
      });
    }
  }

  // PDF export via pdf-lib (already in deps)
  try {
    // @ts-ignore - pdf-lib types bundler
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const lines = `${draft.title}\n\n${draft.content}`.split("\n");
    let y = 800;
    page.drawText(draft.title, { x: 50, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.3) });
    y -= 24;
    for (const line of lines.slice(1)) {
      if (y < 50) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(line.slice(0, 110), { x: 50, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }
    const bytes = await pdf.save();
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${draft.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
