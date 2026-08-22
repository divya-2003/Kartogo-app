// Kartogo recommendation engine (rule-based + weighted scoring).
//
// Identity note: Kartogo customers are NOT Supabase auth users — they are
// identified by a verified phone number carried in a signed customer token
// (see auth-tokens.server.ts). Every table in this engine is therefore keyed by
// `phone` instead of `user_id`, matching the existing orders / wallet / wishlist
// tables. All access happens through the service-role client inside server
// functions, so a browser can never read another shopper's behaviour.

import { PRODUCT_CATEGORY, CATALOG } from "./server-catalog.server";

export type RecommendationType =
  | "REPLENISHMENT"
  | "BUY_AGAIN"
  | "PERSONALIZED"
  | "FREQUENTLY_BOUGHT_TOGETHER"
  | "SIMILAR_PRODUCT"
  | "POPULAR_NEARBY";

// Configurable priority — the first type wins when a product qualifies twice.
export const TYPE_PRIORITY: RecommendationType[] = [
  "REPLENISHMENT",
  "BUY_AGAIN",
  "PERSONALIZED",
  "FREQUENTLY_BOUGHT_TOGETHER",
  "SIMILAR_PRODUCT",
  "POPULAR_NEARBY",
];

export type Recommendation = {
  productId: string;
  type: RecommendationType;
  reason: string;
  score: number;
  sourceProductId?: string;
};

export type RecommendationSettings = {
  view_weight: number;
  search_weight: number;
  favorite_weight: number;
  cart_weight: number;
  purchase_weight: number;
  repeat_purchase_bonus: number;
  min_co_purchase_count: number;
  recommendation_limit: number;
  min_recommendation_score: number;
};

const DEFAULT_SETTINGS: RecommendationSettings = {
  view_weight: 1,
  search_weight: 3,
  favorite_weight: 4,
  cart_weight: 6,
  purchase_weight: 10,
  repeat_purchase_bonus: 5,
  min_co_purchase_count: 3,
  recommendation_limit: 8,
  min_recommendation_score: 1,
};

const DAY = 86_400_000;

