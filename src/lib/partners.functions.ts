import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PartnerMarket = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  isActive: boolean;
  acceptingOrders: boolean;
  prepMinutes: number;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  is_active: boolean;
  accepting_orders?: boolean | null;
  prep_minutes?: number | null;
  created_at: string;
  updated_at: string;
};

const rowToMarket = (r: Row): PartnerMarket => ({
  id: r.id,
  name: r.name,
  address: r.address,
  phone: r.phone,
  lat: r.lat,
  lng: r.lng,
  notes: r.notes,
  isActive: r.is_active,
  acceptingOrders: r.accepting_orders ?? true,
  prepMinutes: Number(r.prep_minutes ?? 12),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function requireAdmin(token: string) {
  const { verifyAdminToken } = await import("./auth-tokens.server");
  if (!verifyAdminToken(token)) throw new Error("Admin authorization required");
}

export const listPartnerMarketsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("partner_markets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load partner markets");
    return (rows as Row[]).map(rowToMarket);
  });

const upsertSchema = z.object({
  adminToken: z.string().min(1),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(400),
  phone: z.string().max(20).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const upsertPartnerMarketFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => upsertSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone?.trim() || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      notes: data.notes?.trim() || null,
      is_active: data.isActive ?? true,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("partner_markets").update(payload).eq("id", data.id).select("*").maybeSingle();
      if (error || !row) throw new Error("Could not save partner market");
      return rowToMarket(row as Row);
    }
    const { data: row, error } = await supabaseAdmin
      .from("partner_markets").insert(payload).select("*").maybeSingle();
    if (error || !row) throw new Error("Could not add partner market");
    return rowToMarket(row as Row);
  });

export const deletePartnerMarketFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string; id: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: z.string().uuid().parse(data?.id),
  }))
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("partner_markets").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete partner market");
    return { ok: true };
  });

// ---------------- Merchant tools — live store operations ----------------
// Lets ops flip a supermarket between "taking orders" and "paused" without
// deactivating it, and keep its typical preparation time honest so customer
// ETAs stay believable.
export const setMarketOperationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        adminToken: z.string().min(1),
        id: z.string().uuid(),
        acceptingOrders: z.boolean().optional(),
        prepMinutes: z.number().int().min(1).max(180).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { accepting_orders?: boolean; prep_minutes?: number } = {};
    if (data.acceptingOrders !== undefined) patch.accepting_orders = data.acceptingOrders;
    if (data.prepMinutes !== undefined) patch.prep_minutes = data.prepMinutes;
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await supabaseAdmin
      .from("partner_markets").update(patch).eq("id", data.id).select("*").maybeSingle();
    if (error || !row) throw new Error("Could not update store operations");
    return rowToMarket(row as Row);
  });

// ---------------- Public storefront ----------------
// Customers browsing the Categories/Markets page only ever see active markets
// and a safe subset of fields (never internal notes or owner phone numbers).
export type PublicMarket = {
  id: string;
  name: string;
  address: string;
  acceptingOrders: boolean;
  prepMinutes: number;
};

const toPublic = (r: Row): PublicMarket => ({
  id: r.id,
  name: r.name,
  address: r.address,
  acceptingOrders: r.accepting_orders ?? true,
  prepMinutes: Number(r.prep_minutes ?? 12),
});

export const listPublicMarketsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("partner_markets")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error("Could not load partnered markets");
  return (rows as Row[]).map(toPublic);
});

// Product ids this market actually stocks. Customers browsing a market only
// see these items — never the whole Kartogo catalogue.
export const listMarketProductIdsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("inventory_items")
      .select("product_id")
      .eq("market_id", data.id);
    if (error) throw new Error("Could not load this market's items");
    return Array.from(new Set((rows ?? []).map((r) => String(r.product_id))));
  });

export const getPublicMarketFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("partner_markets")
      .select("*")
      .eq("id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!row) throw new Error("Market not found");
    return toPublic(row as Row);
  });
