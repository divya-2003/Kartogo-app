import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listSupplierOrdersFn, supplierMarkPackedFn, type SupplierOrder } from "@/lib/supplier.functions";
import { formatINR } from "@/lib/data";
import { CheckCircle2, RotateCcw, Clock, Package } from "lucide-react";

export const Route = createFileRoute("/supplier/orders")({ component: SupplierOrders });

const STATUS_LABEL: Record<SupplierOrder["status"], string> = {
  placed: "Placed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function statusClass(o: SupplierOrder) {
  if (o.status === "delivered") return "bg-primary/10 text-primary";
  if (o.status === "cancelled") return "bg-destructive/15 text-destructive";
  return "bg-saffron/30";
}

function SupplierOrders() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "delivered" | "returned" | "active">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try { token = JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { token = null; }
      if (!token) { setLoading(false); return; }
      try {
        const res = await listSupplierOrdersFn({ data: { token } });
        if (!cancelled) setOrders(res.orders);
      } catch { /* keep empty */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const returned = orders.filter((o) => o.status === "cancelled" || o.refunded);
    const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    const revenue = delivered.reduce((s, o) => s + o.supplierTotal, 0);
    return { delivered, returned, active, revenue };
  }, [orders]);

  const filtered = useMemo(() => {
    if (tab === "delivered") return stats.delivered;
    if (tab === "returned") return stats.returned;
    if (tab === "active") return stats.active;
    return orders;
  }, [tab, orders, stats]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">Orders containing your items, updated live.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Successful (delivered)" value={String(stats.delivered.length)} tone="primary" />
        <StatCard icon={RotateCcw} label="Returned / cancelled" value={String(stats.returned.length)} tone="destructive" />
        <StatCard icon={Clock} label="In progress" value={String(stats.active.length)} tone="saffron" />
        <StatCard icon={Package} label="Delivered revenue" value={formatINR(stats.revenue)} tone="primary" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "All"],
          ["delivered", "Successful"],
          ["returned", "Returned"],
          ["active", "In progress"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === key ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No orders here yet.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">#{o.id} · {o.customerName}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {o.refunded && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">Refunded</span>}
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${statusClass(o)}`}>{STATUS_LABEL[o.status]}</span>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {o.items.map((it) => (
                  <li key={it.productId} className="flex items-center justify-between">
                    <span>{it.name} <span className="text-muted-foreground">× {it.qty}</span></span>
                    <span className="font-semibold">{formatINR(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end border-t border-border pt-2 text-sm font-bold">
                Your items total: {formatINR(o.supplierTotal)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone: "primary" | "destructive" | "saffron" }) {
  const toneClass = tone === "destructive" ? "text-destructive" : tone === "saffron" ? "text-saffron-foreground" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className={`h-5 w-5 ${toneClass}`} />
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
