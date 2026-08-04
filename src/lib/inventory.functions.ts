import { createServerFn } from "@tanstack/react-start";

// ============================================================================
// WIMS — Warehouse & Inventory Management System server API
// Every mutation goes through an admin or supplier session token. Suppliers can
// only touch products that belong to their own categories.
// ============================================================================

export type InventoryRow = {
  id: string;
  market_id: string;
  market_name?: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock: number;
  max_stock: number;
  reorder_level: number;
  selling_price: number;
  cost_price?: number;
  updated_at: string;
};

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const int = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

type Actor = { kind: "admin" | "supplier"; id: string; categories: string[] | null };

async function authorize(adminToken: string, supplierToken: string): Promise<Actor> {
  const { verifyAdminToken, verifySupplierToken } = await import("./auth-tokens.server");
  if (adminToken && verifyAdminToken(adminToken)) return { kind: "admin", id: "admin", categories: null };
  if (supplierToken) {
    const s = verifySupplierToken(supplierToken);
    if (s) {
      const { findSupplierById } = await import("./suppliers");
      const sup = findSupplierById(s.supplierId);
      return { kind: "supplier", id: s.supplierId, categories: sup?.categories ?? [] };
    }
  }
  throw new Error("Authorization required");
}

/** product_id -> category, from the shared catalog + supplier-added items. */
async function productCategories(): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const map: Record<string, string> = {};
  try {
    const { CATALOG } = await import("./server-catalog.server");
    for (const [id, p] of Object.entries(CATALOG)) map[id] = (p as { category: string }).category;
  } catch { /* catalog optional */ }
  const { data } = await supabaseAdmin.from("catalog_items").select("id, category");
  for (const r of data ?? []) map[r.id as string] = r.category as string;
  return map;
}

async function assertCanTouch(actor: Actor, productId: string) {
  if (actor.kind === "admin") return;
  const cats = await productCategories();
  const cat = cats[productId];
  if (!cat || !(actor.categories ?? []).includes(cat)) {
    throw new Error("This product is outside your supplier categories");
  }
}

// ---------------------------------------------------------------- inventory
export const listInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; marketId?: string; search?: string }) => ({
    adminToken: str(d?.adminToken, 500),
    supplierToken: str(d?.supplierToken, 500),
    marketId: str(d?.marketId, 60),
    search: str(d?.search, 80).toLowerCase(),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: markets }, { data: rows }, { data: costs }] = await Promise.all([
      supabaseAdmin.from("partner_markets").select("id, name, is_active").order("name"),
      supabaseAdmin.from("inventory_items").select("*").order("product_name"),
      supabaseAdmin.from("product_costs").select("product_id, cost_price"),
    ]);

    const marketName = new Map((markets ?? []).map((m) => [m.id as string, m.name as string]));
    const costMap = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_price)]));
    const cats = actor.kind === "supplier" ? await productCategories() : {};

    let items = (rows ?? []).map((r) => ({
      ...r,
      market_name: marketName.get(r.market_id as string) ?? "Store",
      cost_price: costMap.get(r.product_id as string) ?? 0,
    })) as InventoryRow[];

    if (actor.kind === "supplier") {
      items = items.filter((i) => (actor.categories ?? []).includes(cats[i.product_id] ?? ""));
    }
    if (data.marketId) items = items.filter((i) => i.market_id === data.marketId);
    if (data.search) {
      items = items.filter((i) =>
        `${i.product_name} ${i.sku} ${i.barcode} ${i.product_id}`.toLowerCase().includes(data.search));
    }
    return { items, markets: (markets ?? []) as { id: string; name: string; is_active: boolean }[] };
  });

