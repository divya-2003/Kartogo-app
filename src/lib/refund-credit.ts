// Pure, framework-free calculation for the "low-value refund → Kartogo Cash" rule.
// Kept isolated so unit tests can verify every edge case without touching the DB.

export type RefundConfig = {
  /** Order total (in ₹) at/above which the low-value refund credit rule does NOT apply. */
  thresholdAmount: number;
  /** GST % baked into GST-inclusive order totals. Stripped from the refund credit. */
  gstPercent: number;
  /** How long, in days, the refund credit is valid from the approval date. */
  creditExpiryDays: number;
};

export type RefundOutcome =
  | { kind: "none"; reason: string; creditAmount: 0 }
  | { kind: "wallet_full"; creditAmount: number }
  | { kind: "low_value_ex_gst"; creditAmount: number; expiresAt: Date };

/**
 * Compute the wallet credit that should be posted when an admin approves a refund.
 *
 * Rules (see also comments on `resolveRefundRequestFn`):
 *  - Wallet-paid orders: full refund back to the wallet, no expiry.
 *  - Any order strictly under the configured threshold (including COD): refund
 *    the ex-GST amount to the wallet, valid for `creditExpiryDays` from `now`.
 *  - Orders at or above the threshold that were NOT wallet-paid: no auto credit.
 */
export function computeRefundCredit(input: {
  total: number;
  paymentMethod: "cash" | "upi" | "wallet";
  now?: Date;
  config: RefundConfig;
}): RefundOutcome {
  const total = Math.max(0, Math.round(Number(input.total) || 0));
  const now = input.now ?? new Date();
  const { thresholdAmount, gstPercent, creditExpiryDays } = input.config;

  if (total <= 0) return { kind: "none", reason: "zero-total", creditAmount: 0 };

  if (input.paymentMethod === "wallet") {
    return { kind: "wallet_full", creditAmount: total };
  }

  if (total < thresholdAmount) {
    const rate = Math.max(0, Number(gstPercent) || 0) / 100;
    const raw = total / (1 + rate);
    // Never post 0 — a ₹1 minimum keeps the wallet entry meaningful.
    const creditAmount = Math.max(1, Math.round(raw));
    const expiresAt = new Date(now.getTime());
    expiresAt.setDate(expiresAt.getDate() + Math.max(1, Math.floor(creditExpiryDays)));
    return { kind: "low_value_ex_gst", creditAmount, expiresAt };
  }

  return { kind: "none", reason: "above-threshold-non-wallet", creditAmount: 0 };
}
