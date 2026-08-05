// ============================================================================
// AI Operations Assistant — analytics engine (server only)
//
// Reads business data (orders, inventory, purchase orders, markets) and turns
// it into forecasts, recommendations, anomalies and health scores.
//
// HARD RULE: this engine NEVER mutates inventory or creates purchase orders.
// It only analyses, predicts, recommends and records insights/notifications.
// ============================================================================

export type OrderLine = { productId: string; name: string; qty: number; price: number };

export type Severity = "critical" | "medium" | "low";

export type ProductForecast = {
  productId: string;
  name: string;
  category: string;
  availableStock: number;
  currentStock: number;
  reservedStock: number;
  reorderLevel: number;
  maxStock: number;
  pendingOrderUnits: number;
  soldLast7: number;
  soldLast30: number;
  dailyAverage: number;
  nextDay: number;
  nextWeek: number;
  nextMonth: number;
  trendPercent: number;
  weekdayFactor: number;
  daysToStockout: number | null;
  stockoutDate: string | null;
  recommendedQuantity: number;
  confidence: number;
  severity: Severity | null;
  reasoning: string;
  history: { date: string; units: number }[];
  projection: { date: string; units: number }[];
  cancelledUnits: number;
};

export type Anomaly = {
  kind: string;
  severity: Severity;
  productId: string | null;
  productName: string | null;
  title: string;
  body: string;
};

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round = (n: number, p = 2) => +n.toFixed(p);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Indian festival windows that historically lift grocery demand. MM-DD ranges. */
const FESTIVAL_WINDOWS: { name: string; from: string; to: string; lift: number }[] = [
  { name: "Sankranti", from: "01-12", to: "01-16", lift: 1.25 },
  { name: "Ugadi", from: "03-28", to: "04-02", lift: 1.15 },
  { name: "Ramzan / Eid", from: "04-05", to: "04-12", lift: 1.2 },
  { name: "Vinayaka Chavithi", from: "08-25", to: "09-02", lift: 1.2 },
  { name: "Dasara", from: "10-01", to: "10-14", lift: 1.3 },
  { name: "Diwali", from: "10-28", to: "11-08", lift: 1.35 },
  { name: "Christmas & New Year", from: "12-22", to: "01-02", lift: 1.2 },
];

export function festivalFactor(date: Date): { factor: number; name: string | null } {
  const md = iso(date).slice(5);
  for (const f of FESTIVAL_WINDOWS) {
    const wraps = f.from > f.to;
    const inside = wraps ? md >= f.from || md <= f.to : md >= f.from && md <= f.to;
    if (inside) return { factor: f.lift, name: f.name };
  }
  return { factor: 1, name: null };
}

// --------------------------------------------------------------- data access
type Snapshot = {
  orders: { id: string; items: OrderLine[]; status: string; total: number; created_at: string }[];
  inventory: {
    id: string; market_id: string; product_id: string; product_name: string;
    current_stock: number; reserved_stock: number; available_stock: number;
    reorder_level: number; max_stock: number; selling_price: number; updated_at: string;
  }[];
  markets: { id: string; name: string; is_active: boolean }[];
  purchaseOrders: { id: string; status: string; created_at: string; approved_at: string | null; market_id: string | null }[];
  categories: Record<string, string>;
};

export async function loadSnapshot(days = 90): Promise<Snapshot> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const [orders, inventory, markets, pos, catalog] = await Promise.all([
    supabaseAdmin.from("app_orders").select("id, items, status, total, created_at").gte("created_at", since),
    supabaseAdmin.from("inventory_items").select("*"),
    supabaseAdmin.from("partner_markets").select("id, name, is_active"),
    supabaseAdmin.from("purchase_orders").select("id, status, created_at, approved_at, market_id"),
    supabaseAdmin.from("catalog_items").select("id, category"),
  ]);

  const { PRODUCTS } = await import("./data");
  const categories: Record<string, string> = {};
  for (const p of PRODUCTS) categories[p.id] = p.category;
  for (const c of catalog.data ?? []) categories[c.id as string] = c.category as string;

  return {
    orders: (orders.data ?? []) as Snapshot["orders"],
    inventory: (inventory.data ?? []) as Snapshot["inventory"],
    markets: (markets.data ?? []) as Snapshot["markets"],
    purchaseOrders: (pos.data ?? []) as Snapshot["purchaseOrders"],
    categories,
  };
}

