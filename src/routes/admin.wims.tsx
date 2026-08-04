import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, RefreshCw, Plus, AlertTriangle, PackageX, IndianRupee, Radio, Bell } from "lucide-react";
import { useAuth } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/lib/data";
import {
  listInventoryFn, upsertInventoryItemFn, adjustStockFn, inventoryDashboardFn,
  listInventoryAlertsFn, listInventoryTransactionsFn, listInventoryNotificationsFn,
  markInventoryNotificationsReadFn, type InventoryRow,
} from "@/lib/inventory.functions";

export const Route = createFileRoute("/admin/wims")({
  component: WimsPage,
  head: () => ({
    meta: [
      { title: "Warehouse & inventory — Kartogo admin" },
      { name: "description", content: "Live per-store stock, reservations, reorder alerts and inventory audit trail." },
    ],
  }),
});

type Market = { id: string; name: string; is_active: boolean };
type Alert = { id: string; product_name: string; product_id: string; alert_type: string; current_stock: number; reorder_level: number; created_at: string };
type Txn = { id: string; product_name: string; product_id: string; old_quantity: number; new_quantity: number; old_reserved: number; new_reserved: number; reason: string; order_id: string | null; actor: string; created_at: string };
type Notif = { id: string; title: string; body: string; kind: string; read: boolean; created_at: string };
type Stats = Awaited<ReturnType<typeof inventoryDashboardFn>>;

const health = (r: InventoryRow) =>
  r.available_stock <= 0 ? "critical" : r.current_stock <= r.reorder_level ? "low" : "healthy";

const TONE: Record<string, string> = {
  healthy: "bg-leaf/15 text-leaf",
  low: "bg-saffron/20 text-saffron-foreground",
  critical: "bg-destructive/10 text-destructive",
};

const emptyForm = {
  marketId: "", productId: "", productName: "", sku: "", barcode: "",
  currentStock: 0, minStock: 5, maxStock: 100, reorderLevel: 10, sellingPrice: 0, costPrice: 0,
};

