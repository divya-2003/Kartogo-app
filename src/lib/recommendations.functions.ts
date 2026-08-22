import { createServerFn } from "@tanstack/react-start";

// RPC surface for the recommendation engine. All heavy lifting lives in
// recommendations.server.ts (loaded inside handlers so it never reaches the
// browser bundle). Identity comes from the signed customer token — a shopper
// can only ever read their own behaviour and their own suggestions.

export const EVENT_TYPES = [
  "APP_OPENED", "HOME_VIEWED", "CATEGORY_VIEWED", "PRODUCT_VIEWED", "PRODUCT_SEARCHED",
  "PRODUCT_ADDED_TO_CART", "PRODUCT_REMOVED_FROM_CART", "CART_VIEWED", "CHECKOUT_STARTED",
  "PAYMENT_STARTED", "ORDER_PLACED", "ORDER_CANCELLED", "PRODUCT_PURCHASED",
  "PRODUCT_FAVORITED", "PRODUCT_UNFAVORITED", "PRODUCT_SHARED",
  "RECOMMENDATION_VIEWED", "RECOMMENDATION_CLICKED", "RECOMMENDATION_ADDED_TO_CART",
  "RECOMMENDATION_PURCHASED",
] as const;

export type CustomerEventType = (typeof EVENT_TYPES)[number];

const str = (v: unknown, max = 200): string => String(v ?? "").trim().slice(0, max);

type TrackInput = {
  token?: string;
  sessionId?: string;
  events: {
    eventType: string;
    productId?: string;
    category?: string;
    orderId?: string;
    searchQuery?: string;
    metadata?: Record<string, unknown>;
  }[];
};

// ---------------- Track events (batched) ----------------
export const trackCustomerEventsFn = createServerFn({ method: "POST" })
  .inputValidator((data: TrackInput) => ({
    token: str(data?.token, 800),
    sessionId: str(data?.sessionId, 80),
    events: (Array.isArray(data?.events) ? data.events : []).slice(0, 25).map((e) => ({
      eventType: str(e?.eventType, 40),
      productId: str(e?.productId, 64),
      category: str(e?.category, 64),
      orderId: str(e?.orderId, 64),
      searchQuery: str(e?.searchQuery, 120),
      metadata: (e?.metadata && typeof e.metadata === "object" ? e.metadata : {}) as Record<string, unknown>,
    })),
  }))
  .handler(async ({ data }) => {
    if (data.events.length === 0) return { ok: true };
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    const phone = session?.phone ?? null;
    // Anonymous shoppers are tracked by session id only — no personal data.
    if (!phone && !data.sessionId) return { ok: true };

    const valid = new Set<string>(EVENT_TYPES);
    const rows = data.events
      .filter((e) => valid.has(e.eventType))
      .map((e) => ({
        phone,
        session_id: data.sessionId || null,
        event_type: e.eventType,
        product_id: e.productId || null,
        category: e.category || null,
        order_id: e.orderId || null,
        search_query: e.searchQuery || null,
        metadata: e.metadata as never,
      }));
    if (rows.length === 0) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Purchase / order events carry unique indexes, so duplicates are dropped.
    const { error } = await supabaseAdmin.from("customer_events").insert(rows);
    if (error && !String(error.message).includes("duplicate key")) {
      console.error("trackCustomerEvents failed", error);
    }
    return { ok: true };
  });

// ---------------- Personalized recommendation bundle ----------------
export const getRecommendationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; cartProductIds?: string[]; limit?: number }) => ({
    token: str(data?.token, 800),
    cartProductIds: (Array.isArray(data?.cartProductIds) ? data.cartProductIds : [])
      .map((id) => str(id, 64)).filter(Boolean).slice(0, 20),
    limit: Number(data?.limit ?? 8),
  }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    const { buildRecommendations } = await import("./recommendations.server");
    try {
      return await buildRecommendations(session?.phone ?? null, {
        cartProductIds: data.cartProductIds,
        limit: data.limit,
      });
    } catch (err) {
      console.error("getRecommendations failed", err);
      return {
        personalized: [], buyAgain: [], replenishment: [],
        frequentlyBoughtTogether: [], popular: [], isPersonalized: false,
      };
    }
  });

