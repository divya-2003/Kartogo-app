import { createServerFn } from "@tanstack/react-start";

// Shared product catalog stored in the database. Anyone can read; only callers
// with a valid supplier or admin session token can add / edit / remove items.
// This is what makes items added on the Supplier page also appear for customers
// and in the admin console — the catalog is no longer a per-browser localStorage list.

export type CatalogItemRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  mrp: number | null;
  unit: string;
  stock: number;
  emoji: string;
  image: string | null;
  description: string;
  source: string;
  max_per_order: number | null;
};

const str = (v: unknown, max = 500): string => String(v ?? "").trim().slice(0, max);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Who = { source: "supplier" | "admin"; categories: string[] | null };

async function authorize(supplierToken: string, adminToken: string): Promise<Who | null> {
  if (adminToken) {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (verifyAdminToken(adminToken)) return { source: "admin", categories: null };
  }
  if (supplierToken) {
    const { verifySupplierToken } = await import("./auth-tokens.server");
    const s = verifySupplierToken(supplierToken);
    if (s) {
      const { findSupplierById } = await import("./suppliers");
      const sup = findSupplierById(s.supplierId);
      return { source: "supplier", categories: sup?.categories ?? [] };
    }
  }
  return null;
}

/** Current category of a catalog product (seed catalog + supplier-added items). */
async function categoryOf(productId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("catalog_items")
    .select("category")
    .eq("id", productId)
    .maybeSingle();
  if (data?.category) return String(data.category);
  const { PRODUCTS } = await import("./data");
  return PRODUCTS.find((p) => p.id === productId)?.category ?? null;
}

/**
 * A supplier may only touch products inside the categories they own. Admins are
 * unrestricted. Brand-new items must be created inside an owned category.
 */
async function assertCanTouch(who: Who, productId: string, nextCategory?: string) {
  if (who.source === "admin") return;
  const owned = who.categories ?? [];
  const current = await categoryOf(productId);
  if (current && !owned.includes(current)) {
    throw new Error("This product is outside your supplier categories");
  }
  if (nextCategory && !owned.includes(nextCategory)) {
    throw new Error("You can only manage products in your own categories");
  }
  if (!current && !nextCategory) {
    throw new Error("This product is outside your supplier categories");
  }
}

// When an item comes back into stock, close out the "Notify me" restock
// requests the admin is tracking for it — they become "restocked" (confirmed).
async function confirmRestockAlerts(productId: string, stock: number) {
  if (stock <= 0 || !productId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("stock_alerts")
      .update({ status: "restocked", updated_at: new Date().toISOString() })
      .eq("product_id", productId)
      .in("status", ["pending", "sourcing"]);
  } catch { /* restock confirmation is best-effort */ }
}

// ---------------- List all items (public) ----------------
export const listCatalogItemsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("catalog_items")
    .select("id, name, category, price, mrp, unit, stock, emoji, image, description, source, max_per_order")
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to list catalog items", error);
    return { items: [] as CatalogItemRow[], deletedIds: [] as string[] };
  }
  // Soft-deleted ids come back too so the app can also hide bundled seed items
  // a supplier removed from their inventory.
  const { data: gone } = await supabaseAdmin
    .from("catalog_items")
    .select("id")
    .eq("is_deleted", true);
  return {
    items: (data ?? []) as CatalogItemRow[],
    deletedIds: ((gone ?? []) as { id: string }[]).map(r => r.id),
  };
});

