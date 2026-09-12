import { createServerFn } from "@tanstack/react-start";

// Business rules (kept in one place so they can be tuned without touching UI).
export const MERCHANT_COMMISSION_RATE = 0.15; // 15% of subtotal
export const CONVENIENCE_FEE_SOURCE = "surge"; // surge_amount treated as convenience fee
export const DELIVERY_COST_PER_ORDER = 25; // ₹25 flat payout to rider

export type OrderItem = { productId?: string; id?: string; name?: string; qty?: number; price?: number };

type RawOrder = {
  id: string;
  created_at: string;
  updated_at: string | null;
  status: string;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  items: unknown;
  subtotal: number | string;
  delivery_fee: number | string;
  discount: number | string;
  surge_amount: number | string;
  total: number | string;
  delivery_boy_id: string | null;
  cancel_reason: string | null;
  refunded: boolean | null;
  refunded_at: string | null;
  refund_request_status: string | null;
};

// ---------- helpers ----------
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const asItems = (v: unknown): OrderItem[] => (Array.isArray(v) ? (v as OrderItem[]) : []);

function parseArea(address: string | null): string {
  if (!address) return "";
  // pincode-first: try to find last piece before pincode; else last comma piece
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  // Prefer segment just before pincode (6-digit) if present
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/\b\d{6}\b/.test(parts[i])) {
      return parts[Math.max(0, i - 1)] || parts[i];
    }
  }
  return parts[parts.length - 2] || parts[parts.length - 1];
}

function paymentStatus(r: RawOrder): "paid" | "pending" | "refunded" | "failed" {
  if (r.refund_request_status === "approved" || r.refunded) return "refunded";
  if (r.refund_request_status === "rejected") return "failed";
  const method = (r.payment_method || "").toLowerCase();
  if (method === "cod" || method === "cash") {
    return r.status === "delivered" ? "paid" : "pending";
  }
  return "paid";
}