export const upsertInventoryItemFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    adminToken?: string; supplierToken?: string;
    marketId?: string; productId?: string; productName?: string; sku?: string; barcode?: string;
    currentStock?: number; minStock?: number; maxStock?: number; reorderLevel?: number;
    sellingPrice?: number; costPrice?: number;
  }) => ({
    adminToken: str(d?.adminToken, 500),
    supplierToken: str(d?.supplierToken, 500),
    marketId: str(d?.marketId, 60),
    productId: str(d?.productId, 80),
    productName: str(d?.productName, 200),
    sku: str(d?.sku, 60),
    barcode: str(d?.barcode, 60),
    currentStock: int(d?.currentStock),
    minStock: int(d?.minStock),
    maxStock: int(d?.maxStock),
    reorderLevel: int(d?.reorderLevel),
    sellingPrice: num(d?.sellingPrice),
    costPrice: num(d?.costPrice),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    if (!data.marketId) throw new Error("Pick a supermarket");
    if (!data.productId) throw new Error("Pick a product");
    await assertCanTouch(actor, data.productId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("inventory_items").select("*")
      .eq("market_id", data.marketId).eq("product_id", data.productId).maybeSingle();

    const payload = {
      market_id: data.marketId,
      product_id: data.productId,
      product_name: data.productName || existing?.product_name || data.productId,
      sku: data.sku || existing?.sku || data.productId.toUpperCase(),
      barcode: data.barcode || existing?.barcode || "",
      current_stock: data.currentStock,
      min_stock: data.minStock,
      max_stock: data.maxStock,
      reorder_level: data.reorderLevel,
      selling_price: data.sellingPrice,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = existing
      ? await supabaseAdmin.from("inventory_items").update(payload).eq("id", existing.id).select("*").single()
      : await supabaseAdmin.from("inventory_items").insert(payload).select("*").single();
    if (error) {
      console.error("Inventory upsert failed", error);
      throw new Error("Could not save this inventory record. Please try again.");
    }

    if (data.costPrice > 0) {
      await supabaseAdmin.from("product_costs").upsert(
        { product_id: data.productId, cost_price: data.costPrice, updated_at: new Date().toISOString() },
        { onConflict: "product_id" },
      );
    }

    if (!existing || existing.current_stock !== data.currentStock) {
      await supabaseAdmin.from("inventory_transactions").insert({
        inventory_item_id: row.id,
        market_id: data.marketId,
        product_id: data.productId,
        product_name: payload.product_name,
        old_quantity: existing?.current_stock ?? 0,
        new_quantity: data.currentStock,
        old_reserved: existing?.reserved_stock ?? 0,
        new_reserved: row.reserved_stock,
        reason: existing ? "manual_adjustment" : "initial_stock",
        actor: `${actor.kind}:${actor.id}`,
      });
    }
    return row;
  });

export const adjustStockFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; id?: string; delta?: number; reason?: string }) => ({
    adminToken: str(d?.adminToken, 500),
    supplierToken: str(d?.supplierToken, 500),
    id: str(d?.id, 60),
    delta: Math.floor(Number(d?.delta) || 0),
    reason: str(d?.reason, 120) || "manual_adjustment",
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin.from("inventory_items").select("*").eq("id", data.id).maybeSingle();
    if (!item) throw new Error("Inventory record not found");
    await assertCanTouch(actor, item.product_id as string);

    const next = Math.max(0, Number(item.current_stock) + data.delta);
    const { data: row, error } = await supabaseAdmin
      .from("inventory_items")
      .update({ current_stock: next, updated_at: new Date().toISOString() })
      .eq("id", data.id).select("*").single();
    if (error) throw new Error("Stock could not be updated. Please try again.");

    await supabaseAdmin.from("inventory_transactions").insert({
      inventory_item_id: item.id,
      market_id: item.market_id,
      product_id: item.product_id,
      product_name: item.product_name,
      old_quantity: item.current_stock,
      new_quantity: next,
      old_reserved: item.reserved_stock,
      new_reserved: row.reserved_stock,
      reason: data.reason,
      actor: `${actor.kind}:${actor.id}`,
    });
    return row;
  });

