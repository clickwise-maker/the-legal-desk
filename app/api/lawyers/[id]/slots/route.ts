import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSlotsForDate } from "@/lib/scheduling";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const dateKey = searchParams.get("date");

  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: params.id },
    include: { availability: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Lawyer not found" }, { status: 404 });
  }

  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
  }

  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const slots = await getSlotsForDate(profile, date);

  return NextResponse.json({
    date: dateKey,
    slots: slots.map((s) => ({
      start: s.toISOString(),
      label: s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    })),
  });
}
