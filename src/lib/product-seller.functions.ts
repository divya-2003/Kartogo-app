import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ProductSeller = {
  sellerName: string;
  sellerType: string;
  stores: { name: string; address: string }[];
};

/**
 * Public "Sold by" details for a product page: who lists the item and which
 * partner stores currently stock it. Only names and shop addresses are
 * returned — never phone numbers.
 */
export const getProductSellerFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ productId: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<ProductSeller | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SUPPLIERS } = await import("./suppliers");
    const { PRODUCTS } = await import("./data");
    const { data: row } = await supabaseAdmin
      .from("catalog_items")
      .select("category, seller_id, seller_name, is_deleted")
      .eq("id", data.productId)
      .maybeSingle();
    if (row?.is_deleted) return null;
    const category = row?.category ?? PRODUCTS.find(p => p.id === data.productId)?.category;
    if (!category) return null;
    const owner = (row?.seller_id && SUPPLIERS.find(s => s.id === row.seller_id))
      || SUPPLIERS.find(s => s.categories.includes(category));
    const { data: inv } = await supabaseAdmin
      .from("inventory_items")
      .select("current_stock, reserved_stock, partner_markets(name, address, is_active)")
      .eq("product_id", data.productId)
      .eq("is_deleted", false)
      .limit(10);
    const stores = ((inv ?? []) as any[])
      .filter(i => i.partner_markets?.is_active && Number(i.current_stock) - Number(i.reserved_stock) > 0)
      .map(i => ({ name: String(i.partner_markets.name ?? ""), address: String(i.partner_markets.address ?? "") }))
      .filter(s => s.name)
      .slice(0, 3);
    return {
      sellerName: row?.seller_name || owner?.name || "Kartogo",
      sellerType: category === "pharmacy" ? "Licensed pharmacy partner" : "Kartogo verified seller",
      stores,
    };
  });
