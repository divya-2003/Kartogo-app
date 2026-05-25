import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOrders, DELIVERY_BOYS, type OrderStatus } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({ component: OrdersAdmin });

const STATUSES: { key: OrderStatus; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function OrdersAdmin() {
  const { orders, setStatus, assign } = useOrders();
  const [tab, setTab] = useState<"all" | OrderStatus>("all");

  const filtered = tab === "all" ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">{orders.length} total · {orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length} pending</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={tab === "all"} onClick={() => setTab("all")} label={`All (${orders.length})`} />
        {STATUSES.map(s => (
          <Chip key={s.key} active={tab === s.key} onClick={() => setTab(s.key)} label={`${s.label} (${orders.filter(o => o.status === s.key).length})`} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No orders here.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <article key={o.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-base font-bold">{o.id} <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 text-xs">{o.status.replace(/_/g, " ")}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")} · {o.customerName} · {o.customerPhone}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                  <div className="text-xs uppercase text-muted-foreground">{o.paymentMethod}</div>
                </div>
              </header>

              <ul className="my-3 grid gap-1 text-sm md:grid-cols-2">
                {o.items.map(i => <li key={i.productId} className="text-muted-foreground">{i.name} × <span className="font-semibold text-foreground">{i.qty}</span></li>)}
              </ul>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground">Status</label>
                <select value={o.status} onChange={e => { setStatus(o.id, e.target.value as OrderStatus); toast.success("Status updated"); }} className="rounded-lg border border-input bg-background px-2 py-1 text-sm">
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>

                <label className="ml-2 text-xs font-semibold text-muted-foreground">Delivery</label>
                <select value={o.deliveryBoyId ?? ""} onChange={e => { assign(o.id, e.target.value); toast.success("Delivery partner assigned"); }} className="rounded-lg border border-input bg-background px-2 py-1 text-sm">
                  <option value="">— Assign rider —</option>
                  {DELIVERY_BOYS.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>{label}</button>;
}