export function displayOrderStatus(r: { status: string; refund_request_status?: string | null }): string {
  if (r.refund_request_status === "approved") return "Refunded";
  if (r.refund_request_status === "pending") return "Refund Requested";
  if (r.refund_request_status === "rejected") return "Refund Failed";
  const s = r.status;
  if (s === "out_for_delivery") return "Out for Delivery";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function itemsDescription(items: OrderItem[], namesById: Record<string, string>): string {
  const parts: string[] = [];
  for (const it of items) {
    const pid = String(it.productId ?? it.id ?? "").trim();
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (!pid || qty <= 0) continue;
    const name = namesById[pid] || it.name || pid;
    parts.push(`${name} (${qty})`);
  }
  return parts.join(", ");
}

function totalItems(items: OrderItem[]): number {
  return items.reduce((s, it) => s + Math.max(0, Math.floor(Number(it.qty) || 0)), 0);
}

// Derive vendor label for an order from the categories of its items.
function orderVendor(items: OrderItem[], catCatalog: Record<string, string>): string {
  const cats = new Set<string>();
  for (const it of items) {
    const pid = String(it.productId ?? it.id ?? "").trim();
    const c = catCatalog[pid];
    if (c) cats.add(c);
  }
  const pharm = new Set(["pharmacy"]);
  const pick = new Set(["pickles", "local-snacks"]);
  const hitP = [...cats].some(c => pharm.has(c));
  const hitK = [...cats].some(c => pick.has(c));
  const hitG = [...cats].some(c => !pharm.has(c) && !pick.has(c));
  const names: string[] = [];
  if (hitP) names.push("Pharmacy Supplier");
  if (hitK) names.push("Pickles & Local Snacks Supplier");
  if (hitG) names.push("General Store Supplier");
  return names.join(" + ") || "—";
}

// ---------- SALES DATASET (rewritten) ----------
export type SalesRow = {
  orderId: string;
  orderDate: string; // ISO YYYY-MM-DD
  orderTime: string; // HH:MM
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  area: string;
  vendor: string;
  deliveryPartner: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  totalItems: number;
  itemsOrdered: string;
  orderValue: number;
  deliveryFee: number;
  convenienceFee: number;
  merchantCommission: number;
  platformProfit: number;
  deliveryCost: number;
  netProfit: number;
  deliveryTimeMin: number | null;
  customerRating: number | null;
};

export type SalesDataset = {
  rows: SalesRow[];
  vendors: string[];
  deliveryPartners: string[];
  areas: string[];
  paymentMethods: string[];
  orderStatuses: string[];
};

export const getSalesDatasetFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { CATALOG, PRODUCT_CATEGORY } = await import("./server-catalog.server");

    const namesById: Record<string, string> = {};
    const catById: Record<string, string> = {};
    for (const [pid, e] of Object.entries(CATALOG)) {
      namesById[pid] = e.name;
      catById[pid] = PRODUCT_CATEGORY[pid];
    }

    const [ordersRes, driversRes, reviewsRes] = await Promise.all([
      supabaseAdmin.from("app_orders").select("id, created_at, updated_at, status, payment_method, customer_name, customer_phone, address, items, subtotal, delivery_fee, discount, surge_amount, total, delivery_boy_id, cancel_reason, refunded, refunded_at, refund_request_status").order("created_at", { ascending: false }),
      supabaseAdmin.from("delivery_partners").select("driver_id, name"),
      supabaseAdmin.from("product_reviews").select("order_id, rating"),
    ]);
    if (ordersRes.error) throw new Error("Could not load sales data");

    const orders = (ordersRes.data ?? []) as RawOrder[];
    const drivers = (driversRes.data ?? []) as { driver_id: string; name: string }[];
    const driverById = new Map(drivers.map(d => [d.driver_id, d.name] as const));
    // Also include static DELIVERY_BOYS from client data (they use string IDs like d1, d2).
    const staticDrivers = [
      { id: "d1", name: "Ravi Kumar" },
      { id: "d2", name: "Suresh M." },
      { id: "d3", name: "Naveen P." },
    ];
    for (const d of staticDrivers) if (!driverById.has(d.id)) driverById.set(d.id, d.name);

    const ratings = (reviewsRes.data ?? []) as { order_id: string; rating: number }[];
    const ratingByOrder = new Map<string, { sum: number; count: number }>();
    for (const r of ratings) {
      const cur = ratingByOrder.get(r.order_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.rating) || 0;
      cur.count += 1;
      ratingByOrder.set(r.order_id, cur);
    }

    const rows: SalesRow[] = orders.map(o => {
      const items = asItems(o.items);
      const created = new Date(o.created_at);
      const orderDate = created.toISOString().slice(0, 10);
      const orderTime = created.toISOString().slice(11, 16);
      const subtotal = num(o.subtotal);
      const deliveryFee = num(o.delivery_fee);
      const convenienceFee = num(o.surge_amount);
      const total = num(o.total);
      const merchantCommission = +(subtotal * MERCHANT_COMMISSION_RATE).toFixed(2);
      const isDelivered = o.status === "delivered";
      const deliveryCost = isDelivered ? DELIVERY_COST_PER_ORDER : 0;
      const platformProfit = +(convenienceFee + merchantCommission).toFixed(2);
      const netProfit = +(platformProfit - deliveryCost).toFixed(2);
      const deliveryTimeMin = isDelivered && o.updated_at
        ? Math.max(0, Math.round((new Date(o.updated_at).getTime() - created.getTime()) / 60000))
        : null;
      const rt = ratingByOrder.get(o.id);
      const customerRating = rt && rt.count > 0 ? +(rt.sum / rt.count).toFixed(1) : null;

      return {
        orderId: o.id,
        orderDate,
        orderTime,
        createdAt: o.created_at,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        address: o.address,
        area: parseArea(o.address),
        vendor: orderVendor(items, catById),
        deliveryPartner: o.delivery_boy_id ? (driverById.get(o.delivery_boy_id) ?? o.delivery_boy_id) : "—",
        paymentMethod: o.payment_method,
        paymentStatus: paymentStatus(o),
        orderStatus: displayOrderStatus(o),
        totalItems: totalItems(items),
        itemsOrdered: itemsDescription(items, namesById),
        orderValue: total,
        deliveryFee,
        convenienceFee,
        merchantCommission,
        platformProfit,
        deliveryCost,
        netProfit,
        deliveryTimeMin,
        customerRating,
      };
    });

    const vendors = Array.from(new Set(rows.map(r => r.vendor).filter(Boolean))).sort();
    const deliveryPartners = Array.from(new Set(rows.map(r => r.deliveryPartner).filter(v => v && v !== "—"))).sort();
    const areas = Array.from(new Set(rows.map(r => r.area).filter(Boolean))).sort();
    const paymentMethods = Array.from(new Set(rows.map(r => r.paymentMethod).filter(Boolean))).sort();
    const orderStatuses = Array.from(new Set(rows.map(r => r.orderStatus))).sort();
    return { rows, vendors, deliveryPartners, areas, paymentMethods, orderStatuses } satisfies SalesDataset;
  });