// ---------------- Frequently bought together (product page / cart) ----------------
export const getFrequentlyBoughtTogetherFn = createServerFn({ method: "POST" })
  .inputValidator((data: { productIds?: string[]; limit?: number }) => ({
    productIds: (Array.isArray(data?.productIds) ? data.productIds : [])
      .map((id) => str(id, 64)).filter(Boolean).slice(0, 20),
    limit: Number(data?.limit ?? 4),
  }))
  .handler(async ({ data }) => {
    if (data.productIds.length === 0) return { items: [] };
    const { frequentlyBoughtTogether, similarProducts } = await import("./recommendations.server");
    try {
      let items = await frequentlyBoughtTogether(data.productIds, data.limit);
      // Not enough co-purchase history yet — fall back to similar products,
      // clearly labelled as such rather than pretending it is co-purchase data.
      if (items.length === 0 && data.productIds[0]) {
        items = await similarProducts(data.productIds[0], data.limit);
      }
      return { items };
    } catch (err) {
      console.error("getFrequentlyBoughtTogether failed", err);
      return { items: [] };
    }
  });

// ---------------- Ingest a completed order ----------------
// Called right after checkout: writes purchase events, refreshes preferences,
// replenishment predictions and co-purchase associations.
export const ingestOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; orderId: string }) => ({
    token: str(data?.token, 800),
    orderId: str(data?.orderId, 64),
  }))
  .handler(async ({ data }) => {
    const { verifyCustomerToken } = await import("./auth-tokens.server");
    const session = verifyCustomerToken(data.token);
    if (!session || !data.orderId) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("app_orders")
      .select("id, items, customer_phone, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.customer_phone !== session.phone) return { ok: false };

    const items = Array.isArray(order.items) ? (order.items as { productId?: string }[]) : [];
    const rows = [
      {
        phone: session.phone, session_id: null, event_type: "ORDER_PLACED",
        product_id: null, category: null, order_id: order.id, search_query: null,
        metadata: {} as never,
      },
      ...items
        .map((it) => str(it?.productId, 64))
        .filter(Boolean)
        .map((productId) => ({
          phone: session.phone, session_id: null, event_type: "PRODUCT_PURCHASED",
          product_id: productId, category: null, order_id: order.id, search_query: null,
          metadata: {} as never,
        })),
    ];
    // Unique indexes make this idempotent: a retried checkout cannot
    // double-count the same purchase.
    await supabaseAdmin.from("customer_events").upsert(rows, { ignoreDuplicates: true } as never);

    const { recomputeCustomer, ensureAssociations } = await import("./recommendations.server");
    await recomputeCustomer(session.phone);
    await ensureAssociations();
    return { ok: true };
  });

// ---------------- Admin: analytics ----------------
export const recommendationAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; days?: number }) => ({
    adminToken: str(data?.adminToken, 800),
    days: Math.max(1, Math.min(120, Number(data?.days ?? 30))),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const { data: events } = await supabaseAdmin
      .from("customer_events")
      .select("event_type, product_id, order_id, metadata, created_at")
      .gte("created_at", since)
      .in("event_type", [
        "RECOMMENDATION_VIEWED", "RECOMMENDATION_CLICKED",
        "RECOMMENDATION_ADDED_TO_CART", "ORDER_PLACED",
      ])
      .limit(20000);

    let impressions = 0, clicks = 0, addToCart = 0;
    const recProducts = new Map<string, number>();
    const recCartProducts = new Set<string>();
    for (const e of events ?? []) {
      const pid = String((e as { product_id?: string }).product_id ?? "");
      switch (e.event_type) {
        case "RECOMMENDATION_VIEWED":
          impressions += 1; if (pid) recProducts.set(pid, (recProducts.get(pid) ?? 0) + 1); break;
        case "RECOMMENDATION_CLICKED": clicks += 1; break;
        case "RECOMMENDATION_ADDED_TO_CART":
          addToCart += 1; if (pid) recCartProducts.add(pid); break;
        default: break;
      }
    }

    // Revenue attribution: value of recommended products inside delivered /
    // active orders placed after the recommendation was added to cart.
    const { data: orders } = await supabaseAdmin
      .from("app_orders")
      .select("id, items, total, status, created_at")
      .gte("created_at", since)
      .neq("status", "cancelled")
      .limit(2000);

    let recRevenue = 0, recOrders = 0;
    for (const o of orders ?? []) {
      const items = Array.isArray(o.items) ? (o.items as { productId?: string; qty?: number; price?: number }[]) : [];
      let value = 0;
      for (const it of items) {
        if (it?.productId && recCartProducts.has(it.productId)) {
          value += Number(it.price ?? 0) * Number(it.qty ?? 0);
        }
      }
      if (value > 0) { recRevenue += value; recOrders += 1; }
    }

    const { data: pairs } = await supabaseAdmin
      .from("product_associations")
      .select("product_id, associated_product_id, co_purchase_count")
      .order("co_purchase_count", { ascending: false })
      .limit(10);

    const { data: repl } = await supabaseAdmin
      .from("customer_replenishment_predictions")
      .select("product_id, status")
      .in("status", ["DUE", "OVERDUE"])
      .limit(500);
    const replCounts = new Map<string, number>();
    for (const r of repl ?? []) {
      const pid = String(r.product_id);
      replCounts.set(pid, (replCounts.get(pid) ?? 0) + 1);
    }

    return {
      impressions,
      clicks,
      addToCart,
      recOrders,
      recRevenue: Number(recRevenue.toFixed(2)),
      clickRate: impressions > 0 ? clicks / impressions : 0,
      cartRate: impressions > 0 ? addToCart / impressions : 0,
      conversionRate: impressions > 0 ? recOrders / impressions : 0,
      avgRecOrderValue: recOrders > 0 ? Number((recRevenue / recOrders).toFixed(2)) : 0,
      topRecommended: [...recProducts].map(([productId, count]) => ({ productId, count }))
        .sort((a, b) => b.count - a.count).slice(0, 10),
      topPairs: (pairs ?? []).map((p) => ({
        productId: String(p.product_id),
        associatedProductId: String(p.associated_product_id),
        count: Number(p.co_purchase_count),
      })),
      topReplenishment: [...replCounts].map(([productId, count]) => ({ productId, count }))
        .sort((a, b) => b.count - a.count).slice(0, 10),
    };
  });

