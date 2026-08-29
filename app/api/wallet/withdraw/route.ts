import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  amountInr: z.number().min(50),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Amount must be at least ₹50" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  if (wallet.balance < parsed.data.amountInr) {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  }

  // Withdrawals are debited immediately (paid out manually by ops).
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: session.user.id },
      data: { balance: { decrement: parsed.data.amountInr } },
    });
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        userId: session.user.id,
        type: "WITHDRAWAL",
        amount: -parsed.data.amountInr,
        description: "Withdrawal to bank account",
      },
    });
  });

  return NextResponse.json({ ok: true });
}
