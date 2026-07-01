import type { Order } from "./store";

// Human-readable labels for each payment method.
export const PAYMENT_LABELS: Record<Order["paymentMethod"], string> = {
  cash: "Cash on delivery",
  upi: "UPI on delivery",
  wallet: "Kartogo Cash (Wallet)",
};

export type PaymentBreakdown = {
  walletUsed: number;
  otherUsed: number;
  otherLabel: string;
  otherMethod: "cash" | "upi" | null;
};

// Derives how an order's total was split across the wallet and cash/UPI.
// Wallet orders are fully covered by Kartogo Cash; cash/UPI orders are paid
// entirely on delivery. Derivable from the order itself — no extra storage.
export function paymentBreakdown(o: { paymentMethod: Order["paymentMethod"]; total: number }): PaymentBreakdown {
  if (o.paymentMethod === "wallet") {
    return { walletUsed: o.total, otherUsed: 0, otherLabel: "Kartogo Cash", otherMethod: null };
  }
  const otherLabel = o.paymentMethod === "upi" ? "UPI on delivery" : "Cash on delivery";
  return { walletUsed: 0, otherUsed: o.total, otherLabel, otherMethod: o.paymentMethod };
}
