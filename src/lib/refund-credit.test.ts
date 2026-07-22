import { describe, it, expect } from "vitest";
import { computeRefundCredit, type RefundConfig } from "./refund-credit";

const CONFIG: RefundConfig = { thresholdAmount: 500, gstPercent: 5, creditExpiryDays: 365 };

describe("computeRefundCredit — below threshold", () => {
  it("credits ex-GST amount for COD under ₹500 (₹210)", () => {
    // 210 / 1.05 = 200 exact
    const r = computeRefundCredit({ total: 210, paymentMethod: "cash", config: CONFIG });
    expect(r.kind).toBe("low_value_ex_gst");
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBe(200);
  });

  it("credits ex-GST amount for UPI under ₹500 (₹105 → ₹100)", () => {
    const r = computeRefundCredit({ total: 105, paymentMethod: "upi", config: CONFIG });
    expect(r.kind).toBe("low_value_ex_gst");
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBe(100);
  });

  it("credits ex-GST for COD at ₹499 (boundary just below threshold)", () => {
    const r = computeRefundCredit({ total: 499, paymentMethod: "cash", config: CONFIG });
    expect(r.kind).toBe("low_value_ex_gst");
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBe(Math.round(499 / 1.05));
  });

  it("does NOT credit for COD exactly at ₹500 (threshold is exclusive)", () => {
    const r = computeRefundCredit({ total: 500, paymentMethod: "cash", config: CONFIG });
    expect(r.kind).toBe("none");
    expect(r.creditAmount).toBe(0);
  });

  it("rounds correctly for a value with fractional ex-GST (₹99 → 94)", () => {
    // 99 / 1.05 = 94.2857 → 94
    const r = computeRefundCredit({ total: 99, paymentMethod: "cash", config: CONFIG });
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBe(94);
  });

  it("clamps to a minimum of ₹1 when the rounded credit would be zero", () => {
    const r = computeRefundCredit({ total: 1, paymentMethod: "cash", config: CONFIG });
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBeGreaterThanOrEqual(1);
  });

  it("sets expiry exactly 1 year (365 days) from the approval date", () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const r = computeRefundCredit({ total: 200, paymentMethod: "cash", now, config: CONFIG });
    if (r.kind !== "low_value_ex_gst") throw new Error("expected credit");
    const diffDays = Math.round((r.expiresAt.getTime() - now.getTime()) / 86_400_000);
    expect(diffDays).toBe(365);
  });

  it("honours a custom expiry (30 days)", () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const r = computeRefundCredit({
      total: 200, paymentMethod: "cash", now,
      config: { ...CONFIG, creditExpiryDays: 30 },
    });
    if (r.kind !== "low_value_ex_gst") throw new Error("expected credit");
    const diffDays = Math.round((r.expiresAt.getTime() - now.getTime()) / 86_400_000);
    expect(diffDays).toBe(30);
  });

  it("honours a custom GST percent (18%)", () => {
    // 118 / 1.18 = 100 exact
    const r = computeRefundCredit({
      total: 118, paymentMethod: "cash",
      config: { ...CONFIG, gstPercent: 18 },
    });
    if (r.kind === "low_value_ex_gst") expect(r.creditAmount).toBe(100);
  });

  it("honours a custom threshold (₹1000)", () => {
    const r = computeRefundCredit({
      total: 900, paymentMethod: "cash",
      config: { ...CONFIG, thresholdAmount: 1000 },
    });
    expect(r.kind).toBe("low_value_ex_gst");
  });
});

describe("computeRefundCredit — wallet full refund", () => {
  it("always returns the full total for wallet payments, no expiry", () => {
    const r = computeRefundCredit({ total: 1250, paymentMethod: "wallet", config: CONFIG });
    expect(r.kind).toBe("wallet_full");
    if (r.kind === "wallet_full") expect(r.creditAmount).toBe(1250);
  });

  it("refunds wallet even when total is below the threshold (no GST strip, no expiry)", () => {
    const r = computeRefundCredit({ total: 200, paymentMethod: "wallet", config: CONFIG });
    expect(r.kind).toBe("wallet_full");
    if (r.kind === "wallet_full") expect(r.creditAmount).toBe(200);
  });
});

describe("computeRefundCredit — no credit cases", () => {
  it("returns none for ₹0 total", () => {
    const r = computeRefundCredit({ total: 0, paymentMethod: "cash", config: CONFIG });
    expect(r.kind).toBe("none");
  });

  it("returns none for COD/UPI at or above threshold (₹750)", () => {
    const r = computeRefundCredit({ total: 750, paymentMethod: "cash", config: CONFIG });
    expect(r.kind).toBe("none");
    expect(r.creditAmount).toBe(0);
  });
});
