import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePicks, type CategoryRank } from "./category-ranks";

/** Public: the admin's top picks for every Shop category (what customers see first). */
export const listCategoryRanksFn = createServerFn({ method: "GET" }).handler(async (): Promise<CategoryRank[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("category_product_ranks").select("category_slug, rank, product_ref").order("category_slug").order("rank");
  if (error) return [];
  return (data ?? []) as CategoryRank[];
});

/** Admin: set the 1st / 2nd / 3rd product for one Shop category (blank slots clear it). */
export const saveCategoryRanksFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    adminToken: z.string().min(10).max(800),
    categorySlug: z.string().min(1).max(60),
    picks: z.array(z.string().max(80).nullable()).max(3),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminPermission } = await import("./admin-session.server");
    const actor = await requireAdminPermission(data.adminToken, "partners");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cat } = await supabaseAdmin.from("mp_categories").select("slug, legacy_categories, group_key").eq("slug", data.categorySlug).maybeSingle();
    if (!cat || cat.group_key !== "shop") throw new Error("Pick a Shop category");

    const picks = normalizePicks(data.picks);
    // Every pick must really belong to this category.
    const legacy: string[] = cat.legacy_categories ?? [];
    const listingIds = picks.filter(p => p.product_ref.startsWith("mp:")).map(p => p.product_ref.slice(3));
    const productIds = picks.filter(p => !p.product_ref.startsWith("mp:")).map(p => p.product_ref);
    if (listingIds.length) {
      if (listingIds.some(id => !/^[0-9a-f-]{36}$/.test(id))) throw new Error("Unknown product");
      const { data: rows } = await supabaseAdmin.from("mp_listings").select("id").in("id", listingIds).eq("category_slug", data.categorySlug).eq("is_active", true);
      if ((rows ?? []).length !== listingIds.length) throw new Error("One of the picked products is not in this category");
    }
    if (productIds.length) {
      const { PRODUCTS } = await import("./data");
      const { data: rows } = await supabaseAdmin.from("catalog_items").select("id, category, is_deleted").in("id", productIds);
      for (const id of productIds) {
        const row = (rows ?? []).find(r => r.id === id);
        const category = row ? (row.is_deleted ? null : row.category) : PRODUCTS.find(p => p.id === id)?.category;
        if (!category || !legacy.includes(category)) throw new Error("One of the picked products is not in this category");
      }
    }

    const { error: delError } = await supabaseAdmin.from("category_product_ranks").delete().eq("category_slug", data.categorySlug);
    if (delError) throw new Error("Could not save the top picks");
    if (picks.length) {
      const { error } = await supabaseAdmin.from("category_product_ranks").insert(picks.map(p => ({ category_slug: data.categorySlug, rank: p.rank, product_ref: p.product_ref, updated_by: actor })));
      if (error) throw new Error("Could not save the top picks");
    }
    try {
      const { recordAudit } = await import("./audit.server");
      await recordAudit({ actor, actorRole: "admin", action: "category_ranks.save", entityType: "category", entityId: data.categorySlug, details: { picks } });
    } catch { /* best-effort */ }
    return { ok: true, picks };
  });
