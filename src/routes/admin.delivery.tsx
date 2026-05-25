import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_BOYS, useOrders } from "@/lib/store";
import { Bike, Phone } from "lucide-react";

export const Route = createFileRoute("/admin/delivery")({ component: DeliveryAdmin });

function DeliveryAdmin() {
  const { orders } = useOrders();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Delivery team</h1>
        <p className="text-sm text-muted-foreground">Riders available in Ongole.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {DELIVERY_BOYS.map(d => {
          const active = orders.filter(o => o.deliveryBoyId === d.id && o.status !== "delivered" && o.status !== "cancelled");
          return (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Bike className="h-5 w-5" /></div>
                <div>
                  <div className="font-display text-base font-bold">{d.name}</div>
                  <a href={`tel:${d.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Phone className="h-3 w-3" /> {d.phone}</a>
                </div>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${d.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{d.active ? "Active" : "Off"}</span>
              </div>
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">In-progress orders</div>
                <div className="font-display text-2xl font-bold">{active.length}</div>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {active.slice(0, 3).map(o => <li key={o.id}>{o.id} · {o.customerName}</li>)}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
