import { createServerFn } from "@tanstack/react-start";
import type { RefundConfig } from "./refund-credit";

export type RefundAuditRow = {
  id: string;
  order_id: string;
  customer_phone: string | null;
  decision: "approved" | "rejected";
  resolution: string | null;
  order_total: number | null;
  credit_amount: number;
  credit_expires_at: string | null;
  threshold_amount: number | null;
  gst_percent: number | null;
  actor: string;
  created_at: string;
};

const DEFAULT_CONFIG: RefundConfig = {
  thresholdAmount: 500,
  gstPercent: 5,
  creditExpiryDays: 365,
};

export async function loadRefundConfig(): Promise<RefundConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("refund_config")
    .select("threshold_amount, gst_percent, credit_expiry_days")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_CONFIG;
  return {
    thresholdAmount: Number(data.threshold_amount ?? DEFAULT_CONFIG.thresholdAmount),
    gstPercent: Number(data.gst_percent ?? DEFAULT_CONFIG.gstPercent),
    creditExpiryDays: Number(data.credit_expiry_days ?? DEFAULT_CONFIG.creditExpiryDays),
  };
}

export const getRefundConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    return loadRefundConfig();
  });

export const setRefundConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    adminToken?: string;
    thresholdAmount: number;
    gstPercent: number;
    creditExpiryDays: number;
  }) => {
    const thresholdAmount = Math.max(0, Math.round(Number(data?.thresholdAmount) || 0));
    const gstPercent = Math.max(0, Math.min(100, Number(data?.gstPercent) || 0));
    const creditExpiryDays = Math.max(1, Math.min(3650, Math.floor(Number(data?.creditExpiryDays) || 0)));
    if (thresholdAmount > 1_000_000) throw new Error("Threshold too large");
    return {
      adminToken: String(data?.adminToken ?? ""),
      thresholdAmount, gstPercent, creditExpiryDays,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { error } = await supabaseAdmin
      .from("refund_config")
      .upsert({
        id: 1,
        threshold_amount: data.thresholdAmount,
        gst_percent: data.gstPercent,
        credit_expiry_days: data.creditExpiryDays,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error("Could not save refund settings. Please try again.");
    return loadRefundConfig();
  });

export const listRefundAuditLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; limit?: number }) => ({
    adminToken: String(data?.adminToken ?? ""),
    limit: Math.min(500, Math.max(1, Math.floor(Number(data?.limit) || 200))),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { data: rows, error } = await supabaseAdmin
      .from("refund_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error("Could not load audit log. Please try again.");
    return (rows ?? []) as RefundAuditRow[];
  });

// -------- 12-month wallet history for CSV export (token-scoped) --------
export type WalletHistoryRow = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  note: string;
  created_at: string;
  expires_at: string | null;
  expired_at: string | null;
};

export const getWalletHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to export your wallet history");

    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const { data: rows, error } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, type, amount, note, created_at, expires_at, expired_at")
      .eq("phone", session.phone)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error("Could not load wallet history. Please try again.");
    return { rows: (rows ?? []) as WalletHistoryRow[], since: since.toISOString() };
  });