function WimsPage() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      const [inv, s, a, t, n] = await Promise.all([
        listInventoryFn({ data: { adminToken, marketId: marketFilter, search } }),
        inventoryDashboardFn({ data: { adminToken } }),
        listInventoryAlertsFn({ data: { adminToken } }),
        listInventoryTransactionsFn({ data: { adminToken, limit: 60 } }),
        listInventoryNotificationsFn({ data: { adminToken } }),
      ]);
      setRows(inv.items);
      setMarkets(inv.markets as Market[]);
      setStats(s);
      setAlerts(a.alerts as Alert[]);
      setTxns(t.transactions as Txn[]);
      setNotifs(n.notifications as Notif[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load inventory");
    } finally { setLoading(false); }
  }, [adminToken, marketFilter, search]);

  useEffect(() => { void load(); }, [load]);

  // Live inventory — any stock change anywhere refreshes this screen instantly.
  useEffect(() => {
    const channel = supabase
      .channel("wims-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_alerts" }, () => { void load(); })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const productOptions = useMemo(() => PRODUCTS.map((p) => ({ id: p.id, name: p.name, price: p.price })), []);
  const unread = notifs.filter((n) => !n.read).length;

  const save = async () => {
    if (!adminToken) return;
    try {
      await upsertInventoryItemFn({ data: { adminToken, ...form } });
      toast.success("Inventory saved");
      setForm({ ...emptyForm });
      setShowForm(false);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  };

  const adjust = async (id: string, delta: number) => {
    if (!adminToken) return;
    try {
      await adjustStockFn({ data: { adminToken, id, delta, reason: delta > 0 ? "stock_in" : "stock_out" } });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not adjust stock"); }
  };

  const clearNotifs = async () => {
    if (!adminToken) return;
    await markInventoryNotificationsReadFn({ data: { adminToken } });
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
  };

  const cards = stats ? [
    { label: "Total products", value: stats.totalProducts, tone: "healthy" },
    { label: "Available", value: stats.availableProducts, tone: "healthy" },
    { label: "Low stock", value: stats.lowStock, tone: "low" },
    { label: "Out of stock", value: stats.outOfStock, tone: "critical" },
    { label: "Today's orders", value: stats.todaysOrders, tone: "healthy" },
    { label: "Today's sales", value: `₹${Math.round(stats.todaysSales)}`, tone: "healthy" },
    { label: "Inventory value", value: `₹${stats.inventoryValue}`, tone: "healthy" },
    { label: "Reserved stock", value: stats.reservedStock, tone: "low" },
    { label: "Pending POs", value: stats.pendingPurchaseOrders, tone: stats.pendingPurchaseOrders ? "low" : "healthy" },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">Warehouse & inventory</h1>
          <p className="text-sm text-muted-foreground">Live stock per supermarket, reservations, reorder alerts and audit trail.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
          <Radio className="h-3.5 w-3.5" /> {live ? "Live" : "Connecting…"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            <Plus className="h-4 w-4" /> Add / update stock
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={`mt-1 inline-flex rounded-lg px-2 py-0.5 text-xl font-bold ${TONE[c.tone]}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Add / update form */}
      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-bold">Add or update a stock record</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold">Supermarket
              <select value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select store</option>
                {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold">Product
              <select
                value={form.productId}
                onChange={(e) => {
                  const p = productOptions.find((x) => x.id === e.target.value);
                  setForm({ ...form, productId: e.target.value, productName: p?.name ?? "", sellingPrice: p?.price ?? 0 });
                }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select product</option>
                {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {([
              ["SKU", "sku"], ["Barcode", "barcode"],
            ] as const).map(([label, key]) => (
              <label key={key} className="text-xs font-semibold">{label}
                <input value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            ))}
            {([
              ["Current stock", "currentStock"], ["Minimum stock", "minStock"], ["Maximum stock", "maxStock"],
              ["Reorder level", "reorderLevel"], ["Selling price", "sellingPrice"], ["Cost price", "costPrice"],
            ] as const).map(([label, key]) => (
              <label key={key} className="text-xs font-semibold">{label}
                <input type="number" min={0} value={Number(form[key])} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void save()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save record</button>
            <button onClick={() => { setForm({ ...emptyForm }); setShowForm(false); }} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Alerts + notifications side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
            <AlertTriangle className="h-4 w-4 text-saffron" /> Reorder alerts
            <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">{alerts.length}</span>
          </h2>
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">All stock is healthy.</p> : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-xl border border-border p-2 text-sm">
                  {a.alert_type === "out_of_stock" ? <PackageX className="h-4 w-4 text-destructive" /> : <AlertTriangle className="h-4 w-4 text-saffron" />}
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.product_name || a.product_id}</span>
                  <span className="text-xs text-muted-foreground">{a.current_stock} left · reorder {a.reorder_level}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
            <Bell className="h-4 w-4" /> Notifications
            {unread > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{unread}</span>}
            <button onClick={() => void clearNotifs()} className="ml-auto rounded-lg border border-border px-2 py-1 text-xs font-bold hover:bg-secondary">Mark read</button>
          </h2>
          {notifs.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {notifs.map((n) => (
                <li key={n.id} className={`rounded-xl border p-2 text-sm ${n.read ? "border-border" : "border-primary/40 bg-primary/5"}`}>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stock table */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Boxes className="h-4 w-4" /> Stock by supermarket</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, barcode" className="ml-auto w-full rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-64" />
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">All stores</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stock records yet. Add one above — every supermarket keeps its own stock.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Product</th><th>Store</th><th>SKU</th>
                  <th className="text-right">Current</th><th className="text-right">Reserved</th>
                  <th className="text-right">Available</th><th className="text-right">Reorder</th>
                  <th className="text-right">Price</th><th className="text-right">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const h = health(r);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <div className="font-semibold">{r.product_name}</div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[h]}`}>
                          {h === "healthy" ? "Healthy" : h === "low" ? "Low stock" : "Out of stock"}
                        </span>
                      </td>
                      <td className="pr-2">{r.market_name}</td>
                      <td className="pr-2 text-xs text-muted-foreground">{r.sku}</td>
                      <td className="text-right">{r.current_stock}</td>
                      <td className="text-right">{r.reserved_stock}</td>
                      <td className="text-right font-bold">{r.available_stock}</td>
                      <td className="text-right">{r.reorder_level}</td>
                      <td className="text-right">₹{r.selling_price}</td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => void adjust(r.id, -1)} className="h-7 w-7 rounded-lg border border-border font-bold hover:bg-secondary">−</button>
                          <button onClick={() => void adjust(r.id, 1)} className="h-7 w-7 rounded-lg border border-border font-bold hover:bg-secondary">+</button>
                          <button onClick={() => void adjust(r.id, 10)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold hover:bg-secondary">+10</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><IndianRupee className="h-4 w-4" /> Inventory transactions</h2>
        <p className="mb-2 text-xs text-muted-foreground">Full audit trail — reservations, deliveries, releases and manual edits are never deleted.</p>
        <div className="-mx-4 max-h-80 overflow-auto px-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">When</th><th>Product</th><th>Reason</th><th className="text-right">Stock</th><th className="text-right">Reserved</th><th>Order</th><th>By</th></tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN")}</td>
                  <td className="pr-2">{t.product_name || t.product_id}</td>
                  <td className="pr-2 text-xs">{t.reason.replace(/_/g, " ")}</td>
                  <td className="text-right">{t.old_quantity} → {t.new_quantity}</td>
                  <td className="text-right">{t.old_reserved} → {t.new_reserved}</td>
                  <td className="pr-2 text-xs">{t.order_id ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">{t.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
