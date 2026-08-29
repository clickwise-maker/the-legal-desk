import Razorpay from "razorpay";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.startsWith("rzp_test_your")) {
    return null;
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return instance;
}

export async function createPaymentOrder({
  amountInr,
  receipt,
  notes,
}: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const rzp = getRazorpay();
  if (!rzp) return null;
  const order = await rzp.orders.create({
    amount: Math.round(amountInr * 100),
    currency: "INR",
    receipt,
    notes,
  });
  return order;
}

export async function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const rzp = getRazorpay();
  // Test mode: Razorpay is not configured, accept the "payment".
  if (!rzp) return true;
  // validatePaymentSignature is not part of the public typings
  const withValidation = rzp as unknown as {
    validatePaymentSignature: (args: { order_id: string; payment_id: string; signature: string }) => boolean;
  };
  return withValidation.validatePaymentSignature({
    order_id: orderId,
    payment_id: paymentId,
    signature,
  });
}
