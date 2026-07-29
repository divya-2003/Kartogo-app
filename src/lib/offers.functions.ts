import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------- Additional offers ----------------
// Admin-authored promotional cards that render on the customer product pages.
// An offer either applies to every product ("applies to all") or to a hand
// picked list of product ids chosen in the admin editor.

export type ProductOffer = {
  id: string;
  title: string;
  description: string;
  badge: string;
  tone: OfferTone;
  appliesToAll: boolean;
  productIds: string[];
  isActive: boolean;
  sortOrder: number;
};

export type OfferTone = "primary" | "leaf" | "saffron" | "destructive" | "ink";
export const OFFER_TONES: OfferTone[] = ["primary", "leaf", "saffron", "destructive", "ink"];

type Row = {
  id: string;
  title: string;
  description: string;
  badge: string;
  tone: string;
  applies_to_all: boolean;
  product_ids: unknown;
  is_active: boolean;
  sort_order: number;
};

const toOffer = (r: Row): ProductOffer => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  badge: r.badge ?? "",
  tone: (OFFER_TONES as string[]).includes(r.tone) ? (r.tone as OfferTone) : "primary",
  appliesToAll: !!r.applies_to_all,
  productIds: Array.isArray(r.product_ids) ? (r.product_ids as string[]).map(String) : [],
  isActive: !!r.is_active,
  sortOrder: Number(r.sort_order ?? 0),
});

const SELECT = "id,title,description,badge,tone,applies_to_all,product_ids,is_active,sort_order";

const offerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(""),
  badge: z.string().trim().max(24).default(""),
  tone: z.enum(["primary", "leaf", "saffron", "destructive", "ink"]).default("primary"),
  appliesToAll: z.boolean().default(false),
  productIds: z.array(z.string().max(80)).max(500).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

/** Public: every active offer, used to decorate the customer-facing pages. */
export const listActiveOffersFn = createServerFn({ method: "GET" }).handler(async (): Promise<ProductOffer[]> => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabasePublic = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabasePublic
    .from("product_offers")
    .select(SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data as Row[]).map(toOffer);
});

/** Admin: the full list, including paused offers. */
export const listAllOffersFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<ProductOffer[]> => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_offers")
      .select(SELECT)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Could not load offers");
    return (rows as Row[]).map(toOffer);
  });

/** Admin: create or update one offer. */
export const saveOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ adminToken: z.string(), offer: offerSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<ProductOffer> => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.offer.title,
      description: data.offer.description,
      badge: data.offer.badge,
      tone: data.offer.tone,
      applies_to_all: data.offer.appliesToAll,
      product_ids: data.offer.appliesToAll ? [] : data.offer.productIds,
      is_active: data.offer.isActive,
      sort_order: data.offer.sortOrder,
      updated_at: new Date().toISOString(),
    };
    const q = data.offer.id
      ? supabaseAdmin.from("product_offers").update(payload).eq("id", data.offer.id).select(SELECT).maybeSingle()
      : supabaseAdmin.from("product_offers").insert(payload).select(SELECT).maybeSingle();
    const { data: row, error } = await q;
    if (error || !row) throw new Error("Could not save this offer. Please try again.");
    return toOffer(row as Row);
  });

/** Admin: remove an offer entirely. */
export const deleteOfferFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: z.string().uuid().parse(data?.id),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_offers").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this offer");
    return { ok: true as const };
  });

/** Offers that apply to a given product id. */
export const offersForProduct = (offers: ProductOffer[], productId: string) =>
  offers.filter((o) => o.isActive && (o.appliesToAll || o.productIds.includes(productId)));
