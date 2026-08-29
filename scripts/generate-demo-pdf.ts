import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
  page.drawText("RENTAL AGREEMENT", { x: 60, y: 720, size: 20, font: helvBold, color: rgb(0.1, 0.2, 0.35) });
  page.drawText("(Sample form for LegalFlow demo)", { x: 60, y: 696, size: 11, font: helv, color: rgb(0.4, 0.4, 0.4) });

  const rows = [
    "Full name",
    "Address",
    "Property type",
    "Tenure (months)",
    "Monthly rent",
    "Security deposit",
    "Landlord name",
    "Email address",
    "Phone number",
    "Start date",
  ];

  let y = 640;
  for (const label of rows) {
    const field = form.createTextField(label);
    field.setText("");
    field.addToPage(page, { x: 60, y: y - 18, width: 320, height: 18, borderWidth: 1, borderColor: rgb(0.7, 0.75, 0.85) });
    page.drawText(`${label}:`, { x: 60, y, size: 12, font: helv, color: rgb(0.2, 0.25, 0.33) });
    y -= 40;
  }

  const bytes = await doc.save();
  const dir = path.resolve(process.cwd(), ".uploads/demo");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "rental-agreement-sample.pdf"), bytes);
  console.log("Wrote .uploads/demo/rental-agreement-sample.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