// ---------- DAILY BUSINESS SUMMARY ----------
export type DailyRow = {
  date: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  grossSales: number;
  deliveryFeeCollected: number;
  convenienceFeeCollected: number;
  merchantCommission: number;
  totalDeliveryCost: number;
  totalPlatformProfit: number;
  averageOrderValue: number;
  newCustomers: number;
  repeatCustomers: number;
  vendor: string;
  area: string;
};

export type DailyDataset = {
  rows: DailyRow[];
  months: string[]; // "YYYY-MM"
  years: string[];
  vendors: string[];
  areas: string[];
};

export const getDailySummaryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { CATALOG, PRODUCT_CATEGORY } = await import("./server-catalog.server");

    const catById: Record<string, string> = {};
    for (const pid of Object.keys(CATALOG)) catById[pid] = PRODUCT_CATEGORY[pid] ?? "";

    const { data: orders, error } = await supabaseAdmin
      .from("app_orders")
      .select("id, created_at, status, payment_method, customer_phone, address, items, subtotal, delivery_fee, discount, surge_amount, total, refunded, refund_request_status")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load daily data");

    const raw = (orders ?? []) as RawOrder[];

    // Determine first-order date per customer for new/repeat classification.
    const firstOrderByPhone = new Map<string, string>();
    for (const o of raw) {
      const phone = o.customer_phone || "";
      if (!phone) continue;
      const d = o.created_at.slice(0, 10);
      const prev = firstOrderByPhone.get(phone);
      if (!prev || d < prev) firstOrderByPhone.set(phone, d);
    }

    // Group by date + vendor + area for filterability.
    type Key = string;
    const map = new Map<Key, DailyRow>();
    for (const o of raw) {
      const items = asItems(o.items);
      const date = o.created_at.slice(0, 10);
      const vendor = orderVendor(items, catById);
      const area = parseArea(o.address);
      const key = `${date}|${vendor}|${area}`;
      const cur = map.get(key) ?? {
        date, vendor, area,
        totalOrders: 0, completedOrders: 0, cancelledOrders: 0, returnedOrders: 0,
        grossSales: 0, deliveryFeeCollected: 0, convenienceFeeCollected: 0,
        merchantCommission: 0, totalDeliveryCost: 0, totalPlatformProfit: 0,
        averageOrderValue: 0, newCustomers: 0, repeatCustomers: 0,
      };
      cur.totalOrders += 1;
      const isDelivered = o.status === "delivered";
      const isCancelled = o.status === "cancelled";
      const isReturned = !!o.refunded || o.refund_request_status === "approved";
      if (isDelivered) cur.completedOrders += 1;
      if (isCancelled) cur.cancelledOrders += 1;
      if (isReturned) cur.returnedOrders += 1;
      cur.grossSales += num(o.total);
      cur.deliveryFeeCollected += num(o.delivery_fee);
      cur.convenienceFeeCollected += num(o.surge_amount);
      cur.merchantCommission += num(o.subtotal) * MERCHANT_COMMISSION_RATE;
      cur.totalDeliveryCost += isDelivered ? DELIVERY_COST_PER_ORDER : 0;
      const phone = o.customer_phone || "";
      if (phone && firstOrderByPhone.get(phone) === date) cur.newCustomers += 1;
      else if (phone) cur.repeatCustomers += 1;
      map.set(key, cur);
    }

    const rows = Array.from(map.values())
      .map(r => {
        r.merchantCommission = +r.merchantCommission.toFixed(2);
        r.totalPlatformProfit = +(r.convenienceFeeCollected + r.merchantCommission - r.totalDeliveryCost).toFixed(2);
        r.averageOrderValue = r.totalOrders > 0 ? +(r.grossSales / r.totalOrders).toFixed(2) : 0;
        r.grossSales = +r.grossSales.toFixed(2);
        r.deliveryFeeCollected = +r.deliveryFeeCollected.toFixed(2);
        r.convenienceFeeCollected = +r.convenienceFeeCollected.toFixed(2);
        r.totalDeliveryCost = +r.totalDeliveryCost.toFixed(2);
        return r;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const months = Array.from(new Set(rows.map(r => r.date.slice(0, 7)))).sort().reverse();
    const years = Array.from(new Set(rows.map(r => r.date.slice(0, 4)))).sort().reverse();
    const vendors = Array.from(new Set(rows.map(r => r.vendor).filter(Boolean))).sort();
    const areas = Array.from(new Set(rows.map(r => r.area).filter(Boolean))).sort();
    return { rows, months, years, vendors, areas } satisfies DailyDataset;
  });

