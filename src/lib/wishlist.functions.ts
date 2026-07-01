import { createServerFn } from "@tanstack/react-start";

// Server-authoritative wishlist.
// Saved products live in the database keyed by the customer's phone, so the
// wishlist follows the customer across devices and logins. Identity is proven
// by the same signed customer token used everywhere else — the browser can only
// change ITS OWN wishlist.

const cleanIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const out = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (id) out.add(id.slice(0, 64));
  }
  return [...out].slice(0, 500);
};

async function loadWishlist(phone: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("customer_wishlists")
    .select("product_id")
    .eq("phone", phone)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load wishlist", error);
    return [];
  }
  return (data ?? []).map((r) => r.product_id as string);
}

// ---------------- Read wishlist (token-scoped) ----------------
export const getWishlistFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string }) => ({ token: data?.token ? String(data.token) : "" }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { ids: [] as string[] };
    return { ids: await loadWishlist(session.phone) };
  });

// ---------------- Add a product ----------------
export const addWishlistFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; productId: string }) => ({
    token: data?.token ? String(data.token) : "",
    productId: String(data?.productId ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to save items");
    if (!data.productId) throw new Error("Missing product");

    const { error } = await supabaseAdmin
      .from("customer_wishlists")
      .upsert({ phone: session.phone, product_id: data.productId }, { onConflict: "phone,product_id" });
    if (error) {
      console.error("Failed to add to wishlist", error);
      throw new Error("Could not save item. Please try again.");
    }
    return { ids: await loadWishlist(session.phone) };
  });

// ---------------- Remove a product ----------------
export const removeWishlistFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; productId: string }) => ({
    token: data?.token ? String(data.token) : "",
    productId: String(data?.productId ?? "").trim().slice(0, 64),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to manage your wishlist");
    if (!data.productId) return { ids: await loadWishlist(session.phone) };

    const { error } = await supabaseAdmin
      .from("customer_wishlists")
      .delete()
      .eq("phone", session.phone)
      .eq("product_id", data.productId);
    if (error) {
      console.error("Failed to remove from wishlist", error);
      throw new Error("Could not update your wishlist. Please try again.");
    }
    return { ids: await loadWishlist(session.phone) };
  });

// ---------------- Merge (used at login to fold guest items in) ----------------
export const mergeWishlistFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; ids?: unknown }) => ({
    token: data?.token ? String(data.token) : "",
    ids: cleanIds(data?.ids),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) return { ids: [] as string[] };

    if (data.ids.length > 0) {
      const rows = data.ids.map((product_id) => ({ phone: session.phone, product_id }));
      const { error } = await supabaseAdmin
        .from("customer_wishlists")
        .upsert(rows, { onConflict: "phone,product_id" });
      if (error) console.error("Failed to merge wishlist", error);
    }
    return { ids: await loadWishlist(session.phone) };
  });
