import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ComboItem = { productId: string; name: string; qty: number };
export type Combo = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  emoji: string | null;
  price: number;
  items: ComboItem[];
  category: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string; name: string; description: string | null; image: string | null;
  emoji: string | null; price: number; items: unknown; category: string | null;
  is_active: boolean; created_by: string | null; created_at: string; updated_at: string;
};

const toCombo = (r: Row): Combo => ({
  id: r.id, name: r.name, description: r.description, image: r.image, emoji: r.emoji,
  price: Number(r.price) || 0,
  items: Array.isArray(r.items) ? (r.items as ComboItem[]) : [],
  category: r.category, isActive: r.is_active,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

// Anyone (customer, unauthenticated shopper) can list active combos.
export const listActiveCombosFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("combos").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw new Error("Could not load combos");
  return (data as Row[]).map(toCombo);
});

// Admins (still active on the staff roster) manage every combo; a supplier
// only ever sees and changes the combos it created itself.
async function requireAdminOrSupplier(adminToken?: string, supplierToken?: string) {
  const { verifySupplierToken } = await import("./auth-tokens.server");
  if (adminToken) {
    const { resolveAccess } = await import("./admin-session.server");
    if ((await resolveAccess(adminToken)).valid) return { role: "admin" as const, id: "admin" };
  }
  if (supplierToken) {
    const s = verifySupplierToken(supplierToken);
    if (s) return { role: "supplier" as const, id: s.supplierId };
  }
  throw new Error("Authorization required");
}

// Admin & supplier both use this to list ALL combos (active + inactive) they manage.
export const listAllCombosFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: d?.adminToken ? String(d.adminToken) : undefined,
    supplierToken: d?.supplierToken ? String(d.supplierToken) : undefined,
  }))
  .handler(async ({ data }) => {
    const actor = await requireAdminOrSupplier(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("combos").select("*");
    if (actor.role === "supplier") query = query.eq("created_by", actor.id);
    const { data: rows, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error("Could not load combos");
    return (rows as Row[]).map(toCombo);
  });

const upsertSchema = z.object({
  adminToken: z.string().optional(),
  supplierToken: z.string().optional(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  image: z.string().max(2_000_000).nullable().optional(),
  emoji: z.string().max(4).nullable().optional(),
  price: z.number().positive().max(100000),
  items: z.array(z.object({
    productId: z.string().min(1).max(120),
    name: z.string().min(1).max(160),
    qty: z.number().int().min(1).max(50),
  })).min(1).max(20),
  category: z.string().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Combos are surfaced to shoppers as ordinary catalogue products (own "Combos"
 * category) so search, category pages, cart and checkout validation all work
 * without special-casing. The combo row stays the source of truth for its
 * contents; this mirror row is what customers actually add to the cart.
 */
async function syncComboToCatalog(c: Combo) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!c.isActive) {
    await supabaseAdmin.from("catalog_items").delete().eq("id", c.id);
    return;
  }
  await supabaseAdmin.from("catalog_items").upsert({
    id: c.id,
    name: c.name,
    category: "combos",
    price: c.price,
    unit: `${c.items.reduce((n, i) => n + i.qty, 0)} items combo`,
    stock: 999,
    emoji: c.emoji || "🎁",
    image: c.image,
    description: c.description || c.items.map(i => `${i.name} x${i.qty}`).join(", "),
    source: "combo",
  });
}

export const upsertComboFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data }) => {
    const actor = await requireAdminOrSupplier(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      image: data.image || null,
      emoji: data.emoji || null,
      price: Math.round(data.price),
      items: data.items,
      category: data.category?.trim() || null,
      is_active: data.isActive ?? true,
    };
    if (data.id) {
      let update = supabaseAdmin.from("combos").update(payload).eq("id", data.id);
      if (actor.role === "supplier") update = update.eq("created_by", actor.id);
      const { data: row, error } = await update.select("*").maybeSingle();
      if (error || !row) throw new Error("Could not save combo");
      const combo = toCombo(row as Row);
      await syncComboToCatalog(combo);
      return combo;
    }
    const { data: row, error } = await supabaseAdmin.from("combos")
      .insert({ ...payload, created_by: actor.id }).select("*").maybeSingle();
    if (error || !row) throw new Error("Could not create combo");
    const combo = toCombo(row as Row);
    await syncComboToCatalog(combo);
    return combo;
  });

export const deleteComboFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; id: string }) => ({
    adminToken: d?.adminToken ? String(d.adminToken) : undefined,
    supplierToken: d?.supplierToken ? String(d.supplierToken) : undefined,
    id: z.string().uuid().parse(d?.id),
  }))
  .handler(async ({ data }) => {
    const actor = await requireAdminOrSupplier(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let del = supabaseAdmin.from("combos").delete().eq("id", data.id);
    if (actor.role === "supplier") del = del.eq("created_by", actor.id);
    const { data: removed, error } = await del.select("id");
    if (error) throw new Error("Could not delete combo");
    if (!removed?.length) throw new Error("Combo not found");
    await supabaseAdmin.from("catalog_items").delete().eq("id", data.id);
    return { ok: true };
  });
