import { createFileRoute, Link } from "@tanstack/react-router";
import { useCatalog, useOrders, useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { IndianRupee, ShoppingBag, AlertTriangle, Truck, ShieldCheck, PackageX } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const { products } = useCatalog();
  const { orders } = useOrders();
  const { adminAudit } = useAuth();
  const today = new Date(); today.setHours(0,0,0,0);
  const todays = orders.filter(o => o.createdAt >= today.getTime());
  const revenue = todays.reduce((s, o) => s + o.total, 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5);
  const pending = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const refundsDue = cancelled.filter(o => o.paymentMethod === "upi" && !o.refunded);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's snapshot for Kartigo Ongole</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={<IndianRupee className="h-5 w-5" />} label="Today's revenue" value={formatINR(revenue)} />
        <Stat icon={<ShoppingBag className="h-5 w-5" />} label="Today's orders" value={String(todays.length)} />
        <Stat icon={<Truck className="h-5 w-5" />} label="Pending orders" value={String(pending.length)} accent />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} label="Low stock" value={String(lowStock.length)} warn />
      </div>

      {cancelled.length > 0 && (
        <Link to="/admin/cancellations" className="block rounded-2xl border border-destructive/40 bg-destructive/10 p-4 transition hover:bg-destructive/15">
          <div className="flex flex-wrap items-center gap-3">
            <PackageX className="h-6 w-6 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-display font-bold text-destructive">
                {cancelled.length} cancelled order{cancelled.length > 1 ? "s" : ""} — do not pack
              </p>
              <p className="text-xs text-muted-foreground">
                {refundsDue.length > 0
                  ? `${refundsDue.length} prepaid refund${refundsDue.length > 1 ? "s" : ""} pending · ${formatINR(refundsDue.reduce((s, o) => s + o.total, 0))}`
                  : "No refunds pending."}
              </p>
            </div>
            <span className="ml-auto rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground">Review</span>
          </div>
        </Link>
      )}



      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Recent orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-primary">View all</Link>
          </div>
          {orders.slice(0, 5).length === 0 ? (
            <div className="text-sm text-muted-foreground">No orders yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {orders.slice(0, 5).map(o => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">{o.id} · {o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.items.length} item · {o.status.replace(/_/g, " ")}</div>
                  </div>
                  <div className="font-display font-bold">{formatINR(o.total)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Low stock alerts</h2>
            <Link to="/admin/inventory" className="text-xs font-semibold text-primary">Manage</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-sm text-muted-foreground">All items well-stocked. ✨</div>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2"><span className="text-xl">{p.emoji}</span><span className="font-semibold">{p.name}</span></div>
                  <span className="rounded-md bg-saffron/30 px-2 py-0.5 text-xs font-bold">{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Admin login audit</h2>
          <span className="text-xs text-muted-foreground">{adminAudit.length} entries</span>
        </div>
        {adminAudit.length === 0 ? (
          <div className="text-sm text-muted-foreground">No admin logins recorded yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {adminAudit.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono font-semibold">+91 {e.phone}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, accent, warn }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${warn ? "border-saffron bg-saffron/10" : accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
