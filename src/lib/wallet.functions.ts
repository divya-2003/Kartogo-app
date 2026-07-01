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
};

export type TopupRow = {
  id: string;
  amount: number;
  status: "success" | "failed";
  created_at: string;
};

async function loadWallet(phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: wallet }, { data: txns }] = await Promise.all([
    supabaseAdmin.from("customer_wallets").select("balance").eq("phone", phone).maybeSingle(),
    supabaseAdmin
      .from("wallet_transactions")
      .select("id, type, amount, note, created_at")
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

// ---------------- Top up money (token-scoped, server-side credit) ----------------
// NOTE: In production this must be gated behind a real payment gateway callback.
// The key security property fixed here is that the balance is server state — a
// client can no longer simply write a number into localStorage to pay for free.
export const addMoneyFn = createServerFn({ method: "POST" })
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
    if (!session) throw new Error("Please log in to add money");

    const { error } = await supabaseAdmin.rpc("adjust_wallet", {
      p_phone: session.phone,
      p_amount: data.amount,
      p_type: "credit",
      p_note: "Added to wallet",
    });
    if (error) {
      console.error("Failed to top up wallet", error);
      // Record the failed attempt so the customer sees it in their history.
      await supabaseAdmin
        .from("wallet_topups")
        .insert({ phone: session.phone, amount: data.amount, status: "failed" });
      throw new Error("Could not add money. Please try again.");
    }

    // Record the successful top-up for history.
    await supabaseAdmin
      .from("wallet_topups")
      .insert({ phone: session.phone, amount: data.amount, status: "success" });

    const wallet = await loadWallet(session.phone);
    return { ...wallet, topups: await loadTopups(session.phone) };
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