// ---------- PRODUCT ANALYTICS ----------
export type ProductRow = {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  ordersCount: number;
  averageSellingPrice: number;
  lastSoldDate: string | null;
  currentStock: number;
  available: boolean;
};

export const getProductAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { CATALOG, PRODUCT_CATEGORY } = await import("./server-catalog.server");

    const [ordersRes, catalogRes, invRes] = await Promise.all([
      supabaseAdmin.from("app_orders").select("id, created_at, status, items").neq("status", "cancelled"),
      supabaseAdmin.from("catalog_items").select("id, name, category, stock, price"),
      // Seed products often have no catalog_items row yet; warehouse stock is
      // the next-best source of truth so availability isn't reported as zero.
      supabaseAdmin.from("inventory_items").select("product_id, current_stock, reserved_stock"),
    ]);
    if (ordersRes.error) throw new Error("Could not load product analytics");

    const orders = (ordersRes.data ?? []) as { id: string; created_at: string; status: string; items: unknown }[];
    const catalog = (catalogRes.data ?? []) as { id: string; name: string; category: string; stock: number; price: number }[];
    const invByProduct = new Map<string, number>();
    for (const r of (invRes.data ?? []) as { product_id: string; current_stock: number; reserved_stock: number }[]) {
      const avail = Math.max(0, Number(r.current_stock ?? 0) - Number(r.reserved_stock ?? 0));
      invByProduct.set(r.product_id, (invByProduct.get(r.product_id) ?? 0) + avail);
    }

    const map = new Map<string, ProductRow>();
    // Seed with catalog + fallback CATALOG for names/categories
    const seed = (pid: string) => {
      if (map.has(pid)) return map.get(pid)!;
      const c = catalog.find(x => x.id === pid);
      const fallback = CATALOG[pid];
      const row: ProductRow = {
        productId: pid,
        productName: c?.name || fallback?.name || pid,
        sku: pid.toUpperCase(),
        category: c?.category || PRODUCT_CATEGORY[pid] || "—",
        unitsSold: 0, revenue: 0, ordersCount: 0, averageSellingPrice: 0,
        lastSoldDate: null,
        currentStock: c?.stock ?? invByProduct.get(pid) ?? 0,
        // A product with neither a catalog row nor a warehouse row is a bundled
        // seed item — still sellable, so don't report it as out of stock.
        available: c ? c.stock > 0 : invByProduct.has(pid) ? (invByProduct.get(pid) ?? 0) > 0 : true,
      };
      map.set(pid, row);
      return row;
    };
    for (const c of catalog) seed(c.id);
    for (const pid of Object.keys(CATALOG)) seed(pid);

    for (const o of orders) {
      const items = asItems(o.items);
      const perOrderPids = new Set<string>();
      for (const it of items) {
        const pid = String(it.productId ?? it.id ?? "").trim();
        const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
        const price = Number(it.price) || 0;
        if (!pid || qty <= 0) continue;
        const row = seed(pid);
        row.unitsSold += qty;
        row.revenue += price * qty;
        perOrderPids.add(pid);
        if (!row.lastSoldDate || o.created_at > row.lastSoldDate) row.lastSoldDate = o.created_at;
      }
      for (const pid of perOrderPids) seed(pid).ordersCount += 1;
    }

    const rows = Array.from(map.values()).map(r => {
      r.revenue = +r.revenue.toFixed(2);
      r.averageSellingPrice = r.unitsSold > 0 ? +(r.revenue / r.unitsSold).toFixed(2) : 0;
      r.lastSoldDate = r.lastSoldDate ? r.lastSoldDate.slice(0, 10) : null;
      return r;
    });
    return { rows };
  });

