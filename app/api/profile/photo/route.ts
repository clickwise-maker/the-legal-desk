import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage/blob";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPEG and WEBP photos are supported" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo too large (max 5 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadFile({
    buffer,
    fileName: `profile-${session.user.id}.${file.type.split("/")[1]}`,
    contentType: file.type,
    prefix: "profile",
  });

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { profilePhotoUrl: url, avatarUrl: url },
    select: { profilePhotoUrl: true },
  });

  return NextResponse.json({ profilePhotoUrl: user.profilePhotoUrl });
}
