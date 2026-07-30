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
};

const str = (v: unknown, max = 500): string => String(v ?? "").trim().slice(0, max);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function authorize(supplierToken: string, adminToken: string): Promise<{ source: "supplier" | "admin" } | null> {
  if (adminToken) {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (verifyAdminToken(adminToken)) return { source: "admin" };
  }
  if (supplierToken) {
    const { verifySupplierToken } = await import("./auth-tokens.server");
    if (verifySupplierToken(supplierToken)) return { source: "supplier" };
  }
  return null;
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
    .select("id, name, category, price, mrp, unit, stock, emoji, image, description, source")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to list catalog items", error);
    return { items: [] as CatalogItemRow[] };
  }
  return { items: (data ?? []) as CatalogItemRow[] };
});

// ---------------- Upsert (add or edit) an item ----------------
export const upsertCatalogItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    supplierToken?: string; adminToken?: string;
    id?: string; name?: string; category?: string; price?: number; mrp?: number;
    unit?: string; stock?: number; emoji?: string; image?: string; description?: string;
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
  }))
  .handler(async ({ data }) => {
    const who = await authorize(data.supplierToken, data.adminToken);
    if (!who) throw new Error("Not authorized to edit the catalog");
    if (!data.id) throw new Error("Item id required");
    if (!data.name) throw new Error("Item name required");
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
      source: who.source,
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("catalog_items").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete item");
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("catalog_items").update({ stock: data.stock }).eq("id", data.id);
    if (error) throw new Error("Could not update stock");
    await confirmRestockAlerts(data.id, data.stock);
    return { ok: true };
  });
