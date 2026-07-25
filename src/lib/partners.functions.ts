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