// ------------------------------------------------------------- MODULE 1 & 3
/** Forecast demand per product using moving average + exponential smoothing,
 *  corrected for day-of-week seasonality and festival periods. */
export function buildForecasts(snap: Snapshot, historyDays = 60): ProductForecast[] {
  const dayKeys: string[] = [];
  for (let i = historyDays - 1; i >= 0; i--) dayKeys.push(iso(new Date(Date.now() - i * DAY_MS)));

  const series = new Map<string, Map<string, number>>();
  const names = new Map<string, string>();
  const cancelled = new Map<string, number>();
  const pending = new Map<string, number>();
  const weekdayTotals = new Array(7).fill(0) as number[];
  const weekdayDays = new Array(7).fill(0) as number[];

  for (const o of snap.orders) {
    const day = String(o.created_at).slice(0, 10);
    const isCancelled = o.status === "cancelled";
    const isPending = ["placed", "packed", "out_for_delivery"].includes(o.status);
    for (const li of o.items ?? []) {
      const pid = li.productId;
      if (!pid) continue;
      names.set(pid, li.name ?? pid);
      const qty = Number(li.qty || 0);
      if (isCancelled) { cancelled.set(pid, (cancelled.get(pid) ?? 0) + qty); continue; }
      if (isPending) pending.set(pid, (pending.get(pid) ?? 0) + qty);
      const s = series.get(pid) ?? new Map<string, number>();
      s.set(day, (s.get(day) ?? 0) + qty);
      series.set(pid, s);
    }
  }

  // Global day-of-week seasonality (per-product data is usually too sparse).
  for (const key of dayKeys) {
    const wd = new Date(key + "T00:00:00Z").getUTCDay();
    let total = 0;
    for (const s of series.values()) total += s.get(key) ?? 0;
    weekdayTotals[wd] += total;
    weekdayDays[wd] += 1;
  }
  const weekdayAvg = weekdayTotals.map((t, i) => (weekdayDays[i] ? t / weekdayDays[i] : 0));
  const overallAvg = weekdayAvg.reduce((a, b) => a + b, 0) / 7 || 1;
  const weekdayFactorFor = (wd: number) => clamp((weekdayAvg[wd] || overallAvg) / overallAvg, 0.6, 1.6);

  const stock = new Map<string, { current: number; reserved: number; available: number; reorder: number; max: number }>();
  for (const it of snap.inventory) {
    const k = it.product_id;
    const cur = stock.get(k) ?? { current: 0, reserved: 0, available: 0, reorder: 0, max: 0 };
    cur.current += Number(it.current_stock);
    cur.reserved += Number(it.reserved_stock);
    cur.available += Number(it.available_stock);
    cur.reorder += Number(it.reorder_level);
    cur.max += Number(it.max_stock);
    stock.set(k, cur);
    names.set(k, it.product_name);
  }

  const ALPHA = 0.35;
  const ids = [...new Set([...series.keys(), ...stock.keys()])];

  return ids.map((pid) => {
    const s = series.get(pid) ?? new Map<string, number>();
    const values = dayKeys.map((d) => s.get(d) ?? 0);
    const last7 = values.slice(-7);
    const prev7 = values.slice(-14, -7);
    const last30 = values.slice(-30);

    const ma7 = last7.reduce((a, b) => a + b, 0) / (last7.length || 1);
    const ma30 = last30.reduce((a, b) => a + b, 0) / (last30.length || 1);
    let smoothed = values[0] ?? 0;
    for (const v of values.slice(1)) smoothed = ALPHA * v + (1 - ALPHA) * smoothed;

    const base = 0.45 * ma7 + 0.25 * ma30 + 0.3 * smoothed;
    const tomorrow = new Date(Date.now() + DAY_MS);
    const wdFactor = weekdayFactorFor(tomorrow.getUTCDay());
    const fest = festivalFactor(tomorrow);
    const nextDay = round(base * wdFactor * fest.factor, 2);

    let weekTotal = 0;
    const projection: { date: string; units: number }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.now() + i * DAY_MS);
      const units = round(base * weekdayFactorFor(d.getUTCDay()) * festivalFactor(d).factor, 2);
      if (i <= 7) weekTotal += units;
      projection.push({ date: iso(d), units });
    }
    const nextWeek = round(weekTotal, 1);
    const nextMonth = round(base * 30 * (fest.factor > 1 ? 1.1 : 1), 1);

    const prevSum = prev7.reduce((a, b) => a + b, 0);
    const lastSum = last7.reduce((a, b) => a + b, 0);
    const trendPercent = prevSum > 0 ? round(((lastSum - prevSum) / prevSum) * 100, 0) : lastSum > 0 ? 100 : 0;

    const st = stock.get(pid) ?? { current: 0, reserved: 0, available: 0, reorder: 0, max: 0 };
    const daysToStockout = nextDay > 0 ? round(st.available / nextDay, 1) : null;
    const stockoutDate = daysToStockout !== null && daysToStockout < 60
      ? iso(new Date(Date.now() + daysToStockout * DAY_MS)) : null;

    // Confidence: more history + steadier demand => higher confidence.
    const activeDays = values.filter((v) => v > 0).length;
    const mean = ma30 || 0.0001;
    const variance = last30.reduce((a, v) => a + (v - mean) ** 2, 0) / (last30.length || 1);
    const cv = Math.sqrt(variance) / mean;
    const density = clamp(activeDays / 21, 0, 1);
    const confidence = Math.round(clamp(0.35 + 0.5 * density - 0.18 * clamp(cv, 0, 2), 0.3, 0.95) * 100);

    const cover = Math.max(nextWeek * 1.2, st.reorder);
    const recommendedQuantity = Math.max(0, Math.ceil(Math.min(cover, st.max || cover) - st.available));

    let severity: Severity | null = null;
    if (daysToStockout !== null) {
      if (daysToStockout <= 1) severity = "critical";
      else if (daysToStockout <= 3) severity = "medium";
      else if (daysToStockout <= 7) severity = "low";
    }
    if (severity === null && st.available <= 0 && lastSum > 0) severity = "critical";

    const bits = [
      `Sold ${lastSum} units in the last 7 days (${last30.reduce((a, b) => a + b, 0)} in 30 days).`,
      `Average demand ${round(base, 2)} units/day${wdFactor !== 1 ? `, ${wdFactor > 1 ? "higher" : "lower"} than usual tomorrow (day-of-week)` : ""}.`,
      fest.name ? `${fest.name} period lifts demand ~${Math.round((fest.factor - 1) * 100)}%.` : "",
      `${st.available} units available now (${st.reserved} reserved).`,
      daysToStockout !== null ? `At this rate stock lasts about ${daysToStockout} day(s).` : "No recent sales, so no stock-out predicted.",
      trendPercent !== 0 ? `Demand ${trendPercent > 0 ? "up" : "down"} ${Math.abs(trendPercent)}% versus the previous week.` : "",
    ].filter(Boolean);

    return {
      productId: pid,
      name: names.get(pid) ?? pid,
      category: snap.categories[pid] ?? "",
      availableStock: st.available,
      currentStock: st.current,
      reservedStock: st.reserved,
      reorderLevel: st.reorder,
      maxStock: st.max,
      pendingOrderUnits: pending.get(pid) ?? 0,
      soldLast7: lastSum,
      soldLast30: last30.reduce((a, b) => a + b, 0),
      dailyAverage: round(base, 2),
      nextDay, nextWeek, nextMonth,
      trendPercent,
      weekdayFactor: round(wdFactor, 2),
      daysToStockout,
      stockoutDate,
      recommendedQuantity,
      confidence,
      severity,
      reasoning: bits.join(" "),
      history: dayKeys.slice(-30).map((d) => ({ date: d, units: s.get(d) ?? 0 })),
      projection,
      cancelledUnits: cancelled.get(pid) ?? 0,
    };
  }).sort((a, b) => (a.daysToStockout ?? 9999) - (b.daysToStockout ?? 9999));
}

