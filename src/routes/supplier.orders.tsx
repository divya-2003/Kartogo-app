import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listSupplierOrdersFn, supplierMarkPackedFn, type SupplierOrder } from "@/lib/supplier.functions";
import { formatINR } from "@/lib/data";
import { CheckCircle2, RotateCcw, Clock, Package, Replace } from "lucide-react";
import { toast } from "sonner";
import { suggestSubstitutionFn } from "@/lib/substitutions.functions";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getToken = (): string | null => {
    try { return JSON.parse(localStorage.getItem("qk_supplier_token") || "null"); } catch { return null; }
  };

  const markPacked = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await supplierMarkPackedFn({ data: { token, id } });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "packed" } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order");
    } finally {
      setBusyId(null);
    }
  };

  // Block 5 — offer the customer a replacement for an item we cannot pack.
  const offerReplacement = async (
    orderId: string,
    it: { productId: string; name: string; qty: number; price: number },
  ) => {
    const token = getToken();
    if (!token) return;
    const replacementName = prompt(`Replacement for "${it.name}"`, "");
    if (!replacementName || !replacementName.trim()) return;
    const priceRaw = prompt(`Price per unit for "${replacementName.trim()}" (₹)`, String(it.price));
    if (priceRaw === null) return;
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) { toast.error("Enter a valid price"); return; }
    const note = prompt("Note for the customer (optional)", "") ?? "";
    try {
      await suggestSubstitutionFn({ data: {
        token,
        orderId,
        productId: it.productId,
        productName: it.name,
        quantity: it.qty,
        originalPrice: it.price,
        replacementName: replacementName.trim(),
        replacementPrice: price,
        note: note.trim() || null,
      }});
      toast.success("Replacement sent to the customer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the replacement");
    }
  };

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

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}

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
                  <li key={it.productId} className="flex items-center justify-between gap-2">
                    <span>{it.name} <span className="text-muted-foreground">× {it.qty}</span></span>
                    <span className="flex items-center gap-2">
                      {(o.status === "placed" || o.status === "packed") && (
                        <button
                          onClick={() => offerReplacement(o.id, it)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                        >
                          <Replace className="h-3 w-3" /> Replace
                        </button>
                      )}
                      <span className="font-semibold">{formatINR(it.price * it.qty)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm font-bold">
                <div>
                  {o.status === "placed" ? (
                    <button
                      onClick={() => markPacked(o.id)}
                      disabled={busyId === o.id}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busyId === o.id ? "Marking…" : "Mark as packed"}
                    </button>
                  ) : null}
                </div>
                <span>Your items total: {formatINR(o.supplierTotal)}</span>
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
