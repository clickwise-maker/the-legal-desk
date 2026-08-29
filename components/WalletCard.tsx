"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePayment } from "@/lib/use-payment";
import { formatINR } from "@/lib/constants";
import { Button, Card } from "@/components/ui";

export function WalletCard({ balance, userId }: { balance: number; userId: string }) {
  const router = useRouter();
  const { pay, status, error } = usePayment();
  const [amount, setAmount] = useState("500");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value < 10) return;

    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountInr: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      setWithdrawError(data.error ?? "Could not create deposit");
      return;
    }

    await pay({
      type: "DEPOSIT",
      referenceId: data.orderId ?? String(data.pendingId),
      orderId: data.orderId,
      amountInr: data.amountInr,
      description: `Add ${formatINR(value)} to wallet`,
    });
    router.refresh();
  }

  async function handleWithdraw() {
    const value = Number(amount);
    if (!value || value < 50) {
      setWithdrawError("Minimum withdrawal is ₹50");
      return;
    }
    setWithdrawing(true);
    setWithdrawError("");
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      router.refresh();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-primary-800">Wallet balance</h3>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-50 text-gold-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
            <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
          </svg>
        </span>
      </div>
      <div className="mt-4 font-heading text-4xl font-black text-primary-800">
        {formatINR(balance)}
      </div>
      <form onSubmit={handleDeposit} className="mt-5 space-y-3">
        <input
          type="number"
          min={10}
          max={100000}
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount in ₹"
          aria-label="Amount"
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="primary" type="submit" disabled={status === "processing"} className="w-full">
            {status === "processing" ? "Processing…" : "Add money"}
          </Button>
          <Button variant="outline" type="button" disabled={withdrawing} onClick={handleWithdraw} className="w-full">
            {withdrawing ? "…" : "Withdraw"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {withdrawError && <p className="text-xs text-red-600">{withdrawError}</p>}
        <p className="text-xs text-legal-muted">Withdrawals: min ₹50. Add: min ₹10.</p>
      </form>
    </Card>
  );
}