// ------------------------------------------------------------------ MODULE 8
export function detectAnomalies(snap: Snapshot, forecasts: ProductForecast[]): Anomaly[] {
  const out: Anomaly[] = [];

  for (const f of forecasts) {
    // Sudden demand spike
    const hist = f.history.map((h) => h.units);
    const body = hist.slice(0, -1);
    const mean = body.reduce((a, b) => a + b, 0) / (body.length || 1);
    const sd = Math.sqrt(body.reduce((a, v) => a + (v - mean) ** 2, 0) / (body.length || 1));
    const today = hist[hist.length - 1] ?? 0;
    if (mean > 0 && today > mean + 3 * sd && today >= 2 * mean) {
      out.push({
        kind: "demand_spike", severity: "medium", productId: f.productId, productName: f.name,
        title: `Unusual demand spike — ${f.name}`,
        body: `${today} units sold today versus a ${round(mean, 1)} unit daily average. Check stock cover before it runs out.`,
      });
    }
    // Declining demand
    if (f.trendPercent <= -40 && f.soldLast30 >= 10) {
      out.push({
        kind: "declining_demand", severity: "low", productId: f.productId, productName: f.name,
        title: `Demand falling — ${f.name}`,
        body: `Sales dropped ${Math.abs(f.trendPercent)}% versus last week. Consider slowing replenishment.`,
      });
    }
    // Frequent cancellations
    if (f.cancelledUnits >= 3 && f.cancelledUnits > f.soldLast30 * 0.3) {
      out.push({
        kind: "high_cancellations", severity: "medium", productId: f.productId, productName: f.name,
        title: `High cancellations — ${f.name}`,
        body: `${f.cancelledUnits} units cancelled recently. Check price, quality or availability issues.`,
      });
    }
  }

  for (const it of snap.inventory) {
    if (Number(it.current_stock) < 0 || Number(it.available_stock) < 0) {
      out.push({
        kind: "negative_inventory", severity: "critical", productId: it.product_id, productName: it.product_name,
        title: `Negative inventory — ${it.product_name}`,
        body: `Stock reads ${it.current_stock} (available ${it.available_stock}). This needs a manual stock count.`,
      });
    }
    if (Number(it.reserved_stock) > Number(it.current_stock)) {
      out.push({
        kind: "inventory_mismatch", severity: "critical", productId: it.product_id, productName: it.product_name,
        title: `Inventory mismatch — ${it.product_name}`,
        body: `${it.reserved_stock} units reserved but only ${it.current_stock} on the shelf. Reconcile before the next delivery.`,
      });
    }
  }

  // Duplicate stock records for the same product in the same store
  const seen = new Map<string, number>();
  for (const it of snap.inventory) {
    const k = `${it.market_id}|${it.product_id}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, count] of seen) if (count > 1) {
    const pid = k.split("|")[1];
    out.push({
      kind: "duplicate_inventory", severity: "medium", productId: pid, productName: pid,
      title: "Duplicate stock record",
      body: `${count} stock rows exist for the same product in one store. Merge them to avoid double counting.`,
    });
  }

  // Supplier inactivity — a category that used to sell but has had no orders for 7 days
  const byCat = new Map<string, { recent: number; older: number }>();
  const weekAgo = Date.now() - 7 * DAY_MS;
  for (const o of snap.orders) {
    if (o.status === "cancelled") continue;
    const recent = new Date(o.created_at).getTime() >= weekAgo;
    for (const li of o.items ?? []) {
      const cat = snap.categories[li.productId];
      if (!cat) continue;
      const c = byCat.get(cat) ?? { recent: 0, older: 0 };
      if (recent) c.recent += Number(li.qty || 0); else c.older += Number(li.qty || 0);
      byCat.set(cat, c);
    }
  }
  for (const [cat, c] of byCat) if (c.recent === 0 && c.older >= 20) {
    out.push({
      kind: "supplier_inactive", severity: "medium", productId: null, productName: null,
      title: `No movement in ${cat}`,
      body: `${cat} sold ${c.older} units earlier but nothing in the last 7 days. Check the supplier and listing availability.`,
    });
  }

  return out;
}

// ------------------------------------------------------------------ MODULE 4
export function inventoryHealthScore(forecasts: ProductForecast[]): number {
  const tracked = forecasts.filter((f) => f.currentStock > 0 || f.soldLast30 > 0);
  if (tracked.length === 0) return 100;
  let score = 0;
  for (const f of tracked) {
    if (f.availableStock <= 0) score += 0;
    else if (f.severity === "critical") score += 25;
    else if (f.severity === "medium") score += 55;
    else if (f.severity === "low") score += 80;
    else score += 100;
  }
  return Math.round(score / tracked.length);
}

export type SupplierScore = {
  supplierId: string; name: string; score: number;
  products: number; stockouts: number; fillRate: number; unitsSold: number; poTurnaroundDays: number | null;
};

export async function supplierScores(snap: Snapshot, forecasts: ProductForecast[]): Promise<SupplierScore[]> {
  const { SUPPLIERS } = await import("./suppliers");
  const cancelledByCat = new Map<string, number>();
  const soldByCat = new Map<string, number>();
  for (const o of snap.orders) {
    for (const li of o.items ?? []) {
      const cat = snap.categories[li.productId];
      if (!cat) continue;
      const qty = Number(li.qty || 0);
      if (o.status === "cancelled") cancelledByCat.set(cat, (cancelledByCat.get(cat) ?? 0) + qty);
      else soldByCat.set(cat, (soldByCat.get(cat) ?? 0) + qty);
    }
  }

  const approved = snap.purchaseOrders.filter((p) => p.approved_at);
  const turnaround = approved.length
    ? round(approved.reduce((a, p) =>
        a + (new Date(p.approved_at as string).getTime() - new Date(p.created_at).getTime()) / DAY_MS, 0) / approved.length, 1)
    : null;

  return SUPPLIERS.map((s) => {
    const mine = forecasts.filter((f) => s.categories.includes(f.category));
    const sold = s.categories.reduce((a, c) => a + (soldByCat.get(c) ?? 0), 0);
    const cancelled = s.categories.reduce((a, c) => a + (cancelledByCat.get(c) ?? 0), 0);
    const stockouts = mine.filter((f) => f.availableStock <= 0).length;
    const fillRate = sold + cancelled > 0 ? Math.round((sold / (sold + cancelled)) * 100) : 100;
    const stockScore = mine.length ? Math.round(((mine.length - stockouts) / mine.length) * 100) : 100;
    const speedScore = turnaround === null ? 80 : Math.round(clamp(100 - turnaround * 15, 30, 100));
    return {
      supplierId: s.id, name: s.name,
      score: Math.round(0.4 * fillRate + 0.4 * stockScore + 0.2 * speedScore),
      products: mine.length, stockouts, fillRate, unitsSold: sold, poTurnaroundDays: turnaround,
    };
  });
}

// ---------------------------------------------------------- MODULES 2, 6, 10
export type GeneratedInsight = {
  audience: "admin" | "supplier";
  supplier_id: string | null;
  kind: string;
  severity: Severity;
  product_id: string | null;
  product_name: string | null;
  title: string;
  body: string;
  reasoning: string;
  recommended_quantity: number | null;
  confidence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;

};

const supplierForCategory = async (category: string) => {
  const { SUPPLIERS } = await import("./suppliers");
  return SUPPLIERS.find((s) => s.categories.includes(category)) ?? null;
};

/** Runs the full analysis and persists today's insights + forecast snapshots. */
export async function runAnalysis(): Promise<{
  insights: number; forecasts: number; anomalies: number; health: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const snap = await loadSnapshot(90);
  const forecasts = buildForecasts(snap);
  const anomalies = detectAnomalies(snap, forecasts);
  const health = inventoryHealthScore(forecasts);
  const today = iso(new Date());

  // ---- Module 10: score yesterday's predictions against what actually sold.
  await scoreYesterdaysForecasts(snap);

  // ---- Save today's forecast snapshot (used for learning + accuracy display).
  const rows = forecasts.slice(0, 200).map((f) => ({
    forecast_date: today,
    product_id: f.productId,
    product_name: f.name,
    predicted_next_day: f.nextDay,
    predicted_next_week: f.nextWeek,
    predicted_next_month: f.nextMonth,
    available_stock: f.availableStock,
    days_to_stockout: f.daysToStockout,
    recommended_quantity: f.recommendedQuantity,
    confidence: f.confidence,
  }));
  if (rows.length) {
    await supabaseAdmin.from("ai_forecasts").upsert(rows, { onConflict: "forecast_date,product_id" });
  }

  // ---- Build today's insights.
  const generated: GeneratedInsight[] = [];

  for (const f of forecasts) {
    if (!f.severity) continue;
    const sup = f.category ? await supplierForCategory(f.category) : null;
    const when = f.daysToStockout === null ? "soon"
      : f.daysToStockout <= 1 ? "within 24 hours"
      : `in about ${Math.round(f.daysToStockout)} days`;
    const title = `${f.name} likely to stock out ${when}`;
    const body = f.recommendedQuantity > 0
      ? `Order ${f.recommendedQuantity} more units. Expected demand ${f.nextWeek} units over the next 7 days.`
      : `Stock cover is thin — monitor closely. Expected demand ${f.nextWeek} units over the next 7 days.`;
    const data = {
      daysToStockout: f.daysToStockout, stockoutDate: f.stockoutDate, nextDay: f.nextDay,
      nextWeek: f.nextWeek, nextMonth: f.nextMonth, available: f.availableStock,
      supplier: sup?.name ?? null, trendPercent: f.trendPercent,
    };
    generated.push({
      audience: "admin", supplier_id: sup?.id ?? null, kind: "low_stock", severity: f.severity,
      product_id: f.productId, product_name: f.name, title, body, reasoning: f.reasoning,
      recommended_quantity: f.recommendedQuantity, confidence: f.confidence, data,
    });
    if (sup) {
      generated.push({
        audience: "supplier", supplier_id: sup.id, kind: "low_stock", severity: f.severity,
        product_id: f.productId, product_name: f.name,
        title, body: `Replenish ${f.recommendedQuantity || f.reorderLevel} units — ${body}`,
        reasoning: f.reasoning, recommended_quantity: f.recommendedQuantity, confidence: f.confidence, data,
      });
    }
  }

  // Reorder recommendations for healthy-but-thin products (admin approval only).
  for (const f of forecasts.filter((x) => !x.severity && x.recommendedQuantity > 0 && x.soldLast30 > 0).slice(0, 15)) {
    const sup = f.category ? await supplierForCategory(f.category) : null;
    generated.push({
      audience: "admin", supplier_id: sup?.id ?? null, kind: "reorder", severity: "low",
      product_id: f.productId, product_name: f.name,
      title: `Reorder ${f.recommendedQuantity} × ${f.name}`,
      body: `Suggested supplier: ${sup?.name ?? "unassigned"}. Expected sales until the next delivery: ${f.nextWeek} units. Needs your approval before any purchase order is created.`,
      reasoning: f.reasoning, recommended_quantity: f.recommendedQuantity, confidence: f.confidence,
      data: { supplier: sup?.name ?? null, stockoutDate: f.stockoutDate, nextWeek: f.nextWeek },
    });
  }

  // Trend reminders.
  for (const f of forecasts.filter((x) => x.trendPercent >= 40 && x.soldLast7 >= 5).slice(0, 8)) {
    generated.push({
      audience: "admin", supplier_id: null, kind: "trend", severity: "low",
      product_id: f.productId, product_name: f.name,
      title: `${f.name} sales up ${f.trendPercent}% this week`,
      body: `Demand is accelerating — plan for ${f.nextWeek} units over the next 7 days.`,
      reasoning: f.reasoning, recommended_quantity: f.recommendedQuantity, confidence: f.confidence, data: {},
    });
  }

  // Weekend / festival heads-up.
  const fest = festivalFactor(new Date(Date.now() + 2 * DAY_MS));
  if (fest.name) {
    generated.push({
      audience: "admin", supplier_id: null, kind: "seasonality", severity: "low",
      product_id: null, product_name: null,
      title: `${fest.name} demand expected to rise`,
      body: `Plan for roughly ${Math.round((fest.factor - 1) * 100)}% higher demand across the catalogue during ${fest.name}.`,
      reasoning: "Based on the festival calendar and historical uplift for this period.",
      recommended_quantity: null, confidence: 70, data: { festival: fest.name },
    });
  }

  for (const a of anomalies) {
    generated.push({
      audience: "admin", supplier_id: null, kind: `anomaly_${a.kind}`, severity: a.severity,
      product_id: a.productId, product_name: a.productName, title: a.title, body: a.body,
      reasoning: "Detected by continuous anomaly monitoring across orders and stock records.",
      recommended_quantity: null, confidence: 80, data: {},
    });
  }

  // Replace today's machine-generated insights so re-running never duplicates.
  await supabaseAdmin.from("ai_insights").delete().gte("created_at", `${today}T00:00:00Z`);
  if (generated.length) await supabaseAdmin.from("ai_insights").insert(generated);

  return { insights: generated.length, forecasts: rows.length, anomalies: anomalies.length, health };
}

/** Module 10 — compare stored predictions with what actually sold. */
export async function scoreYesterdaysForecasts(snap: Snapshot) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const yesterday = iso(new Date(Date.now() - DAY_MS));
  const { data: pending } = await supabaseAdmin
    .from("ai_forecasts").select("id, product_id, predicted_next_day")
    .eq("forecast_date", yesterday).is("actual_units", null);
  if (!pending?.length) return;

  const today = iso(new Date());
  const actual = new Map<string, number>();
  for (const o of snap.orders) {
    if (o.status === "cancelled") continue;
    if (String(o.created_at).slice(0, 10) !== today) continue;
    for (const li of o.items ?? []) actual.set(li.productId, (actual.get(li.productId) ?? 0) + Number(li.qty || 0));
  }

  for (const row of pending) {
    const act = actual.get(row.product_id as string) ?? 0;
    const pred = Number(row.predicted_next_day);
    const denom = Math.max(act, pred, 1);
    const accuracy = Math.round(clamp(1 - Math.abs(act - pred) / denom, 0, 1) * 100);
    await supabaseAdmin.from("ai_forecasts").update({ actual_units: act, accuracy }).eq("id", row.id);
  }
}

export async function forecastAccuracy(): Promise<{ overall: number; samples: number; recent: { date: string; accuracy: number }[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_forecasts").select("forecast_date, accuracy")
    .not("accuracy", "is", null)
    .order("forecast_date", { ascending: false })
    .limit(1000);
  const rows = data ?? [];
  if (!rows.length) return { overall: 0, samples: 0, recent: [] };
  const byDate = new Map<string, number[]>();
  for (const r of rows) {
    const k = r.forecast_date as string;
    byDate.set(k, [...(byDate.get(k) ?? []), Number(r.accuracy)]);
  }
  const recent = [...byDate.entries()]
    .map(([date, vals]) => ({ date, accuracy: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const overall = Math.round(rows.reduce((a, r) => a + Number(r.accuracy), 0) / rows.length);
  return { overall, samples: rows.length, recent };
}
