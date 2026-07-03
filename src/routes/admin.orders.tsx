import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useOrders, useDrivers, type OrderStatus } from "@/lib/store";
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

// Statuses that make sense to apply in bulk (forward progression + cancel).
const BULK_STATUSES: OrderStatus[] = ["packed", "out_for_delivery", "delivered", "cancelled"];

// Forward progression chain and the action label for advancing to the next step.
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  placed: { next: "packed", label: "Mark as Packed" },
  packed: { next: "out_for_delivery", label: "Send Out for Delivery" },
  out_for_delivery: { next: "delivered", label: "Mark as Delivered" },
};

function OrdersAdmin() {
  const { orders, setStatus, assign } = useOrders();
  const [tab, setTab] = useState<"all" | OrderStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("packed");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => (tab === "all" ? orders : orders.filter(o => o.status === tab)),
    [orders, tab],
  );

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id));
  const toggleAll = () =>
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach(o => next.delete(o.id));
      } else {
        filtered.forEach(o => next.add(o.id));
      }
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const applyBulk = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    let ok = 0;
    const failures: string[] = [];
    for (const id of ids) {
      try {
        await setStatus(id, bulkStatus);
        ok++;
      } catch (error) {
        failures.push(`${id}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    setBusy(false);
    if (ok > 0) toast.success(`${ok} order${ok > 1 ? "s" : ""} marked ${bulkStatus.replace(/_/g, " ")}`);
    if (failures.length > 0) {
      toast.error(`${failures.length} could not be updated`, { description: failures[0] });
    }
    clearSelection();
  };

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

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
            Select all ({filtered.length})
          </label>
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 shadow-pop">
          <span className="text-sm font-bold text-primary">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Mark as</label>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value as OrderStatus)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            >
              {BULK_STATUSES.map(s => (
                <option key={s} value={s}>{STATUSES.find(x => x.key === s)?.label}</option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Updating…" : "Apply"}
            </button>
            <button
              onClick={clearSelection}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No orders here.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const isSelected = selected.has(o.id);
            return (
            <article key={o.id} className={`rounded-2xl border bg-card p-4 transition md:p-5 ${isSelected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    aria-label={`Select ${o.id}`}
                  />
                  <div>
                    <div className="font-display text-base font-bold">{o.id} <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 text-xs">{o.status.replace(/_/g, " ")}</span></div>
                    <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")} · {o.customerName} · {o.customerPhone}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                  {o.discount > 0 && (
                    <div className="text-xs font-medium text-primary">
                      {o.promoCode ? `${o.promoCode} · ` : ""}−{formatINR(o.discount)}
                    </div>
                  )}
                  <div className="text-xs uppercase text-muted-foreground">{o.paymentMethod}</div>
                </div>
              </header>

              <ul className="my-3 grid gap-1 text-sm md:grid-cols-2">
                {o.items.map(i => <li key={i.productId} className="text-muted-foreground">{i.name} × <span className="font-semibold text-foreground">{i.qty}</span></li>)}
              </ul>

              {(() => {
                const advance = NEXT_STATUS[o.status];
                if (!advance) return null;
                return (
                  <button
                    onClick={async () => {
                      try {
                        await setStatus(o.id, advance.next);
                        toast.success(advance.label.replace(/^Mark as |^Send /, "") + " ✓");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Status update failed");
                      }
                    }}
                    className="mb-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-pop transition hover:opacity-90 sm:w-auto"
                  >
                    {advance.label} →
                  </button>
                );
              })()}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground">Status</label>
                <select value={o.status} onChange={async e => {
                  try {
                    await setStatus(o.id, e.target.value as OrderStatus);
                    toast.success("Status updated");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Status update failed");
                  }
                }} className="rounded-lg border border-input bg-background px-2 py-1 text-sm">
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>

                <label className="ml-2 text-xs font-semibold text-muted-foreground">Delivery</label>
                <select value={o.deliveryBoyId ?? ""} onChange={async e => {
                  try {
                    await assign(o.id, e.target.value);
                    toast.success("Delivery partner assigned");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Delivery assignment failed");
                  }
                }} className="rounded-lg border border-input bg-background px-2 py-1 text-sm">
                  <option value="">— Assign rider —</option>
                  {DELIVERY_BOYS.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}>{label}</button>;
}