// ---------------------------------------------------------------- dashboard
export const inventoryDashboardFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken, 500),
    supplierToken: str(d?.supplierToken, 500),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);

    const [{ data: items }, { data: costs }, { data: orders }, { data: pos }, { data: alerts }] = await Promise.all([
      supabaseAdmin.from("inventory_items").select("product_id, current_stock, reserved_stock, available_stock, reorder_level, selling_price"),
      supabaseAdmin.from("product_costs").select("product_id, cost_price"),
      supabaseAdmin.from("app_orders").select("id, total, status, created_at").gte("created_at", dayStart.toISOString()),
      supabaseAdmin.from("purchase_orders").select("id, status"),
      supabaseAdmin.from("inventory_alerts").select("id, status").eq("status", "open"),
    ]);

    const costMap = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_price)]));
    const rows = items ?? [];
    const products = new Set(rows.map((r) => r.product_id as string));
    const lowStock = rows.filter((r) => Number(r.current_stock) > 0 && Number(r.current_stock) <= Number(r.reorder_level)).length;
    const outOfStock = rows.filter((r) => Number(r.available_stock) <= 0).length;
    const inventoryValue = rows.reduce(
      (s, r) => s + Number(r.current_stock) * (costMap.get(r.product_id as string) || Number(r.selling_price) || 0), 0);
    const reserved = rows.reduce((s, r) => s + Number(r.reserved_stock), 0);
    const todaysOrders = (orders ?? []).filter((o) => o.status !== "cancelled");

    return {
      totalProducts: products.size,
      totalRecords: rows.length,
      availableProducts: rows.filter((r) => Number(r.available_stock) > 0).length,
      lowStock,
      outOfStock,
      todaysOrders: todaysOrders.length,
      todaysSales: todaysOrders.reduce((s, o) => s + Number(o.total || 0), 0),
      inventoryValue: Math.round(inventoryValue),
      reservedStock: reserved,
      pendingPurchaseOrders: (pos ?? []).filter((p) => p.status === "draft" || p.status === "pending_approval").length,
      openAlerts: (alerts ?? []).length,
    };
  });

export const listInventoryAlertsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("inventory_alerts").select("*").eq("status", "open")
      .order("created_at", { ascending: false }).limit(200);
    return { alerts: rows ?? [] };
  });

export const listInventoryTransactionsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; productId?: string; limit?: number }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
    productId: str(d?.productId, 80),
    limit: Math.min(500, Math.max(20, Math.floor(Number(d?.limit) || 100))),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("inventory_transactions").select("*")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.productId) q = q.eq("product_id", data.productId);
    const { data: rows } = await q;
    return { transactions: rows ?? [] };
  });

// --------------------------------------------------------- purchase orders
export const listPurchaseOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orders }, { data: lines }] = await Promise.all([
      supabaseAdmin.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("purchase_order_items").select("*"),
    ]);
    const byPo = new Map<string, typeof lines>();
    for (const l of lines ?? []) {
      const k = l.purchase_order_id as string;
      byPo.set(k, [...(byPo.get(k) ?? []), l]);
    }
    return {
      purchaseOrders: (orders ?? []).map((o) => ({ ...o, items: byPo.get(o.id as string) ?? [] })),
    };
  });

const PO_STATUSES = ["draft", "pending_approval", "approved", "rejected", "delivered"] as const;

export const setPurchaseOrderStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; id?: string; status?: string }) => {
    const status = str(d?.status, 30);
    if (!PO_STATUSES.includes(status as (typeof PO_STATUSES)[number])) throw new Error("Invalid purchase order status");
    return { adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500), id: str(d?.id, 60), status };
  })
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    if (actor.kind !== "admin" && data.status !== "rejected" && data.status !== "delivered") {
      throw new Error("Only an admin can approve purchase orders");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: po } = await supabaseAdmin.from("purchase_orders").select("*").eq("id", data.id).maybeSingle();
    if (!po) throw new Error("Purchase order not found");

    const { error } = await supabaseAdmin.from("purchase_orders").update({
      status: data.status,
      approved_at: data.status === "approved" ? new Date().toISOString() : po.approved_at,
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error("Purchase order could not be updated. Please try again.");

    // Receiving a delivered PO tops the stock back up.
    if (data.status === "delivered") {
      const { data: lines } = await supabaseAdmin
        .from("purchase_order_items").select("*").eq("purchase_order_id", data.id);
      for (const l of lines ?? []) {
        const { data: item } = await supabaseAdmin.from("inventory_items").select("*")
          .eq("market_id", po.market_id).eq("product_id", l.product_id).maybeSingle();
        if (!item) continue;
        const next = Number(item.current_stock) + Number(l.quantity);
        await supabaseAdmin.from("inventory_items")
          .update({ current_stock: next, updated_at: new Date().toISOString() }).eq("id", item.id);
        await supabaseAdmin.from("inventory_transactions").insert({
          inventory_item_id: item.id, market_id: item.market_id, product_id: item.product_id,
          product_name: item.product_name, old_quantity: item.current_stock, new_quantity: next,
          old_reserved: item.reserved_stock, new_reserved: item.reserved_stock,
          reason: "purchase_order_received", actor: `${actor.kind}:${actor.id}`,
        });
      }
    }

    await supabaseAdmin.from("inventory_notifications").insert({
      audience: "admin",
      title: `Purchase order ${data.status.replace("_", " ")}`,
      body: `Purchase order for ${po.market_name || "store"} is now ${data.status.replace("_", " ")}.`,
      kind: "purchase_order",
      purchase_order_id: data.id,
    });
    return { ok: true };
  });

