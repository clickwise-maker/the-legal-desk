import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage/blob";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forms = await prisma.form.findMany({
    where: { ownerId: session.user.id },
    include: {
      fields: { orderBy: { order: "asc" } },
      _count: { select: { fields: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(forms);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string)?.trim() || "Untitled form";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF, PNG, JPEG and WEBP are supported" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadFile({
    buffer,
    fileName: file.name,
    contentType: file.type,
    prefix: "forms",
  });

  const form = await prisma.form.create({
    data: {
      ownerId: session.user.id,
      title,
      fileName: file.name,
      fileUrl,
      fileType: file.type,
      status: "UPLOADED",
      price: 5,
    },
  });

  return NextResponse.json(form, { status: 201 });
}
