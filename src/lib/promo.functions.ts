import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PromoRule } from "./promo";

// Marketing & promotional engine — RPC surface.
// Customers list/validate codes; admins manage the catalogue of codes.

export type AdminPromo = PromoRule & { id: string; used: number };

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

/** Public: active codes, so checkout can preview eligible offers. */
export const listPromoRulesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PromoRule[]> => {
    const { listPromoRules } = await import("./promo.server");
    return listPromoRules(true);
  },
);

/** Customer: authoritative check of one code against the live basket. */
export const validatePromoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().optional().default(""),
        code: z.string().max(40),
        subtotal: z.number().min(0).max(10_000_000),
        items: z
          .array(
            z.object({
              productId: z.string().max(120),
              price: z.number().min(0).max(1_000_000),
              qty: z.number().int().min(1).max(999),
            }),
          )
          .max(200)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = data.token ? verifyCustomerToken(data.token) : null;
    const { evaluatePromo } = await import("./promo.server");
    return evaluatePromo(data.code, data.subtotal, session?.phone ?? null, data.items);
  });

/** Customer: personal referral code + how many friends have joined. */
export const getReferralFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { code: null as string | null, invited: 0, reward: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { referralCodeFor, REFERRAL_REWARD } = await import("./promo");

    const { data: me } = await supabaseAdmin
      .from("customers")
      .select("name, referral_code")
      .eq("phone", session.phone)
      .maybeSingle();

    let code = (me?.referral_code as string | null) ?? null;
    if (!code) {
      code = referralCodeFor(session.phone, String(me?.name ?? ""));
      await supabaseAdmin.from("customers").update({ referral_code: code }).eq("phone", session.phone);
    }

    const { count } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", code);

    return { code, invited: count ?? 0, reward: REFERRAL_REWARD };
  });

/** Customer: claim a friend's referral code (once, before the first order). */
export const applyReferralFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string(), code: z.string().max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please sign in first");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { REFERRAL_REWARD } = await import("./promo");
    const code = data.code.trim().toUpperCase();

    const { data: me } = await supabaseAdmin
      .from("customers")
      .select("id, referral_code, referred_by")
      .eq("phone", session.phone)
      .maybeSingle();
    if (!me) throw new Error("Complete your profile first");
    if (me.referred_by) throw new Error("You have already used a referral code");
    if ((me.referral_code as string | null) === code) throw new Error("You cannot refer yourself");

    const { data: friend } = await supabaseAdmin
      .from("customers")
      .select("phone")
      .eq("referral_code", code)
      .maybeSingle();
    if (!friend) throw new Error("That referral code does not exist");

    const { count: orders } = await supabaseAdmin
      .from("app_orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", session.phone);
    if ((orders ?? 0) > 0) throw new Error("Referral codes only work before your first order");

    await supabaseAdmin.from("customers").update({ referred_by: code }).eq("id", me.id);
    await supabaseAdmin.rpc("adjust_wallet", {
      p_phone: session.phone,
      p_amount: REFERRAL_REWARD,
      p_type: "credit",
      p_note: `Referral bonus (${code})`,
    });
    await supabaseAdmin.rpc("adjust_wallet", {
      p_phone: friend.phone as string,
      p_amount: REFERRAL_REWARD,
      p_type: "credit",
      p_note: "Friend joined Kartogo with your code",
    });

    return { ok: true as const, reward: REFERRAL_REWARD };
  });

// ---------------- Admin management ----------------

const promoSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  code: z.string().trim().min(3).max(24),
  description: z.string().trim().max(160).default(""),
  discountType: z.enum(["flat", "pct"]).default("flat"),
  discountValue: z.number().min(0).max(100000),
  minSubtotal: z.number().min(0).max(1_000_000).default(0),
  maxDiscount: z.number().min(0).max(1_000_000).nullable().default(null),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  usageLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
  perCustomerLimit: z.number().int().min(1).max(1000).default(1),
  firstOrderOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  /** Empty = whole basket. Otherwise the code only discounts these products. */
  productIds: z.array(z.string().max(120)).max(500).default([]),
});

export const listAdminPromosFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<AdminPromo[]> => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toRule } = await import("./promo.server");

    const [{ data: rows }, { data: uses }] = await Promise.all([
      supabaseAdmin.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("promo_redemptions").select("code, discount"),
    ]);

    const counts = new Map<string, number>();
    for (const u of uses ?? []) {
      const c = String(u.code ?? "").toUpperCase();
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    return (rows ?? []).map((r) => ({
      ...toRule(r as Record<string, unknown>),
      id: String(r.id),
      used: counts.get(String(r.code ?? "").toUpperCase()) ?? 0,
    }));
  });

export const savePromoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ adminToken: z.string(), promo: promoSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = data.promo;
    const payload = {
      code: p.code.toUpperCase(),
      description: p.description,
      discount_type: p.discountType,
      discount_value: p.discountValue,
      min_subtotal: p.minSubtotal,
      max_discount: p.maxDiscount,
      starts_at: p.startsAt || null,
      ends_at: p.endsAt || null,
      usage_limit: p.usageLimit,
      per_customer_limit: p.perCustomerLimit,
      first_order_only: p.firstOrderOnly,
      is_active: p.isActive,
      updated_at: new Date().toISOString(),
    };
    const q = p.id
      ? supabaseAdmin.from("promo_codes").update(payload).eq("id", p.id).select("id").maybeSingle()
      : supabaseAdmin.from("promo_codes").insert(payload).select("id").maybeSingle();
    const { error } = await q;
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("That code already exists");
      throw new Error("Could not save this promo code");
    }
    return { ok: true as const };
  });

export const deletePromoFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: z.string().uuid().parse(data?.id),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this promo code");
    return { ok: true as const };
  });
