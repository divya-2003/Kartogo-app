import { Store, Home, Truck } from "lucide-react";
import type { OrderStatus } from "@/lib/store";

// Maps each lifecycle status to how far along the route the delivery is.
const PROGRESS: Record<Exclude<OrderStatus, "cancelled">, number> = {
  placed: 8,
  packed: 35,
  out_for_delivery: 70,
  delivered: 100,
};

const ETA_LABEL: Record<Exclude<OrderStatus, "cancelled">, string> = {
  placed: "Preparing your order",
  packed: "Packed — dispatching soon",
  out_for_delivery: "On the way to you",
  delivered: "Delivered",
};

export function DeliveryProgress({ status, eta }: { status: OrderStatus; eta?: string | null }) {
  if (status === "cancelled") return null;
  const pct = PROGRESS[status];
  const moving = status === "out_for_delivery";
  const delivered = status === "delivered";

  return (
    <div className="mt-4 rounded-xl border border-border bg-gradient-to-r from-primary/5 to-saffron/5 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Store className="h-4 w-4" /> Store</span>
        <span className="text-primary">{STATUS_LABEL[status]}{eta ? ` · ${eta}` : ""}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">Home <Home className="h-4 w-4" /></span>
      </div>


      <div className="relative h-2 rounded-full bg-secondary">
        {/* Filled track */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Animated delivery icon riding the track */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          <div
            className={`grid h-8 w-8 place-items-center rounded-full border-2 border-primary bg-card text-primary shadow-pop ${
              moving ? "animate-bounce" : ""
            }`}
          >
            <Truck className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="mt-3 text-center text-xs font-medium text-muted-foreground">
        {delivered ? "Your order has arrived 🎉" : moving ? "Hang tight, your rider is almost there!" : "We'll keep this updated live."}
      </div>
    </div>
  );
}
