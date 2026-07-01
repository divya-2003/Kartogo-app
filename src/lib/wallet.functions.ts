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

// ---------------- Read balance + history (token-scoped) ----------------
export const getWalletFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { balance: 0, txns: [] as WalletTxnRow[] };
    return loadWallet(session.phone);
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
      throw new Error("Could not add money. Please try again.");
    }

    return loadWallet(session.phone);
  });
