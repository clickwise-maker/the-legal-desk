import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: session.user.id },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  return NextResponse.json(wallet);
}