// ---------------------------------------------------------- notifications
export const listInventoryNotificationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("inventory_notifications").select("*")
      .eq("audience", actor.kind === "admin" ? "admin" : "supplier")
      .order("created_at", { ascending: false }).limit(50);
    return { notifications: rows ?? [] };
  });

export const markInventoryNotificationsReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
  }))
  .handler(async ({ data }) => {
    const actor = await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("inventory_notifications").update({ read: true })
      .eq("audience", actor.kind === "admin" ? "admin" : "supplier").eq("read", false);
    return { ok: true };
  });

// -------------------------------------------------- analytics & forecasting
type OrderItem = { productId: string; name: string; qty: number; price: number };

export const inventoryAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; days?: number }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
    days: Math.min(730, Math.max(7, Math.floor(Number(d?.days) || 90))),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const [{ data: orders }, { data: items }, { data: costs }] = await Promise.all([
      supabaseAdmin.from("app_orders").select("id, items, total, status, created_at").gte("created_at", since),
      supabaseAdmin.from("inventory_items").select("product_id, product_name, current_stock, selling_price"),
      supabaseAdmin.from("product_costs").select("product_id, cost_price"),
    ]);

    type Agg = { productId: string; name: string; units: number; revenue: number; cancelled: number };
    const agg = new Map<string, Agg>();
    const dayMap = new Map<string, { orders: number; sales: number }>();

    for (const o of orders ?? []) {
      const day = String(o.created_at).slice(0, 10);
      const cancelled = o.status === "cancelled";
      if (!cancelled) {
        const d = dayMap.get(day) ?? { orders: 0, sales: 0 };
        d.orders += 1; d.sales += Number(o.total || 0);
        dayMap.set(day, d);
      }
      for (const li of (o.items ?? []) as OrderItem[]) {
        const key = li.productId;
        const a = agg.get(key) ?? { productId: key, name: li.name, units: 0, revenue: 0, cancelled: 0 };
        if (cancelled) a.cancelled += Number(li.qty || 0);
        else { a.units += Number(li.qty || 0); a.revenue += Number(li.qty || 0) * Number(li.price || 0); }
        agg.set(key, a);
      }
    }

    // Products tracked in inventory that never sold should still show as slow moving.
    for (const it of items ?? []) {
      const key = it.product_id as string;
      if (!agg.has(key)) agg.set(key, { productId: key, name: it.product_name as string, units: 0, revenue: 0, cancelled: 0 });
    }

    const list = [...agg.values()];
    const days = [...dayMap.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

    const bucket = (fmt: (d: string) => string) => {
      const m = new Map<string, { orders: number; sales: number }>();
      for (const d of days) {
        const k = fmt(d.date);
        const cur = m.get(k) ?? { orders: 0, sales: 0 };
        cur.orders += d.orders; cur.sales += d.sales;
        m.set(k, cur);
      }
      return [...m.entries()].map(([period, v]) => ({ period, ...v })).sort((a, b) => a.period.localeCompare(b.period));
    };
    const isoWeek = (iso: string) => {
      const dt = new Date(iso + "T00:00:00Z");
      const t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      const dayNum = (t.getUTCDay() + 6) % 7;
      t.setUTCDate(t.getUTCDate() - dayNum + 3);
      const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
      const week = 1 + Math.round(((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
      return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    };

    // Inventory turnover = units sold / average stock on hand.
    const costMap = new Map((costs ?? []).map((c) => [c.product_id as string, Number(c.cost_price)]));
    const stockMap = new Map<string, number>();
    for (const it of items ?? []) {
      stockMap.set(it.product_id as string, (stockMap.get(it.product_id as string) ?? 0) + Number(it.current_stock));
    }
    const totalUnits = list.reduce((s, p) => s + p.units, 0);
    const totalStock = [...stockMap.values()].reduce((s, v) => s + v, 0);
    const turnover = totalStock > 0 ? +(totalUnits / totalStock).toFixed(2) : 0;

    return {
      topSelling: [...list].sort((a, b) => b.units - a.units).slice(0, 10),
      slowMoving: [...list].sort((a, b) => a.units - b.units).slice(0, 10),
      mostCancelled: [...list].filter((p) => p.cancelled > 0).sort((a, b) => b.cancelled - a.cancelled).slice(0, 10),
      highestRevenue: [...list].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      daily: days.slice(-30),
      weekly: bucket(isoWeek).slice(-12),
      monthly: bucket((d) => d.slice(0, 7)).slice(-12),
      yearly: bucket((d) => d.slice(0, 4)),
      turnover,
      totalUnits,
      totalStock,
      inventoryCostValue: Math.round([...stockMap.entries()]
        .reduce((s, [pid, qty]) => s + qty * (costMap.get(pid) ?? 0), 0)),
    };
  });

export const demandForecastFn = createServerFn({ method: "POST" })
  .inputValidator((d: { adminToken?: string; supplierToken?: string; days?: number }) => ({
    adminToken: str(d?.adminToken, 500), supplierToken: str(d?.supplierToken, 500),
    days: Math.min(365, Math.max(14, Math.floor(Number(d?.days) || 60))),
  }))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, data.supplierToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const [{ data: orders }, { data: items }] = await Promise.all([
      supabaseAdmin.from("app_orders").select("items, status, created_at").gte("created_at", since).neq("status", "cancelled"),
      supabaseAdmin.from("inventory_items").select("product_id, product_name, current_stock, reserved_stock, max_stock, reorder_level"),
    ]);

    // daily units per product
    const series = new Map<string, Map<string, number>>();
    const names = new Map<string, string>();
    for (const o of orders ?? []) {
      const day = String(o.created_at).slice(0, 10);
      for (const li of (o.items ?? []) as OrderItem[]) {
        names.set(li.productId, li.name);
        const s = series.get(li.productId) ?? new Map<string, number>();
        s.set(day, (s.get(day) ?? 0) + Number(li.qty || 0));
        series.set(li.productId, s);
      }
    }

    const stock = new Map<string, { current: number; max: number; reorder: number; name: string }>();
    for (const it of items ?? []) {
      const k = it.product_id as string;
      const cur = stock.get(k) ?? { current: 0, max: 0, reorder: 0, name: it.product_name as string };
      cur.current += Number(it.current_stock) - Number(it.reserved_stock);
      cur.max += Number(it.max_stock);
      cur.reorder += Number(it.reorder_level);
      stock.set(k, cur);
      names.set(k, it.product_name as string);
    }

    const dayKeys: string[] = [];
    for (let i = data.days - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

    const ALPHA = 0.35; // exponential smoothing factor
    const forecasts = [...new Set([...series.keys(), ...stock.keys()])].map((pid) => {
      const s = series.get(pid) ?? new Map<string, number>();
      const values = dayKeys.map((d) => s.get(d) ?? 0);
      const window = values.slice(-7);
      const movingAverage = window.length ? window.reduce((a, b) => a + b, 0) / window.length : 0;
      let smoothed = values.length ? values[0] : 0;
      for (const v of values.slice(1)) smoothed = ALPHA * v + (1 - ALPHA) * smoothed;

      const nextDay = +(0.5 * movingAverage + 0.5 * smoothed).toFixed(2);
      const nextWeek = +(nextDay * 7).toFixed(1);
      const nextMonth = +(nextDay * 30).toFixed(1);
      const st = stock.get(pid);
      const cover = st?.current ?? 0;
      const recommended = Math.max(0, Math.ceil(nextWeek * 1.2 - cover));

      return {
        productId: pid,
        name: names.get(pid) ?? pid,
        soldLastWeek: values.slice(-7).reduce((a, b) => a + b, 0),
        movingAverage: +movingAverage.toFixed(2),
        smoothed: +smoothed.toFixed(2),
        nextDay, nextWeek, nextMonth,
        availableStock: cover,
        daysOfCover: nextDay > 0 ? +(cover / nextDay).toFixed(1) : null,
        recommendedPurchase: recommended,
      };
    }).sort((a, b) => b.nextWeek - a.nextWeek);

    return { forecasts: forecasts.slice(0, 50) };
  });

// ------------------------------------------------- public stock availability
/** Customer-facing availability: product_id -> available units across stores. */
export const availabilityFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("inventory_items").select("product_id, available_stock");
  const map: Record<string, number> = {};
  for (const r of data ?? []) {
    map[r.product_id as string] = (map[r.product_id as string] ?? 0) + Number(r.available_stock);
  }
  return { availability: map };
});