// ---------- VENDOR PERFORMANCE ----------
export type VendorRow = {
  vendorName: string;
  ordersReceived: number;
  ordersCompleted: number;
  averagePackingTimeMin: number | null;
  cancellationRate: number; // 0..1
  customerRating: number | null;
  totalSales: number;
  commissionPaid: number;
};

export const getVendorReportFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { CATALOG, PRODUCT_CATEGORY } = await import("./server-catalog.server");
    const catById: Record<string, string> = {};
    for (const pid of Object.keys(CATALOG)) catById[pid] = PRODUCT_CATEGORY[pid] ?? "";

    const [ordersRes, statusRes, reviewsRes] = await Promise.all([
      supabaseAdmin.from("app_orders").select("id, created_at, status, items, subtotal, total"),
      supabaseAdmin.from("order_status_log").select("order_id, to_status, changed_at"),
      supabaseAdmin.from("product_reviews").select("order_id, rating"),
    ]);
    if (ordersRes.error) throw new Error("Could not load vendor report");

    const orders = (ordersRes.data ?? []) as RawOrder[];
    const statusLogs = (statusRes.data ?? []) as { order_id: string; to_status: string; changed_at: string }[];
    const packedAtByOrder = new Map<string, string>();
    for (const s of statusLogs) if (s.to_status === "packed") packedAtByOrder.set(s.order_id, s.changed_at);
    const ratings = (reviewsRes.data ?? []) as { order_id: string; rating: number }[];

    type Agg = { received: number; completed: number; cancelled: number; sales: number; commission: number; packMin: number[]; ratings: number[] };
    const map = new Map<string, Agg>();
    const getA = (v: string): Agg => {
      let a = map.get(v);
      if (!a) { a = { received: 0, completed: 0, cancelled: 0, sales: 0, commission: 0, packMin: [], ratings: [] }; map.set(v, a); }
      return a;
    };

    for (const o of orders) {
      const vendor = orderVendor(asItems(o.items), catById);
      const a = getA(vendor);
      a.received += 1;
      if (o.status === "delivered") a.completed += 1;
      if (o.status === "cancelled") a.cancelled += 1;
      a.sales += num(o.total);
      a.commission += num(o.subtotal) * MERCHANT_COMMISSION_RATE;
      const packed = packedAtByOrder.get(o.id);
      if (packed) {
        const min = Math.max(0, Math.round((new Date(packed).getTime() - new Date(o.created_at).getTime()) / 60000));
        a.packMin.push(min);
      }
      const orderRatings = ratings.filter(r => r.order_id === o.id).map(r => r.rating);
      if (orderRatings.length > 0) a.ratings.push(orderRatings.reduce((s, r) => s + r, 0) / orderRatings.length);
    }

    const rows: VendorRow[] = Array.from(map.entries()).map(([vendorName, a]) => ({
      vendorName,
      ordersReceived: a.received,
      ordersCompleted: a.completed,
      averagePackingTimeMin: a.packMin.length > 0 ? +(a.packMin.reduce((s, v) => s + v, 0) / a.packMin.length).toFixed(1) : null,
      cancellationRate: a.received > 0 ? +(a.cancelled / a.received).toFixed(3) : 0,
      customerRating: a.ratings.length > 0 ? +(a.ratings.reduce((s, v) => s + v, 0) / a.ratings.length).toFixed(2) : null,
      totalSales: +a.sales.toFixed(2),
      commissionPaid: +a.commission.toFixed(2),
    })).sort((x, y) => y.totalSales - x.totalSales);
    return { rows };
  });