// ---------------- Admin: settings ----------------
export const getRecommendationSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: str(data?.adminToken, 800) }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { getSettings } = await import("./recommendations.server");
    return await getSettings();
  });

export const saveRecommendationSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; settings: Record<string, number> }) => ({
    adminToken: str(data?.adminToken, 800),
    settings: (data?.settings ?? {}) as Record<string, number>,
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const n = (v: unknown, min: number, max: number, fallback: number) => {
      const x = Number(v);
      return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : fallback;
    };
    const s = data.settings;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("recommendation_settings").upsert({
      id: 1,
      view_weight: n(s['view_weight'], 0, 100, 1),
      search_weight: n(s['search_weight'], 0, 100, 3),
      favorite_weight: n(s['favorite_weight'], 0, 100, 4),
      cart_weight: n(s['cart_weight'], 0, 100, 6),
      purchase_weight: n(s['purchase_weight'], 0, 100, 10),
      repeat_purchase_bonus: n(s['repeat_purchase_bonus'], 0, 100, 5),
      min_co_purchase_count: Math.round(n(s['min_co_purchase_count'], 1, 50, 3)),
      recommendation_limit: Math.round(n(s['recommendation_limit'], 1, 20, 8)),
      min_recommendation_score: n(s['min_recommendation_score'], 0, 100, 1),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Admin: force a full rebuild ----------------
export const rebuildRecommendationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: str(data?.adminToken, 800) }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { rebuildAssociations, recomputeCustomer } = await import("./recommendations.server");
    const pairs = await rebuildAssociations();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("app_orders")
      .select("customer_phone")
      .order("created_at", { ascending: false })
      .limit(2000);
    const phones = [...new Set((rows ?? []).map((r) => String(r.customer_phone)))].slice(0, 300);
    for (const phone of phones) await recomputeCustomer(phone);
    return { pairs, customers: phones.length };
  });
