import { createServerFn } from "@tanstack/react-start";

// Product reviews / ratings.
// Customers rate the individual products in their delivered orders. Identity is
// proven by the signed customer token (never anything the client claims). The
// aggregated rating (average + count) is public so it can show on product pages.

export type ProductRating = {
  productId: string;
  average: number;
  count: number;
};

export type ReviewEntry = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  feedback: string;
  createdAt: number;
};

const str = (v: unknown, max = 300): string => String(v ?? "").trim().slice(0, max);
const clampRating = (v: unknown): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
};

// ---------------- Submit ratings for an order's items ----------------
export const submitReviewsFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token?: string;
      orderId?: string;
      ratings?: { productId?: string; productName?: string; rating?: number; feedback?: string }[];
    }) => ({
      token: data?.token ? String(data.token) : "",
      orderId: str(data?.orderId, 40),
      ratings: Array.isArray(data?.ratings)
        ? data.ratings
            .map((r) => ({
              productId: str(r?.productId, 40),
              productName: str(r?.productName, 200),
              rating: clampRating(r?.rating),
              feedback: str(r?.feedback, 500),
            }))
            .filter((r) => r.productId && r.rating >= 1)
            .slice(0, 50)
        : [],
    }),
  )
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session) throw new Error("Please log in to rate your order");
    if (!data.orderId) throw new Error("Missing order");
    if (data.ratings.length === 0) throw new Error("Pick at least one rating");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify the order belongs to this customer before recording any reviews.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("app_orders")
      .select("id, customer_phone, customer_name")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) {
      console.error("Failed to load order for review", orderErr);
      throw new Error("Could not submit your ratings. Please try again.");
    }
    if (!order || order.customer_phone !== session.phone) {
      throw new Error("You can only rate your own orders");
    }

    const rows = data.ratings.map((r) => ({
      order_id: data.orderId,
      product_id: r.productId,
      product_name: r.productName,
      customer_phone: session.phone,
      customer_name: str(order.customer_name, 200),
      rating: r.rating,
      feedback: r.feedback,
    }));

    const { error } = await supabaseAdmin
      .from("product_reviews")
      .upsert(rows, { onConflict: "order_id,product_id" });
    if (error) {
      console.error("Failed to save reviews", error);
      throw new Error("Could not submit your ratings. Please try again.");
    }
    return { ok: true, count: rows.length };
  });

// ---------------- Public product ratings (average + count) ----------------
export const getProductRatingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { productIds?: string[] }) => ({
    productIds: Array.isArray(data?.productIds)
      ? data.productIds.map((p) => str(p, 40)).filter(Boolean).slice(0, 100)
      : [],
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("product_reviews").select("product_id, rating");
    if (data.productIds.length > 0) query = query.in("product_id", data.productIds);
    const { data: rows, error } = await query;
    if (error) {
      console.error("Failed to load product ratings", error);
      return { ratings: [] as ProductRating[] };
    }
    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of rows ?? []) {
      const cur = agg.get(r.product_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.rating);
      cur.count += 1;
      agg.set(r.product_id, cur);
    }
    const ratings: ProductRating[] = [...agg.entries()].map(([productId, v]) => ({
      productId,
      average: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
      count: v.count,
    }));
    return { ratings };
  });

// ---------------- Public reviews for a single product ----------------
export const getProductReviewsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { productId?: string }) => ({ productId: str(data?.productId, 40) }))
  .handler(async ({ data }) => {
    if (!data.productId) return { reviews: [] as ReviewEntry[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_reviews")
      .select("id, order_id, product_id, product_name, customer_name, rating, feedback, created_at")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Failed to load product reviews", error);
      return { reviews: [] as ReviewEntry[] };
    }
    const reviews: ReviewEntry[] = (rows ?? []).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      productId: r.product_id,
      productName: r.product_name,
      customerName: r.customer_name,
      rating: Number(r.rating),
      feedback: r.feedback,
      createdAt: new Date(r.created_at).getTime(),
    }));
    return { reviews };
  });

// ---------------- Admin: all feedback ----------------
export const listReviewsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({
    adminToken: data?.adminToken ? String(data.adminToken) : "",
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_reviews")
      .select("id, order_id, product_id, product_name, customer_name, rating, feedback, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("Failed to load reviews for admin", error);
      throw new Error("Could not load feedback");
    }
    const reviews: ReviewEntry[] = (rows ?? []).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      productId: r.product_id,
      productName: r.product_name,
      customerName: r.customer_name,
      rating: Number(r.rating),
      feedback: r.feedback,
      createdAt: new Date(r.created_at).getTime(),
    }));
    return { reviews };
  });
