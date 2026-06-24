import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DELIVERY_BOYS, useOrders, type Order } from "@/lib/store";
import { Bike, Phone, CircleDot } from "lucide-react";

export const Route = createFileRoute("/admin/delivery")({ component: DeliveryAdmin });

type Availability = "active" | "on_delivery" | "offline";

const META: Record<Availability, { label: string; dot: string; chip: string }> = {
  active: { label: "Active", dot: "text-leaf", chip: "bg-leaf/15 text-leaf" },
  on_delivery: { label: "On Delivery", dot: "text-saffron", chip: "bg-saffron/20 text-saffron-foreground" },
  offline: { label: "Offline", dot: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

function DeliveryAdmin() {
  const { orders } = useOrders();
  const [filter, setFilter] = useState<"all" | Availability>("all");

  const riders = useMemo(() => {
    return DELIVERY_BOYS.map(d => {
      const inProgress = orders.filter(
        o => o.deliveryBoyId === d.id && o.status !== "delivered" && o.status !== "cancelled",
      );
      const availability: Availability = !d.active
        ? "offline"
        : inProgress.length > 0
          ? "on_delivery"
          : "active";
      return { ...d, inProgress, availability };
    });
  }, [orders]);

  const counts = useMemo(
    () => ({
      active: riders.filter(r => r.availability === "active").length,
      on_delivery: riders.filter(r => r.availability === "on_delivery").length,
      offline: riders.filter(r => r.availability === "offline").length,
    }),
    [riders],
  );

  const visible = filter === "all" ? riders : riders.filter(r => r.availability === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Delivery team</h1>
        <p className="text-sm text-muted-foreground">Live rider availability — assign at a glance.</p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(["active", "on_delivery", "offline"] as Availability[]).map(a => (
          <button
            key={a}
            onClick={() => setFilter(filter === a ? "all" : a)}
            className={`rounded-2xl border p-3 text-left transition ${filter === a ? "border-primary ring-1 ring-primary/30" : "border-border hover:bg-secondary/50"} bg-card`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CircleDot className={`h-3.5 w-3.5 ${META[a].dot}`} /> {META[a].label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{counts[a]}</div>
          </button>
        ))}
      </div>

      {filter !== "all" && (
        <button onClick={() => setFilter("all")} className="text-xs font-semibold text-primary">← Show all riders</button>
      )}

      {/* Rider cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map(d => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Bike className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-display text-base font-bold">{d.name}</div>
                <a href={`tel:${d.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Phone className="h-3 w-3" /> {d.phone}</a>
              </div>
              <span className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${META[d.availability].chip}`}>
                <CircleDot className="h-3 w-3" /> {META[d.availability].label}
              </span>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">In-progress orders</div>
              <div className="font-display text-2xl font-bold">{d.inProgress.length}</div>
              {d.inProgress.length > 0 ? (
                <ul className="mt-1 text-xs text-muted-foreground">
                  {d.inProgress.slice(0, 3).map((o: Order) => <li key={o.id}>{o.id} · {o.customerName}</li>)}
                  {d.inProgress.length > 3 && <li>+{d.inProgress.length - 3} more</li>}
                </ul>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.availability === "offline" ? "Not on shift" : "Available to assign"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No riders in this state.</div>
      )}
    </div>
  );
}
