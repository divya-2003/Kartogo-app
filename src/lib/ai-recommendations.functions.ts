import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// "You may also like" picked by Lovable AI from the store's own catalog.
// One AI answer per product is cached for a week so browsing never re-bills.

const CACHE_DAYS = 7;
const PICKS = 8;

type CatalogLine = { id: string; name: string; category: string; price: number; description?: string | null };

async function loadCatalog(): Promise<CatalogLine[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { PRODUCTS } = await import("./data");
  const { data: rows } = await supabaseAdmin
    .from("catalog_items")
    .select("id, name, category, price, description, stock, is_deleted");
  const deleted = new Set((rows ?? []).filter(r => r.is_deleted).map(r => String(r.id)));
  const byId = new Map<string, CatalogLine & { stock: number }>();
  for (const p of PRODUCTS) {
    if (!deleted.has(p.id)) byId.set(p.id, { id: p.id, name: p.name, category: p.category, price: p.price, description: p.description, stock: p.stock });
  }
  for (const r of rows ?? []) {
    if (r.is_deleted) continue;
    byId.set(String(r.id), { id: String(r.id), name: String(r.name), category: String(r.category), price: Number(r.price), description: r.description, stock: Number(r.stock ?? 0) });
  }
  return Array.from(byId.values()).filter(p => p.stock > 0);
}

export const aiRelatedProductsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ productId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ ids: string[]; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cached } = await supabaseAdmin
      .from("product_ai_recommendations")
      .select("related_ids, generated_at")
      .eq("product_id", data.productId)
      .maybeSingle();
    const fresh = cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_DAYS * 86_400_000;
    if (fresh) return { ids: cached.related_ids ?? [] };

    const catalog = await loadCatalog();
    const product = catalog.find(p => p.id === data.productId);
    // Only real, in-stock catalog products get an AI call.
    if (!product) return { ids: cached?.related_ids ?? [] };
    const others = catalog.filter(p => p.id !== product.id).slice(0, 300);
    if (others.length === 0) return { ids: [] };

    const lines = others.map(p => `${p.id} | ${p.name} | ${p.category} | ₹${p.price}`).join("\n");
    try {
      const { aiObject } = await import("./ai-responses.server");
      const out = await aiObject({
        instructions:
          "You are the merchandiser for Kartogo, a local delivery store in Ongole, India. " +
          "Recommend products a shopper viewing one item would also like: complementary items first, then close alternatives. " +
          "Only use ids from the catalog list. Never repeat the viewed product.",
        prompt:
          `Viewed product: ${product.name} (${product.category}, ₹${product.price})${product.description ? ` — ${product.description.slice(0, 200)}` : ""}\n\n` +
          `Catalog (id | name | category | price):\n${lines}\n\nPick up to ${PICKS} ids, best first.`,
        schema: z.object({ ids: z.array(z.string()) }),
        effort: "low",
      });
      const valid = new Set(others.map(p => p.id));
      const ids = Array.from(new Set(out.ids.filter(id => valid.has(id)))).slice(0, PICKS);
      await supabaseAdmin.from("product_ai_recommendations").upsert({
        product_id: product.id,
        related_ids: ids,
        catalog_size: others.length,
        generated_at: new Date().toISOString(),
      });
      return { ids };
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      // Keep the last good answer; never retry here (each call is billed).
      return { ids: cached?.related_ids ?? [], error: status === 402 || status === 403 ? (e as Error).message : undefined };
    }
  });