/** Recency decay: recent behaviour counts far more than old behaviour. */
export function decay(at: string | number | Date | null | undefined): number {
  if (!at) return 0.2;
  const days = (Date.now() - new Date(at).getTime()) / DAY;
  if (!Number.isFinite(days) || days < 0) return 1;
  if (days <= 7) return 1;
  if (days <= 30) return 0.7;
  if (days <= 90) return 0.4;
  return 0.2;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getSettings(): Promise<RecommendationSettings> {
  try {
    const db = await admin();
    const { data } = await db.from("recommendation_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(data as Partial<RecommendationSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ---------------- Catalog (availability + category) ----------------
export type CatalogInfo = { name: string; category: string; stock: number; available: boolean };

export async function loadCatalog(): Promise<Map<string, CatalogInfo>> {
  const map = new Map<string, CatalogInfo>();
  // Bundled seed products: assume available; the client filters on live stock.
  for (const [id, entry] of Object.entries(CATALOG)) {
    map.set(id, { name: entry.name, category: PRODUCT_CATEGORY[id] ?? "", stock: 1, available: true });
  }
  try {
    const db = await admin();
    const { data } = await db.from("catalog_items").select("id, name, category, stock, is_deleted");
    for (const row of data ?? []) {
      const deleted = Boolean((row as { is_deleted?: boolean }).is_deleted);
      const stock = Number((row as { stock?: number }).stock ?? 0);
      if (deleted) { map.delete(row.id as string); continue; }
      map.set(row.id as string, {
        name: String(row.name ?? ""),
        category: String(row.category ?? ""),
        stock,
        available: stock > 0,
      });
    }
  } catch { /* seed-only fallback */ }
  return map;
}

// ---------------- Order history ----------------
type OrderRow = { id: string; items: unknown; status: string; refunded: boolean | null; created_at: string };

type PurchaseLine = { productId: string; qty: number; at: number; weight: number };

function parseItems(items: unknown): { productId: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  const out: { productId: string; qty: number }[] = [];
  for (const raw of items) {
    const it = raw as { productId?: unknown; qty?: unknown };
    const id = String(it?.productId ?? "").trim();
    const qty = Number(it?.qty ?? 0);
    if (id && qty > 0) out.push({ productId: id, qty });
  }
  return out;
}

/** Cancelled orders are ignored entirely; refunded orders keep only a weak signal. */
function purchaseWeight(o: OrderRow): number {
  if (o.status === "cancelled") return 0;
  if (o.refunded) return 0.3;
  return 1;
}

async function loadCustomerOrders(phone: string): Promise<OrderRow[]> {
  const db = await admin();
  const { data } = await db
    .from("app_orders")
    .select("id, items, status, refunded, created_at")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []) as OrderRow[];
}

// ---------------- Preference recomputation ----------------
type PrefAccum = {
  view: number; search: number; cart: number; favorite: number; purchase: number;
  lastViewed?: string; lastSearched?: string; lastCart?: string; lastPurchased?: string;
  score: number;
  purchaseDates: number[];
};

const emptyAccum = (): PrefAccum => ({
  view: 0, search: 0, cart: 0, favorite: 0, purchase: 0, score: 0, purchaseDates: [],
});

function stats(intervals: number[]) {
  const n = intervals.length;
  if (n === 0) return { mean: 0, cv: 1 };
  const mean = intervals.reduce((a, b) => a + b, 0) / n;
  if (mean <= 0) return { mean: 0, cv: 1 };
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, cv: Math.sqrt(variance) / mean };
}

/**
 * Rebuilds this customer's product/category preferences and replenishment
 * predictions from REAL order history + tracked events. Cheap enough to run on
 * demand, and throttled by `updated_at` at the call site.
 */
export async function recomputeCustomer(phone: string): Promise<void> {
  if (!phone) return;
  const db = await admin();
  const settings = await getSettings();
  const catalog = await loadCatalog();

  const orders = await loadCustomerOrders(phone);
  const lines: PurchaseLine[] = [];
  for (const o of orders) {
    const w = purchaseWeight(o);
    if (w <= 0) continue;
    const at = new Date(o.created_at).getTime();
    for (const it of parseItems(o.items)) lines.push({ ...it, at, weight: w });
  }

  const { data: eventRows } = await db
    .from("customer_events")
    .select("event_type, product_id, category, created_at")
    .eq("phone", phone)
    .gte("created_at", new Date(Date.now() - 180 * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(3000);

  const byProduct = new Map<string, PrefAccum>();
  const get = (id: string) => {
    let a = byProduct.get(id);
    if (!a) { a = emptyAccum(); byProduct.set(id, a); }
    return a;
  };

  for (const e of eventRows ?? []) {
    const pid = String((e as { product_id?: string }).product_id ?? "");
    if (!pid) continue;
    const at = String((e as { created_at: string }).created_at);
    const d = decay(at);
    const a = get(pid);
    switch ((e as { event_type: string }).event_type) {
      case "PRODUCT_VIEWED":
        a.view += 1; a.score += settings.view_weight * d; a.lastViewed ||= at; break;
      case "PRODUCT_SEARCHED":
        a.search += 1; a.score += settings.search_weight * d; a.lastSearched ||= at; break;
      case "PRODUCT_FAVORITED":
        a.favorite += 1; a.score += settings.favorite_weight * d; break;
      case "PRODUCT_UNFAVORITED":
        a.favorite = Math.max(0, a.favorite - 1); break;
      case "PRODUCT_ADDED_TO_CART":
        a.cart += 1; a.score += settings.cart_weight * d; a.lastCart ||= at; break;
      default: break;
    }
  }

  for (const l of lines) {
    const a = get(l.productId);
    a.purchase += 1;
    a.purchaseDates.push(l.at);
    a.score += settings.purchase_weight * decay(l.at) * l.weight;
    const iso = new Date(l.at).toISOString();
    if (!a.lastPurchased || iso > a.lastPurchased) a.lastPurchased = iso;
  }

  const prefRows: {
    phone: string; product_id: string; interest_score: number; view_count: number;
    search_count: number; cart_count: number; purchase_count: number; favorite_count: number;
    last_viewed_at: string | null; last_searched_at: string | null;
    last_added_to_cart_at: string | null; last_purchased_at: string | null;
    average_purchase_interval_days: number | null; updated_at: string;
  }[] = [];
  const predictionRows: {
    phone: string; product_id: string; last_purchase_at: string;
    average_purchase_interval_days: number; predicted_next_purchase_at: string;
    days_until_predicted_purchase: number; confidence_score: number;
    status: string; updated_at: string;
  }[] = [];
  const nowIso = new Date().toISOString();

  for (const [productId, a] of byProduct) {
    if (a.purchase > 1) a.score += settings.repeat_purchase_bonus;
    const dates = [...a.purchaseDates].sort((x, y) => x - y);
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / DAY);
    const { mean, cv } = stats(intervals);
    const avgInterval = intervals.length > 0 && mean > 0 ? Number(mean.toFixed(2)) : null;

    prefRows.push({
      phone,
      product_id: productId,
      interest_score: Number(a.score.toFixed(3)),
      view_count: a.view,
      search_count: a.search,
      cart_count: a.cart,
      purchase_count: a.purchase,
      favorite_count: a.favorite,
      last_viewed_at: a.lastViewed ?? null,
      last_searched_at: a.lastSearched ?? null,
      last_added_to_cart_at: a.lastCart ?? null,
      last_purchased_at: a.lastPurchased ?? null,
      average_purchase_interval_days: avgInterval,
      updated_at: nowIso,
    });

    // Replenishment prediction needs at least two real purchases.
    if (a.purchase >= 2 && avgInterval && a.lastPurchased) {
      const last = new Date(a.lastPurchased).getTime();
      const predicted = last + avgInterval * DAY;
      const daysUntil = (predicted - Date.now()) / DAY;
      const ageDays = (Date.now() - last) / DAY;
      // Confidence grows with purchase count and consistency, falls with age.
      let confidence = 0.3 + Math.min(0.3, (a.purchase - 2) * 0.1) + Math.max(0, 0.3 * (1 - cv));
      if (ageDays > avgInterval * 3) confidence *= 0.5;
      confidence = Math.max(0.05, Math.min(0.95, confidence));

      let status: string;
      if (ageDays > avgInterval * 4 + 30) status = "INACTIVE";
      else if (daysUntil > 3) status = "UPCOMING";
      else if (daysUntil >= -3) status = "DUE";
      else status = "OVERDUE";

      predictionRows.push({
        phone,
        product_id: productId,
        last_purchase_at: a.lastPurchased,
        average_purchase_interval_days: avgInterval,
        predicted_next_purchase_at: new Date(predicted).toISOString(),
        days_until_predicted_purchase: Number(daysUntil.toFixed(2)),
        confidence_score: Number(confidence.toFixed(3)),
        status,
        updated_at: nowIso,
      });
    }
  }

  if (prefRows.length > 0) {
    await db.from("customer_product_preferences").upsert(prefRows, { onConflict: "phone,product_id" });
  }
  if (predictionRows.length > 0) {
    await db.from("customer_replenishment_predictions").upsert(predictionRows, { onConflict: "phone,product_id" });
  }

  // Category preferences roll up from the same signals.
  const byCategory = new Map<string, { score: number; views: number; purchases: number; last?: string }>();
  for (const [productId, a] of byProduct) {
    const cat = catalog.get(productId)?.category;
    if (!cat) continue;
    const c = byCategory.get(cat) ?? { score: 0, views: 0, purchases: 0 };
    c.score += a.score;
    c.views += a.view;
    c.purchases += a.purchase;
    const last = a.lastPurchased ?? a.lastViewed ?? a.lastCart;
    if (last && (!c.last || last > c.last)) c.last = last;
    byCategory.set(cat, c);
  }
  const catRows = [...byCategory].map(([category, c]) => ({
    phone,
    category,
    interest_score: Number(c.score.toFixed(3)),
    view_count: c.views,
    purchase_count: c.purchases,
    last_activity_at: c.last ?? null,
    updated_at: nowIso,
  }));
  if (catRows.length > 0) {
    await db.from("customer_category_preferences").upsert(catRows, { onConflict: "phone,category" });
  }
}

/** Recompute only when the stored preferences are older than `maxAgeMs`. */
export async function ensureFreshCustomer(phone: string, maxAgeMs = 10 * 60_000): Promise<void> {
  if (!phone) return;
  try {
    const db = await admin();
    const { data } = await db
      .from("customer_product_preferences")
      .select("updated_at")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stale = !data || Date.now() - new Date(data.updated_at as string).getTime() > maxAgeMs;
    if (stale) await recomputeCustomer(phone);
  } catch (err) {
    console.error("recommendations: recompute failed", err);
  }
}

// ---------------- Product associations ----------------
export async function rebuildAssociations(maxOrders = 1500): Promise<number> {
  const db = await admin();
  const { data } = await db
    .from("app_orders")
    .select("id, items, status, refunded, created_at")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(maxOrders);

  const pairs = new Map<string, number>();
  const singles = new Map<string, number>();
  for (const o of (data ?? []) as OrderRow[]) {
    if (purchaseWeight(o) <= 0) continue;
    const ids = [...new Set(parseItems(o.items).map((i) => i.productId))];
    for (const id of ids) singles.set(id, (singles.get(id) ?? 0) + 1);
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const key = `${ids[i]}|${ids[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  const rows = [...pairs].map(([key, count]) => {
    const [productId, associated] = key.split("|");
    const base = singles.get(productId) ?? 1;
    const other = singles.get(associated) ?? 1;
    // Lift-like score: co-purchase confidence dampened by the partner's overall
    // popularity, so a globally popular item does not swamp every list.
    const confidence = count / base;
    const score = confidence * (1 / Math.sqrt(other));
    return {
      product_id: productId,
      associated_product_id: associated,
      co_purchase_count: count,
      association_score: Number((score * 100).toFixed(3)),
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      await db
        .from("product_associations")
        .upsert(rows.slice(i, i + 500), { onConflict: "product_id,associated_product_id" });
    }
  }
  return rows.length;
}

async function associationsStale(): Promise<boolean> {
  try {
    const db = await admin();
    const { data } = await db
      .from("product_associations")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return !data || Date.now() - new Date(data.updated_at as string).getTime() > 6 * 3600_000;
  } catch {
    return false;
  }
}

export async function ensureAssociations(): Promise<void> {
  try {
    if (await associationsStale()) await rebuildAssociations();
  } catch (err) {
    console.error("recommendations: association rebuild failed", err);
  }
}

// ---------------- Popularity (new customers / fallback) ----------------
export async function popularProducts(limit = 20): Promise<{ productId: string; count: number }[]> {
  const db = await admin();
  const { data } = await db
    .from("app_orders")
    .select("items, status, refunded, created_at")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(400);
  const counts = new Map<string, number>();
  for (const o of (data ?? []) as OrderRow[]) {
    if (purchaseWeight(o) <= 0) continue;
    for (const it of parseItems(o.items)) counts.set(it.productId, (counts.get(it.productId) ?? 0) + it.qty);
  }
  return [...counts]
    .map(([productId, count]) => ({ productId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------------- Frequently bought together ----------------
export async function frequentlyBoughtTogether(
  productIds: string[],
  limit = 6,
): Promise<Recommendation[]> {
  if (productIds.length === 0) return [];
  const settings = await getSettings();
  await ensureAssociations();
  const db = await admin();
  const catalog = await loadCatalog();
  const { data } = await db
    .from("product_associations")
    .select("product_id, associated_product_id, co_purchase_count, association_score")
    .in("product_id", productIds.slice(0, 20))
    .gte("co_purchase_count", settings.min_co_purchase_count)
    .order("association_score", { ascending: false })
    .limit(100);

  const seed = new Set(productIds);
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const pid = String(row.associated_product_id);
    if (seed.has(pid) || seen.has(pid)) continue;
    const info = catalog.get(pid);
    if (!info || !info.available) continue;
    seen.add(pid);
    const sourceName = catalog.get(String(row.product_id))?.name ?? "your cart";
    out.push({
      productId: pid,
      type: "FREQUENTLY_BOUGHT_TOGETHER",
      reason: `Frequently bought with ${sourceName}`,
      score: Number(row.association_score),
      sourceProductId: String(row.product_id),
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------- Similar products ----------------
export async function similarProducts(productId: string, limit = 6): Promise<Recommendation[]> {
  const catalog = await loadCatalog();
  const base = catalog.get(productId);
  if (!base) return [];
  const popular = new Map((await popularProducts(60)).map((p) => [p.productId, p.count]));
  return [...catalog]
    .filter(([id, info]) => id !== productId && info.available && info.category === base.category)
    .sort((a, b) => (popular.get(b[0]) ?? 0) - (popular.get(a[0]) ?? 0))
    .slice(0, limit)
    .map(([id]) => ({
      productId: id,
      type: "SIMILAR_PRODUCT" as const,
      reason: `Similar to ${base.name}`,
      score: 10,
      sourceProductId: productId,
    }));
}

// ---------------- The main engine ----------------
export type RecommendationBundle = {
  personalized: Recommendation[];
  buyAgain: Recommendation[];
  replenishment: Recommendation[];
  frequentlyBoughtTogether: Recommendation[];
  popular: Recommendation[];
  isPersonalized: boolean;
};

export async function buildRecommendations(
  phone: string | null,
  opts: { cartProductIds?: string[]; limit?: number } = {},
): Promise<RecommendationBundle> {
  const settings = await getSettings();
  const limit = Math.max(1, Math.min(20, opts.limit ?? settings.recommendation_limit));
  const catalog = await loadCatalog();
  const available = (id: string) => {
    const info = catalog.get(id);
    return Boolean(info && info.available);
  };

  const empty: RecommendationBundle = {
    personalized: [], buyAgain: [], replenishment: [],
    frequentlyBoughtTogether: [], popular: [], isPersonalized: false,
  };

  const cartIds = (opts.cartProductIds ?? []).filter(Boolean).slice(0, 20);
  const fbt = cartIds.length > 0 ? await frequentlyBoughtTogether(cartIds, limit) : [];

  // Popular products are the honest fallback for shoppers with no history.
  const popularList = await popularProducts(40);
  const popular: Recommendation[] = popularList
    .filter((p) => available(p.productId))
    .slice(0, limit)
    .map((p) => ({
      productId: p.productId,
      type: "POPULAR_NEARBY" as const,
      reason: "Popular in your area",
      score: p.count,
    }));

  if (!phone) return { ...empty, frequentlyBoughtTogether: fbt, popular };

  await ensureFreshCustomer(phone);
  const db = await admin();
  const [{ data: prefs }, { data: preds }, { data: cats }] = await Promise.all([
    db.from("customer_product_preferences").select("*").eq("phone", phone)
      .order("interest_score", { ascending: false }).limit(120),
    db.from("customer_replenishment_predictions").select("*").eq("phone", phone).limit(120),
    db.from("customer_category_preferences").select("*").eq("phone", phone)
      .order("interest_score", { ascending: false }).limit(20),
  ]);

  const prefRows = (prefs ?? []) as {
    product_id: string; interest_score: number; purchase_count: number; last_purchased_at: string | null;
  }[];
  const purchasedIds = new Set(prefRows.filter((p) => p.purchase_count > 0).map((p) => p.product_id));

  // 1. Replenishment — "you may be running low".
  const replenishment: Recommendation[] = ((preds ?? []) as {
    product_id: string; status: string; confidence_score: number; average_purchase_interval_days: number | null;
  }[])
    .filter((p) => (p.status === "DUE" || p.status === "OVERDUE") && Number(p.confidence_score) >= 0.3)
    .filter((p) => available(p.product_id))
    .sort((a, b) => Number(b.confidence_score) - Number(a.confidence_score))
    .slice(0, limit)
    .map((p) => ({
      productId: p.product_id,
      type: "REPLENISHMENT" as const,
      reason: p.average_purchase_interval_days
        ? `You usually buy this every ${Math.round(Number(p.average_purchase_interval_days))} days — you may be running low`
        : "You may need this again soon",
      score: 100 + Number(p.confidence_score) * 20,
    }));

  // 2. Buy again — previously purchased and still available.
  const buyAgain: Recommendation[] = prefRows
    .filter((p) => p.purchase_count > 0 && available(p.product_id))
    .sort((a, b) =>
      (b.purchase_count - a.purchase_count) ||
      (Number(b.interest_score) - Number(a.interest_score)))
    .slice(0, limit)
    .map((p) => ({
      productId: p.product_id,
      type: "BUY_AGAIN" as const,
      reason: "You bought this before",
      score: 60 + Number(p.interest_score) + p.purchase_count * 2,
    }));

  // 3. Personalized — strong browse signal, plus products from favourite
  //    categories the shopper has not bought yet.
  const personalized: Recommendation[] = [];
  for (const p of prefRows) {
    if (p.purchase_count > 0) continue;
    if (!available(p.product_id)) continue;
    if (Number(p.interest_score) < settings.min_recommendation_score) continue;
    personalized.push({
      productId: p.product_id,
      type: "PERSONALIZED",
      reason: "Based on your shopping history",
      score: 30 + Number(p.interest_score),
    });
  }
  const topCats = ((cats ?? []) as { category: string; interest_score: number }[]).slice(0, 3);
  const known = new Set(prefRows.map((p) => p.product_id));
  const popularityIndex = new Map(popularList.map((p) => [p.productId, p.count]));
  for (const c of topCats) {
    const inCategory = [...catalog]
      .filter(([id, info]) => info.category === c.category && info.available && !known.has(id))
      .sort((a, b) => (popularityIndex.get(b[0]) ?? 0) - (popularityIndex.get(a[0]) ?? 0))
      .slice(0, 4);
    for (const [id] of inCategory) {
      personalized.push({
        productId: id,
        type: "PERSONALIZED",
        reason: "Picked from the categories you shop most",
        score: 20 + Number(c.interest_score) / 10,
      });
    }
  }
  personalized.sort((a, b) => b.score - a.score);

  // Similar-product fallback when a regularly bought item is out of stock.
  const unavailableRegulars = prefRows
    .filter((p) => p.purchase_count >= 2 && !available(p.product_id))
    .slice(0, 3);
  for (const p of unavailableRegulars) {
    const alts = await similarProducts(p.product_id, 2);
    for (const alt of alts) {
      if (purchasedIds.has(alt.productId)) continue;
      personalized.push({ ...alt, reason: "Similar available product", score: 25 });
    }
  }

  // 4. Frequently bought together — seeded by the cart, else by top purchases.
  const fbtSeed = cartIds.length > 0
    ? cartIds
    : prefRows.filter((p) => p.purchase_count > 0).slice(0, 5).map((p) => p.product_id);
  const together = fbt.length > 0 ? fbt : await frequentlyBoughtTogether(fbtSeed, limit);

  // 5. Deduplicate across sections by configured priority.
  const bundle: RecommendationBundle = {
    replenishment, buyAgain, personalized,
    frequentlyBoughtTogether: together,
    popular,
    isPersonalized: prefRows.length > 0,
  };
  const claimed = new Set<string>();
  const buckets: Record<RecommendationType, Recommendation[]> = {
    REPLENISHMENT: bundle.replenishment,
    BUY_AGAIN: bundle.buyAgain,
    PERSONALIZED: bundle.personalized,
    FREQUENTLY_BOUGHT_TOGETHER: bundle.frequentlyBoughtTogether,
    SIMILAR_PRODUCT: [],
    POPULAR_NEARBY: bundle.popular,
  };
  for (const type of TYPE_PRIORITY) {
    const kept: Recommendation[] = [];
    for (const rec of buckets[type]) {
      if (claimed.has(rec.productId)) continue;
      claimed.add(rec.productId);
      kept.push(rec);
      if (kept.length >= limit) break;
    }
    buckets[type] = kept;
  }

  return {
    replenishment: buckets.REPLENISHMENT,
    buyAgain: buckets.BUY_AGAIN,
    personalized: buckets.PERSONALIZED,
    frequentlyBoughtTogether: buckets.FREQUENTLY_BOUGHT_TOGETHER,
    // Only surface generic popularity when the shopper has little history.
    popular: bundle.isPersonalized ? [] : buckets.POPULAR_NEARBY,
    isPersonalized: bundle.isPersonalized,
  };
}
