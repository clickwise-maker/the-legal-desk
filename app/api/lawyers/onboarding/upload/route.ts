import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/storage/blob";

export const dynamic = "force-dynamic";

const ACCEPTED: Record<"barId" | "photo", { types: string[]; label: string }> = {
  barId: {
    types: ["application/pdf", "image/jpeg", "image/png"],
    label: "Bar Council ID / enrolment certificate",
  },
  photo: {
    types: ["image/jpeg", "image/png", "image/webp"],
    label: "Profile photograph",
  },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const kind = z.enum(["barId", "photo"]).safeParse(formData?.get("type"));

  if (!formData || !kind.success) {
    return NextResponse.json({ error: "Missing upload type" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const rules = ACCEPTED[kind.data];
  if (!rules.types.includes(file.type)) {
    return NextResponse.json(
      { error: `Only ${rules.types.map((t) => t.split("/")[1].toUpperCase()).join(", ")} files are allowed for the ${rules.label}.` },
      { status: 415 }
    );
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadFile({
    buffer,
    fileName: file.name,
    contentType: file.type,
    prefix: `onboarding/${session.user.id}/${kind.data}`,
  });

  return NextResponse.json({ ok: true, url, type: kind.data });
}
