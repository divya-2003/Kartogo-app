// Server-authoritative promotional engine.
//
// Every discount a customer sees is re-derived here from the promo_codes table
// before an order is written: validity window, minimum basket, total usage cap,
// per-customer cap and first-order-only rules are all enforced server side.

import { discountForRule, eligibleSubtotal, type BasketLine, type PromoRule } from "./promo";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const SELECT =
  "id, code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, per_customer_limit, first_order_only, is_active, product_ids";

type Row = Record<string, unknown>;

export const toRule = (r: Row): PromoRule => ({
  code: String(r["code"] ?? "").toUpperCase(),
  description: String(r["description"] ?? ""),
  discountType: r["discount_type"] === "pct" ? "pct" : "flat",
  discountValue: Number(r["discount_value"] ?? 0),
  minSubtotal: Number(r["min_subtotal"] ?? 0),
  maxDiscount: r["max_discount"] == null ? null : Number(r["max_discount"]),
  startsAt: (r["starts_at"] as string | null) ?? null,
  endsAt: (r["ends_at"] as string | null) ?? null,
  usageLimit: r["usage_limit"] == null ? null : Number(r["usage_limit"]),
  perCustomerLimit: Number(r["per_customer_limit"] ?? 1),
  firstOrderOnly: !!r["first_order_only"],
  isActive: !!r["is_active"],
  productIds: Array.isArray(r["product_ids"]) ? (r["product_ids"] as unknown[]).map(String) : [],
});

export async function listPromoRules(activeOnly = true): Promise<PromoRule[]> {
  try {
    const supabaseAdmin = await db();
    let q = supabaseAdmin.from("promo_codes").select(SELECT).order("min_subtotal", { ascending: true });
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => toRule(r as Row));
  } catch (e) {
    console.error("Failed to load promo codes", e);
    return [];
  }
}

export type PromoEvaluation =
  | { ok: true; code: string; discount: number; description: string }
  | { ok: false; reason: string };

/**
 * Can `phone` use `code` on a basket of `subtotal` right now?
 * Returns the exact rupee discount when yes, a human reason when no.
 *
 * When the code is limited to selected products, only those lines of the
 * basket count towards the minimum and the discount.
 */
export async function evaluatePromo(
  code: string,
  subtotal: number,
  phone: string | null,
  items?: BasketLine[],
): Promise<PromoEvaluation> {
  const upper = String(code ?? "").trim().toUpperCase();
  if (!upper) return { ok: false, reason: "Enter a promo code" };

  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin.from("promo_codes").select(SELECT).eq("code", upper).maybeSingle();
  if (!data) return { ok: false, reason: "Invalid promo code" };

  const rule = toRule(data as Row);
  if (!rule.isActive) return { ok: false, reason: "This code is no longer active" };

  const now = Date.now();
  if (rule.startsAt && new Date(rule.startsAt).getTime() > now) {
    return { ok: false, reason: "This offer has not started yet" };
  }
  if (rule.endsAt && new Date(rule.endsAt).getTime() < now) {
    return { ok: false, reason: "This offer has expired" };
  }

  const applicable = eligibleSubtotal(rule, subtotal, items);
  if (rule.productIds.length && applicable <= 0) {
    return { ok: false, reason: `${upper} applies only to selected products, which aren't in your cart` };
  }
  if (applicable < rule.minSubtotal) {
    return { ok: false, reason: `Add items worth ₹${Math.ceil(rule.minSubtotal - applicable)} more to use ${upper}` };
  }


  if (rule.usageLimit != null) {
    const { count } = await supabaseAdmin
      .from("promo_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("code", upper);
    if ((count ?? 0) >= rule.usageLimit) return { ok: false, reason: "This offer is fully claimed" };
  }

  if (phone) {
    const { count } = await supabaseAdmin
      .from("promo_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("code", upper)
      .eq("phone", phone);
    if ((count ?? 0) >= Math.max(1, rule.perCustomerLimit)) {
      return { ok: false, reason: "You have already used this code" };
    }

    if (rule.firstOrderOnly) {
      const { count: orders } = await supabaseAdmin
        .from("app_orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_phone", phone);
      if ((orders ?? 0) > 0) return { ok: false, reason: "This code is for first orders only" };
    }
  }

  const discount = discountForRule(rule, applicable);
  if (discount <= 0) return { ok: false, reason: "This code gives no discount on your basket" };
  return { ok: true, code: upper, discount, description: rule.description };
}

/** Records a use so the caps above actually bite. Never throws. */
export async function recordRedemption(code: string, phone: string, orderId: string, discount: number) {
  try {
    const supabaseAdmin = await db();
    await supabaseAdmin
      .from("promo_redemptions")
      .insert({ code: code.toUpperCase(), phone, order_id: orderId, discount });
  } catch (e) {
    console.error("promo redemption write failed", e);
  }
}
