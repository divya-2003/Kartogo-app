import { EVENT_TYPES, cleanString } from "./recommendations.shared";

type SanitizedEvent = ReturnType<typeof import("./recommendations.shared").validateTrackInput>["events"][number];

async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function trackEvents(phone: string | null, sessionId: string, events: SanitizedEvent[]) {
  if (events.length === 0 || (!phone && !sessionId)) return { ok: true };
  const valid = new Set<string>(EVENT_TYPES);
  const rows = events.filter((event) => valid.has(event.eventType)).map((event) => ({
    phone,
    session_id: sessionId || null,
    event_type: event.eventType,
    product_id: event.productId || null,
    category: event.category || null,
    order_id: event.orderId || null,
    search_query: event.searchQuery || null,
    metadata: event.metadata,
  }));
  if (rows.length === 0) return { ok: true };
  const db = await database();
  const { error } = await db.from("customer_events").insert(rows as never);
  if (error && !String(error.message).includes("duplicate key")) console.error("trackCustomerEvents failed", error);
  return { ok: true };
}

export async function ingestOrder(phone: string, orderId: string, recommendationProductIds: string[]) {
  if (!phone || !orderId) return { ok: false };
  const db = await database();
  const { data: order, error: orderError } = await db.from("app_orders")
    .select("id, items, customer_phone, status").eq("id", orderId).maybeSingle();
  if (orderError) throw new Error("Order could not be loaded for recommendations");
  if (!order || order.customer_phone !== phone) return { ok: false };

  const items = Array.isArray(order.items) ? (order.items as { productId?: string }[]) : [];
  const productIds = items.map((item) => cleanString(item?.productId, 64)).filter(Boolean);
  const purchasedFromRecommendations = new Set(recommendationProductIds.filter((id) => productIds.includes(id)));
  const rows = [
    { phone, session_id: null, event_type: "ORDER_PLACED", product_id: null, category: null, order_id: order.id, search_query: null, metadata: {} },
    ...productIds.map((productId) => ({ phone, session_id: null, event_type: "PRODUCT_PURCHASED", product_id: productId, category: null, order_id: order.id, search_query: null, metadata: {} })),
    ...[...purchasedFromRecommendations].map((productId) => ({ phone, session_id: null, event_type: "RECOMMENDATION_PURCHASED", product_id: productId, category: null, order_id: order.id, search_query: null, metadata: {} })),
  ];
  const { error } = await db.from("customer_events").upsert(rows as never, { ignoreDuplicates: true } as never);
  if (error) throw new Error("Purchase signals could not be recorded");
  const { recomputeCustomer, ensureAssociations } = await import("./recommendations.server");
  await recomputeCustomer(phone);
  await ensureAssociations();
  return { ok: true };
}

