import { Store, Home, Truck, CheckCircle2, Package, ClipboardCheck, MapPin } from "lucide-react";
import type { OrderStatus } from "@/lib/store";

// Maps each lifecycle status to how far along the route the delivery is.
const PROGRESS: Record<Exclude<OrderStatus, "cancelled">, number> = {
  placed: 8,
  packed: 35,
  out_for_delivery: 70,
  delivered: 100,
};

const STATUS_LABEL: Record<Exclude<OrderStatus, "cancelled">, string> = {
  placed: "Preparing your order",
  packed: "Packed — dispatching soon",
  out_for_delivery: "On the way to you",
  delivered: "Delivered",
};

// Ordered steps shown in the visual tracker.
const STEPS: { key: Exclude<OrderStatus, "cancelled">; label: string; icon: typeof Package }[] = [
  { key: "placed", label: "Order Placed", icon: ClipboardCheck },
  { key: "packed", label: "Packing", icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Arrived", icon: MapPin },
];

const STEP_ORDER: OrderStatus[] = ["placed", "packed", "out_for_delivery", "delivered"];

export function DeliveryProgress({ status, eta }: { status: OrderStatus; eta?: string | null }) {
  if (status === "cancelled") return null;
  const pct = PROGRESS[status];
  const moving = status === "out_for_delivery";
  const delivered = status === "delivered";
  const activeIndex = STEP_ORDER.indexOf(status);

  return (
    <div className="mt-4 rounded-xl border border-border bg-gradient-to-r from-primary/5 to-saffron/5 p-4">
      {/* Step tracker */}
      <div className="relative flex items-start justify-between">
        {/* Connecting line (behind the nodes) */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-secondary" style={{ marginLeft: "12.5%", marginRight: "12.5%" }} />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-[width] duration-700 ease-out"
          style={{ marginLeft: "12.5%", width: `${(Math.max(activeIndex, 0) / (STEPS.length - 1)) * 75}%` }}
        />

        {STEPS.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          const Icon = isDone ? CheckCircle2 : step.icon;
          return (
            <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors duration-500 ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-pop"
                    : isDone
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {/* Pulse ring on the active step */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" aria-hidden />
                )}
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`text-center text-[10px] font-semibold leading-tight ${
                  isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 mb-3 flex items-center justify-between text-xs font-semibold">
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
