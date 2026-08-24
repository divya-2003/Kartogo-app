import { createServerFn } from "@tanstack/react-start";

// Server-authoritative wallet (Kartogo Cash).
// Balances and transaction history live ONLY in the database and are reached
// through the service-role client. The browser can no longer fabricate or
// inflate a balance — identity is proven by a signed customer token.

export type WalletTxnRow = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  note: string;
  created_at: string;
  expires_at: string | null;
  expired_at: string | null;
};

export type TopupRow = {
  id: string;
  amount: number;
  status: "pending" | "success" | "failed";
  created_at: string;
};

async function loadWallet(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Sweep any credits whose 1-year validity has elapsed before reading balance.
  await supabaseAdmin.rpc("expire_wallet_credits", { p_phone: phone });

  const [{ data: wallet }, { data: txns }] = await Promise.all([
    supabaseAdmin.from("customer_wallets").select("balance").eq("phone", phone).maybeSingle(),
    supabaseAdmin
      .from("wallet_transactions")
      .select("id, type, amount, note, created_at, expires_at, expired_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    balance: Number(wallet?.balance ?? 0),
    txns: (txns ?? []) as WalletTxnRow[],
  };
}


async function loadTopups(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("wallet_topups")
    .select("id, amount, status, created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TopupRow[];
}

// ---------------- Read balance + history (token-scoped) ----------------
export const getWalletFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { balance: 0, txns: [] as WalletTxnRow[] };
    return loadWallet(session.phone);
  });

// ---------------- Read top-up history (token-scoped) ----------------
export const getTopupsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { topups: [] as TopupRow[] };
    return { topups: await loadTopups(session.phone) };
  });

// ---------------- Request a top up (token-scoped, NO automatic credit) ----------------
// SECURITY: The client can no longer credit its own wallet. A top-up is only
// recorded as `pending` here; Kartogo Cash is added exclusively by
// `confirmWalletTopupFn`, which requires a verified payment (admin review today,
// a signature-verified PSP callback when the gateway is wired in).
export const addMoneyFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; amount: number; reference?: string }) => {
    const amount = Math.round(Number(data?.amount) || 0);
    if (amount <= 0) throw new Error("Enter a valid amount");
    if (amount > 100000) throw new Error("Amount is too large");
    return {
      token: data?.token ? String(data.token) : "",
      amount,
      reference: data?.reference ? String(data.reference).trim().slice(0, 120) : "",
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");

    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to add money");

    const { error } = await supabaseAdmin
      .from("wallet_topups")
      .insert({ phone: session.phone, amount: data.amount, status: "pending", reference: data.reference || null });
    if (error) {
      console.error("Failed to record top-up request", error);
      throw new Error("Could not submit your top-up. Please try again.");
    }

    const wallet = await loadWallet(session.phone);
    return { ...wallet, topups: await loadTopups(session.phone), pending: true };
  });

// ---------------- Confirm a top-up (payment verified) ----------------
// Credits Kartogo Cash only once a human/admin (or, later, a signature-verified
// payment gateway callback) has confirmed the money actually arrived.
export const confirmWalletTopupFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; topupId?: string; approve?: boolean }) => ({
    adminToken: data?.adminToken ? String(data.adminToken) : "",
    topupId: String(data?.topupId ?? "").trim().slice(0, 60),
    approve: data?.approve !== false,
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    if (!data.topupId) throw new Error("Top-up id required");

    const { data: row } = await supabaseAdmin
      .from("wallet_topups")
      .select("id, phone, amount, status")
      .eq("id", data.topupId)
      .maybeSingle();
    if (!row || row.status !== "pending") throw new Error("This top-up is no longer pending");

    if (!data.approve) {
      await supabaseAdmin
        .from("wallet_topups")
        .update({ status: "failed", reviewed_at: new Date().toISOString(), reviewed_by: "admin" })
        .eq("id", row.id)
        .eq("status", "pending");
      return { ok: true, credited: false };
    }

    // Flip to success first so a double click can never credit twice.
    const { data: claimed } = await supabaseAdmin
      .from("wallet_topups")
      .update({ status: "success", reviewed_at: new Date().toISOString(), reviewed_by: "admin" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) throw new Error("This top-up is no longer pending");

    const { error } = await supabaseAdmin.rpc("adjust_wallet", {
      p_phone: row.phone as string,
      p_amount: Number(row.amount),
      p_type: "credit",
      p_note: "Wallet top-up (payment verified)",
    });
    if (error) {
      console.error("Failed to credit verified top-up", error);
      await supabaseAdmin.from("wallet_topups").update({ status: "pending" }).eq("id", row.id);
      throw new Error("Could not credit the wallet. Please try again.");
    }
    return { ok: true, credited: true };
  });

// ---------------- Admin: list pending top-ups ----------------
export const listPendingTopupsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: data?.adminToken ? String(data.adminToken) : "" }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) return { topups: [] as (TopupRow & { phone: string })[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("wallet_topups")
      .select("id, phone, amount, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    return { topups: (rows ?? []) as (TopupRow & { phone: string })[] };
  });

// ---------------- Record a failed / cancelled top-up (token-scoped) ----------------
// Called when the user cancels the UPI payment or it does not complete, so the
// attempt still shows up in their top-up history.
export const recordFailedTopupFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; amount: number }) => {
    const amount = Math.round(Number(data?.amount) || 0);
    if (amount <= 0) throw new Error("Enter a valid amount");
    if (amount > 100000) throw new Error("Amount is too large");
    return { token: data?.token ? String(data.token) : "", amount };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");

    const session = verifyCustomerToken(data.token);
    if (!session) return { topups: [] as TopupRow[] };

    await supabaseAdmin
      .from("wallet_topups")
      .insert({ phone: session.phone, amount: data.amount, status: "failed" });

    return { topups: await loadTopups(session.phone) };
  });