export async function getAnalytics(days: number) {
  const db = await database();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: events, error: eventError } = await db.from("customer_events")
    .select("event_type, product_id, order_id, metadata, created_at").gte("created_at", since)
    .in("event_type", ["RECOMMENDATION_VIEWED", "RECOMMENDATION_CLICKED", "RECOMMENDATION_ADDED_TO_CART", "RECOMMENDATION_PURCHASED"]).limit(20000);
  if (eventError) throw new Error("Recommendation analytics could not be loaded");

  let impressions = 0, clicks = 0, addToCart = 0;
  const recProducts = new Map<string, number>();
  const purchasedByOrder = new Map<string, Set<string>>();
  for (const event of events ?? []) {
    const productId = String(event.product_id ?? "");
    if (event.event_type === "RECOMMENDATION_VIEWED") {
      impressions += 1;
      if (productId) recProducts.set(productId, (recProducts.get(productId) ?? 0) + 1);
    } else if (event.event_type === "RECOMMENDATION_CLICKED") clicks += 1;
    else if (event.event_type === "RECOMMENDATION_ADDED_TO_CART") addToCart += 1;
    else if (event.event_type === "RECOMMENDATION_PURCHASED" && event.order_id && productId) {
      const products = purchasedByOrder.get(event.order_id) ?? new Set<string>();
      products.add(productId);
      purchasedByOrder.set(event.order_id, products);
    }
  }

  const orderIds = [...purchasedByOrder.keys()];
  let recRevenue = 0;
  let recOrders = 0;
  if (orderIds.length > 0) {
    const { data: orders, error: orderError } = await db.from("app_orders")
      .select("id, items, status").in("id", orderIds).neq("status", "cancelled").limit(2000);
    if (orderError) throw new Error("Recommendation revenue could not be loaded");
    for (const order of orders ?? []) {
      const attributed = purchasedByOrder.get(order.id);
      if (!attributed) continue;
      const items = Array.isArray(order.items) ? (order.items as { productId?: string; qty?: number; price?: number }[]) : [];
      const value = items.reduce((sum, item) => attributed.has(String(item.productId ?? ""))
        ? sum + Number(item.price ?? 0) * Number(item.qty ?? 0) : sum, 0);
      if (value > 0) { recRevenue += value; recOrders += 1; }
    }
  }

  const [{ data: pairs, error: pairError }, { data: repl, error: replError }] = await Promise.all([
    db.from("product_associations").select("product_id, associated_product_id, co_purchase_count").order("co_purchase_count", { ascending: false }).limit(10),
    db.from("customer_replenishment_predictions").select("product_id, status").in("status", ["DUE", "OVERDUE"]).limit(500),
  ]);
  if (pairError || replError) throw new Error("Recommendation insights could not be loaded");
  const replCounts = new Map<string, number>();
  for (const row of repl ?? []) replCounts.set(String(row.product_id), (replCounts.get(String(row.product_id)) ?? 0) + 1);
  return {
    impressions, clicks, addToCart, recOrders, recRevenue: Number(recRevenue.toFixed(2)),
    clickRate: impressions > 0 ? clicks / impressions : 0,
    cartRate: impressions > 0 ? addToCart / impressions : 0,
    conversionRate: impressions > 0 ? recOrders / impressions : 0,
    avgRecOrderValue: recOrders > 0 ? Number((recRevenue / recOrders).toFixed(2)) : 0,
    topRecommended: [...recProducts].map(([productId, count]) => ({ productId, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    topPairs: (pairs ?? []).map((row) => ({ productId: String(row.product_id), associatedProductId: String(row.associated_product_id), count: Number(row.co_purchase_count) })),
    topReplenishment: [...replCounts].map(([productId, count]) => ({ productId, count })).sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

function bounded(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export async function saveSettings(settings: Record<string, number>) {
  const db = await database();
  const { error } = await db.from("recommendation_settings").upsert({
    id: 1,
    view_weight: bounded(settings["view_weight"], 0, 100, 1),
    search_weight: bounded(settings["search_weight"], 0, 100, 3),
    favorite_weight: bounded(settings["favorite_weight"], 0, 100, 4),
    cart_weight: bounded(settings["cart_weight"], 0, 100, 6),
    purchase_weight: bounded(settings["purchase_weight"], 0, 100, 10),
    repeat_purchase_bonus: bounded(settings["repeat_purchase_bonus"], 0, 100, 5),
    min_co_purchase_count: Math.round(bounded(settings["min_co_purchase_count"], 1, 50, 3)),
    recommendation_limit: Math.round(bounded(settings["recommendation_limit"], 1, 20, 8)),
    min_recommendation_score: bounded(settings["min_recommendation_score"], 0, 100, 1),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Recommendation settings could not be saved");
  return { ok: true };
}

export async function rebuildAll() {
  const { rebuildAssociations, recomputeCustomer } = await import("./recommendations.server");
  const pairs = await rebuildAssociations();
  const db = await database();
  const { data: rows, error } = await db.from("app_orders").select("customer_phone").order("created_at", { ascending: false }).limit(10000);
  if (error) throw new Error("Customer history could not be loaded");
  const phones = [...new Set((rows ?? []).map((row) => String(row.customer_phone)).filter(Boolean))];
  for (const phone of phones) await recomputeCustomer(phone);
  return { pairs, customers: phones.length };
}
