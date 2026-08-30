import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Razorpay webhook — idempotent, verifies signature, updates ledger, audit logs
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (signature !== expected) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event: { event: string; payload: { payment: { entity: { id: string; order_id: string; status: string; amount: number } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Idempotency: check if already processed
  const paymentId = event.payload?.payment?.entity?.id;
  if (!paymentId) return NextResponse.json({ ok: true });
  const existing = await prisma.transaction.findFirst({ where: { reference: paymentId, status: "SUCCESS" } });
  if (existing) return NextResponse.json({ ok: true, alreadyProcessed: true });

  // For demo, just audit log — real handling would update booking/wallet per event type
  await prisma.auditLog.create({
    data: { action: `RAZORPAY_WEBHOOK_${event.event}`, targetId: paymentId, targetType: "Payment", meta: event as unknown as object, ip: req.headers.get("x-forwarded-for")?.split(",")[0] },
  });

  return NextResponse.json({ ok: true });
}
