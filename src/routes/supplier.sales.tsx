import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, PackageCheck, IndianRupee, Boxes } from "lucide-react";
import { listSupplierOrdersFn, type SupplierOrder } from "@/lib/supplier.functions";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/supplier/sales")({ component: SupplierSales });

type Bucket = { key: string; label: string; sort: number };
type Row = { productId: string; name: string; units: number; revenue: number };

// ISO-ish week key so weekly buckets are stable across month boundaries.
function weekBucket(d: Date): Bucket {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (tmp.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(tmp);
  monday.setDate(tmp.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return {
    key: `w-${monday.toISOString().slice(0, 10)}`,
    label: `${fmt(monday)} – ${fmt(sunday)}`,
    sort: monday.getTime(),
  };
}

function monthBucket(d: Date): Bucket {
  return {
    key: `m-${d.getFullYear()}-${d.getMonth()}`,
    label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    sort: d.getFullYear() * 12 + d.getMonth(),
  };
}

function SupplierSales() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"month" | "week">("month");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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

  // Only fulfilled (delivered, non-refunded) orders count as sales.
  const groups = useMemo(() => {
    const sold = orders.filter(o => o.status === "delivered" && !o.refunded);
    const map = new Map<string, { bucket: Bucket; rows: Map<string, Row>; units: number; revenue: number }>();
    for (const o of sold) {
      const d = new Date(o.createdAt);
      const bucket = mode === "month" ? monthBucket(d) : weekBucket(d);
      let g = map.get(bucket.key);
      if (!g) { g = { bucket, rows: new Map(), units: 0, revenue: 0 }; map.set(bucket.key, g); }
      for (const i of o.items) {
        const revenue = Number(i.price) * Number(i.qty);
        const row = g.rows.get(i.productId) ?? { productId: i.productId, name: i.name, units: 0, revenue: 0 };
        row.units += Number(i.qty);
        row.revenue += revenue;
        g.rows.set(i.productId, row);
        g.units += Number(i.qty);
        g.revenue += revenue;
      }
    }
    return [...map.values()]
      .sort((a, b) => b.bucket.sort - a.bucket.sort)
      .map(g => ({ ...g, rows: [...g.rows.values()].sort((a, b) => b.units - a.units) }));
  }, [orders, mode]);

  const totals = useMemo(() => ({
    units: groups.reduce((s, g) => s + g.units, 0),
    revenue: groups.reduce((s, g) => s + g.revenue, 0),
    products: new Set(groups.flatMap(g => g.rows.map(r => r.productId))).size,
  }), [groups]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Sales by product</h1>
          <p className="text-sm text-muted-foreground">
            How many units of each of your inventory items customers bought, with the total selling value.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
          {(["month", "week"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${mode === m ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {m === "month" ? "Month wise" : "Week wise"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={PackageCheck} label="Units sold" value={String(totals.units)} />
        <Stat icon={Boxes} label="Products sold" value={String(totals.products)} />
        <Stat icon={IndianRupee} label="Total sales value" value={formatINR(totals.revenue)} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading sales…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No delivered sales yet for your categories.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <section key={g.bucket.key} className="overflow-hidden rounded-2xl border border-border bg-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                <div className="flex items-center gap-2 font-display text-base font-bold">
                  <BarChart3 className="h-4 w-4 text-primary" /> {g.bucket.label}
                </div>
                <div className="text-sm font-bold">
                  {g.units} unit{g.units === 1 ? "" : "s"} · <span className="text-primary">{formatINR(g.revenue)}</span>
                </div>
              </header>

              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 w-32">Units sold</th>
                      <th className="px-4 py-2 w-40">Total selling cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.rows.map(r => (
                      <tr key={r.productId}>
                        <td className="px-4 py-2 font-semibold">{r.name}</td>
                        <td className="px-4 py-2">{r.units}</td>
                        <td className="px-4 py-2 font-bold">{formatINR(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <ul className="divide-y divide-border md:hidden">
                {g.rows.map(r => (
                  <li key={r.productId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.units} unit{r.units === 1 ? "" : "s"} sold</div>
                    </div>
                    <div className="shrink-0 font-bold">{formatINR(r.revenue)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-2 font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