// ---------------- Upsert (add or edit) an item ----------------
export const upsertCatalogItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    supplierToken?: string; adminToken?: string;
    id?: string; name?: string; category?: string; price?: number; mrp?: number;
    unit?: string; stock?: number; emoji?: string; image?: string; description?: string;
    maxPerOrder?: number | null;
  }) => ({
    supplierToken: data?.supplierToken ? String(data.supplierToken) : "",
    adminToken: data?.adminToken ? String(data.adminToken) : "",
    id: str(data?.id, 80),
    name: str(data?.name, 200),
    category: str(data?.category, 80),
    price: num(data?.price),
    mrp: data?.mrp == null ? null : num(data?.mrp),
    unit: str(data?.unit, 80),
    stock: Math.max(0, Math.floor(num(data?.stock))),
    emoji: str(data?.emoji, 8) || "🛒",
    image: data?.image ? String(data.image).trim().slice(0, 2_000_000) : null,
    description: str(data?.description, 2000),
    maxPerOrder: data?.maxPerOrder == null || num(data?.maxPerOrder) <= 0 ? null : Math.floor(num(data?.maxPerOrder)),
  }))
  .handler(async ({ data }) => {
    const who = await authorize(data.supplierToken, data.adminToken);
    if (!who) throw new Error("Not authorized to edit the catalog");
    if (!data.id) throw new Error("Item id required");
    if (!data.name) throw new Error("Item name required");
    await assertCanTouch(who, data.id, data.category || "snacks");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("catalog_items").upsert({
      id: data.id,
      name: data.name,
      category: data.category || "snacks",
      price: data.price,
      mrp: data.mrp,
      unit: data.unit,
      stock: data.stock,
      emoji: data.emoji,
      image: data.image,
      description: data.description,
      max_per_order: data.maxPerOrder,
      source: who.source,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    }, { onConflict: "id" });
    if (error) { console.error("upsert catalog", error); throw new Error("Could not save item"); }
    await confirmRestockAlerts(data.id, data.stock);
    return { ok: true };
  });

// ---------------- Delete ----------------
export const deleteCatalogItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: { supplierToken?: string; adminToken?: string; id?: string }) => ({
    supplierToken: data?.supplierToken ? String(data.supplierToken) : "",
    adminToken: data?.adminToken ? String(data.adminToken) : "",
    id: str(data?.id, 80),
  }))
  .handler(async ({ data }) => {
    const who = await authorize(data.supplierToken, data.adminToken);
    if (!who) throw new Error("Not authorized to edit the catalog");
    if (!data.id) throw new Error("Item id required");
    await assertCanTouch(who, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Soft delete: the row stays in the suppliers' database, flagged as deleted
    // with the timestamp and who removed it, so history and audits survive.
    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from("catalog_items")
      .update({ is_deleted: true, deleted_at: now, deleted_by: who.source })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error("Could not delete item");
    if (!updated || updated.length === 0) {
      // Bundled seed item that was never edited: record a tombstone row so the
      // deletion (and its date) is stored and the item stays hidden everywhere.
      const { error: insErr } = await supabaseAdmin.from("catalog_items").insert({
        id: data.id, name: data.id, category: "deleted", price: 0, unit: "",
        stock: 0, emoji: "🛒", description: "", source: who.source,
        is_deleted: true, deleted_at: now, deleted_by: who.source,
      });
      if (insErr) throw new Error("Could not delete item");
    }
    return { ok: true };
  });

// ---------------- Quick edits: price / stock ----------------
export const setCatalogPriceFn = createServerFn({ method: "POST" })
  .inputValidator((data: { supplierToken?: string; adminToken?: string; id?: string; price?: number }) => ({
    supplierToken: data?.supplierToken ? String(data.supplierToken) : "",
    adminToken: data?.adminToken ? String(data.adminToken) : "",
    id: str(data?.id, 80),
    price: num(data?.price),
  }))
  .handler(async ({ data }) => {
    const who = await authorize(data.supplierToken, data.adminToken);
    if (!who) throw new Error("Not authorized");
    await assertCanTouch(who, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("catalog_items").update({ price: data.price }).eq("id", data.id);
    if (error) throw new Error("Could not update price");
    return { ok: true };
  });

export const setCatalogStockFn = createServerFn({ method: "POST" })
  .inputValidator((data: { supplierToken?: string; adminToken?: string; id?: string; stock?: number }) => ({
    supplierToken: data?.supplierToken ? String(data.supplierToken) : "",
    adminToken: data?.adminToken ? String(data.adminToken) : "",
    id: str(data?.id, 80),
    stock: Math.max(0, Math.floor(num(data?.stock))),
  }))
  .handler(async ({ data }) => {
    const who = await authorize(data.supplierToken, data.adminToken);
    if (!who) throw new Error("Not authorized");
    await assertCanTouch(who, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("catalog_items").update({ stock: data.stock }).eq("id", data.id);
    if (error) throw new Error("Could not update stock");
    await confirmRestockAlerts(data.id, data.stock);
    return { ok: true };
  });
