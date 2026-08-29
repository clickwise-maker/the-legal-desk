"use client";

import { useCallback, useRef, useState } from "react";

type PaymentType = "BOOKING" | "FORM" | "DEPOSIT";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("client only"));
    if (window.Razorpay) return resolve();
    const existing = document.getElementById("razorpay-checkout-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

/**
 * Client-side payment hook. Uses Razorpay Checkout when configured,
 * otherwise simulates a successful payment through the verify API
 * (test mode) so the full flow works without API keys.
 */
export function usePayment() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const verifying = useRef(false);

  const pay = useCallback(
    async ({
      type,
      referenceId,
      orderId,
      amountInr,
      description,
      customerName,
      customerEmail,
    }: {
      type: PaymentType;
      referenceId: string;
      orderId: string | null;
      amountInr: number;
      description: string;
      customerName?: string;
      customerEmail?: string;
    }) => {
      setStatus("processing");
      setError("");

      // Test mode — no order id means Razorpay isn't configured.
      if (!orderId) {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            referenceId,
            orderId: `test_${referenceId}`,
            paymentId: `pay_test_${Date.now()}`,
            signature: "test_signature",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "Payment failed");
          throw new Error(data.error ?? "Payment failed");
        }
        setStatus("success");
        return data;
      }

      await loadRazorpayScript();
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) {
        setStatus("error");
        setError("Razorpay is not configured");
        throw new Error("Razorpay is not configured");
      }

      return new Promise((resolve, reject) => {
        if (verifying.current) return;
        verifying.current = true;

        const rzp = new window.Razorpay!({
          key,
          amount: Math.round(amountInr * 100),
          currency: "INR",
          name: "LegalFlow",
          description,
          prefill: {
            name: customerName,
            email: customerEmail,
          },
          theme: { color: "#1a365d" },
          order_id: orderId,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const res = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type,
                  referenceId,
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Verification failed");
              setStatus("success");
              resolve(data);
            } catch (err) {
              setStatus("error");
              setError(err instanceof Error ? err.message : "Verification failed");
              reject(err);
            } finally {
              verifying.current = false;
            }
          },
          modal: {
            ondismiss: () => {
              verifying.current = false;
              setStatus("idle");
              reject(new Error("Payment window closed"));
            },
          },
        });
        rzp.open();
      });
    },
    []
  );

  return { pay, status, error };
}
