import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentOrder } from "@/lib/payments/razorpay";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findUnique({ where: { id: params.id } });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (form.status === "COMPLETED") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }
  if (form.status !== "FILLED") {
    return NextResponse.json(
      { error: "Finish filling all fields before paying." },
      { status: 409 }
    );
  }

  // Don't let clients bypass the missing-info stepper.
  const fields = await prisma.formField.findMany({
    where: { formId: form.id },
    select: { value: true },
  });
  const emptyFields = fields.filter((f) => !f.value || !f.value.trim()).length;
  if (emptyFields > 0) {
    return NextResponse.json(
      { error: `Please fill the ${emptyFields} remaining field${emptyFields === 1 ? "" : "s"} before paying.` },
      { status: 422 }
    );
  }

  const order = await createPaymentOrder({
    amountInr: form.price,
    receipt: `form_${form.id}`,
    notes: { formId: form.id, type: "FORM" },
  });

  return NextResponse.json({
    formId: form.id,
    amountInr: form.price,
    orderId: order?.id ?? null,
    razorpayConfigured: Boolean(order),
  });
}