// ---------- DELIVERY PARTNER REPORT ----------
export type RiderRow = {
  riderName: string;
  ordersDelivered: number;
  averageDeliveryTimeMin: number | null;
  onTimePercent: number; // 0..100
  failedDeliveries: number;
  customerRating: number | null;
  earnings: number;
};

export const getRiderReportFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ordersRes, driversRes, reviewsRes] = await Promise.all([
      supabaseAdmin.from("app_orders").select("id, created_at, updated_at, status, delivery_boy_id, refunded, refund_request_status, surge_amount, driver_surge_share"),
      supabaseAdmin.from("delivery_partners").select("driver_id, name"),
      supabaseAdmin.from("product_reviews").select("order_id, rating"),
    ]);
    if (ordersRes.error) throw new Error("Could not load rider report");

    const orders = (ordersRes.data ?? []) as (RawOrder & { driver_surge_share: number | string | null })[];
    const drivers = (driversRes.data ?? []) as { driver_id: string; name: string }[];
    const driverById = new Map(drivers.map(d => [d.driver_id, d.name] as const));
    for (const d of [
      { id: "d1", name: "Ravi Kumar" },
      { id: "d2", name: "Suresh M." },
      { id: "d3", name: "Naveen P." },
    ]) if (!driverById.has(d.id)) driverById.set(d.id, d.name);
    const ratings = (reviewsRes.data ?? []) as { order_id: string; rating: number }[];

    type Agg = { delivered: number; failed: number; times: number[]; earnings: number; ratings: number[] };
    const map = new Map<string, Agg>();
    const getA = (name: string): Agg => {
      let a = map.get(name);
      if (!a) { a = { delivered: 0, failed: 0, times: [], earnings: 0, ratings: [] }; map.set(name, a); }
      return a;
    };
    // Include all known riders even if 0 orders
    for (const [, name] of driverById) getA(name);

    for (const o of orders) {
      if (!o.delivery_boy_id) continue;
      const name = driverById.get(o.delivery_boy_id) ?? o.delivery_boy_id;
      const a = getA(name);
      if (o.status === "delivered") {
        a.delivered += 1;
        a.earnings += DELIVERY_COST_PER_ORDER + (num(o.driver_surge_share) || 0);
        if (o.updated_at) {
          const min = Math.max(0, Math.round((new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000));
          a.times.push(min);
        }
      } else if (o.status === "cancelled" || o.refunded) {
        a.failed += 1;
      }
      const orderRatings = ratings.filter(r => r.order_id === o.id).map(r => r.rating);
      if (orderRatings.length > 0) a.ratings.push(orderRatings.reduce((s, r) => s + r, 0) / orderRatings.length);
    }

    const ON_TIME_MIN = 45;
    const rows: RiderRow[] = Array.from(map.entries()).map(([riderName, a]) => {
      const avg = a.times.length > 0 ? +(a.times.reduce((s, v) => s + v, 0) / a.times.length).toFixed(1) : null;
      const onTime = a.times.length > 0 ? +((a.times.filter(t => t <= ON_TIME_MIN).length / a.times.length) * 100).toFixed(1) : 0;
      return {
        riderName,
        ordersDelivered: a.delivered,
        averageDeliveryTimeMin: avg,
        onTimePercent: onTime,
        failedDeliveries: a.failed,
        customerRating: a.ratings.length > 0 ? +(a.ratings.reduce((s, v) => s + v, 0) / a.ratings.length).toFixed(2) : null,
        earnings: +a.earnings.toFixed(2),
      };
    }).sort((x, y) => y.ordersDelivered - x.ordersDelivered);
    return { rows };
  });
