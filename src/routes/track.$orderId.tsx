import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  HelpCircle,
  Store,
  Home,
  Bike,
  Check,
  MessageSquare,
  Phone,
  Star,
  Navigation,
} from "lucide-react";
import { useAuth, useOrders, useCatalog, DELIVERY_BOYS, type OrderStatus } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { etaText } from "@/lib/eta";
import { useOrderTracking } from "@/hooks/use-dispatch";
import { initiateMaskedCallFn } from "@/lib/chat.functions";
import { OrderChat } from "@/components/OrderChat";
import { mapLink } from "@/lib/logistics/geo";

export const Route = createFileRoute("/track/$orderId")({
  component: TrackOrderPage,
  head: () => ({
    meta: [
      { title: "Track your order — Kartogo" },
      { name: "description", content: "Live map, rider details and delivery progress for your ongoing Kartogo order." },
      { property: "og:title", content: "Track your order — Kartogo" },
      { property: "og:description", content: "Follow your Kartogo delivery live from the store to your door." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

const HEADLINE: Record<OrderStatus, { title: string; sub: string }> = {
  placed: { title: "Order placed", sub: "The store is getting your items together." },
  packed: { title: "Packed & ready", sub: "Your bag is packed, a rider is picking it up." },
  out_for_delivery: { title: "On the way", sub: "Your order is zipping through the streets." },
  delivered: { title: "Delivered", sub: "Your order has arrived. Enjoy!" },
  cancelled: { title: "Cancelled", sub: "This order was cancelled." },
};

/** Decorative street map with the rider riding a smooth curved route. */
const ROUTE_D =
  "M60 196 C 110 196, 120 150, 168 142 S 236 138, 258 104 S 292 66, 336 58";

function RouteMap({ progress, moving }: { progress: number; moving: boolean }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 60, y: 196 });

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const t = Math.min(1, Math.max(0, progress / 100));
    const p = path.getPointAtLength(path.getTotalLength() * t);
    setPos({ x: p.x, y: p.y });
  }, [progress]);

  return (
    <div className="relative h-56 w-full overflow-hidden bg-secondary/60 sm:h-72">
      <svg viewBox="0 0 400 240" className="h-full w-full" preserveAspectRatio="none">
        <rect width="400" height="240" className="fill-muted" />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={`h${i}`} x="0" y={i * 28 + 10} width="400" height="8" className="fill-background/70" />
        ))}
        {Array.from({ length: 13 }).map((_, i) => (
          <rect key={`v${i}`} x={i * 32 + 8} y="0" width="8" height="240" className="fill-background/70" />
        ))}
        <path d={ROUTE_D} className="stroke-primary/25" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path
          ref={pathRef}
          d={ROUTE_D}
          className="stroke-primary"
          strokeWidth="5"
          strokeDasharray="14 12"
          fill="none"
          strokeLinecap="round"
        />

        {/* Store */}
        <g>
          <circle cx="60" cy="196" r="13" className="fill-card stroke-primary" strokeWidth="2.5" />
        </g>
        {/* Home */}
        <circle cx="336" cy="58" r="13" className="fill-card stroke-primary" strokeWidth="2.5" />

        {/* Rider marker rides exactly on the curve */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r="15"
          className={`fill-primary ${moving ? "animate-pulse" : ""}`}
          style={{ transition: "cx 700ms ease-out, cy 700ms ease-out" }}
        />
      </svg>

      <span
        className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center text-primary-foreground transition-[left,top] duration-700 ease-out"
        style={{ left: `${(pos.x / 400) * 100}%`, top: `${(pos.y / 240) * 100}%` }}
      >
        <Bike className="h-4 w-4" />
      </span>
      <span
        className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center text-primary"
        style={{ left: `${(60 / 400) * 100}%`, top: `${(196 / 240) * 100}%` }}
      >
        <Store className="h-3.5 w-3.5" />
      </span>
      <span
        className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center text-primary"
        style={{ left: `${(336 / 400) * 100}%`, top: `${(58 / 240) * 100}%` }}
      >
        <Home className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}


function TrackOrderPage() {
  const { orderId } = Route.useParams();
  const { user, customerToken } = useAuth();
  const { orders } = useOrders();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const { snapshot } = useOrderTracking(customerToken, order ? orderId : null);

  const eta = order ? etaText(order.status, order.updatedAt ?? order.createdAt) : null;
  const activeIndex = order ? STEPS.findIndex((s) => s.key === order.status) : -1;
  const progress = [16, 40, 66, 92][Math.max(activeIndex, 0)] ?? 16;

  const rider = useMemo(() => {
    if (snapshot?.driver) {
      return {
        name: snapshot.driver.name,
        rating: snapshot.driver.rating,
        deliveries: null as number | null,
        live: snapshot.driver.location ?? null,
      };
    }
    const boy = DELIVERY_BOYS.find((b) => b.id === order?.deliveryBoyId);
    return boy ? { name: boy.name, rating: 4.8, deliveries: null, live: null } : null;
  }, [snapshot, order?.deliveryBoyId]);

  const call = async () => {
    if (!customerToken || !order) return;
    try {
      const res = await initiateMaskedCallFn({ data: { token: customerToken, orderId: order.id } });
      toast.success(res.message);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Please log in</h1>
        <Link to="/login" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Go to login
        </Link>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Order not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">This order isn't in your list any more.</p>
        <Link to="/orders" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          My orders
        </Link>
      </main>
    );
  }

  const head = HEADLINE[order.status];

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background pb-10">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => void navigate({ to: "/orders" })}
          className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-primary/50 text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-lg font-bold text-primary">Order {order.id}</h1>
        <Link to="/support" aria-label="Help" className="grid h-9 w-9 place-items-center rounded-full border border-border text-primary">
          <HelpCircle className="h-4 w-4" />
        </Link>
      </div>

      {/* Map */}
      <div className="relative">
        <RouteMap progress={progress} moving={order.status === "out_for_delivery"} />
        {eta && (
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-pop">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
            {eta}
          </span>
        )}
      </div>

      {/* Sheet */}
      <section className="relative -mt-4 rounded-t-3xl border-t border-border bg-card px-4 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-secondary" />

        <h2 className="text-center font-display text-2xl font-bold">{head.title}</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">{head.sub}</p>

        {/* Step tracker */}
        <div className="relative mt-6 flex items-start justify-between">
          <div className="absolute left-[12%] right-[12%] top-4 h-0.5 bg-secondary" />
          <div
            className="absolute left-[12%] top-4 h-0.5 bg-primary transition-[width] duration-700"
            style={{ width: `${(Math.max(activeIndex, 0) / (STEPS.length - 1)) * 76}%` }}
          />
          {STEPS.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <div key={s.key} className="relative z-10 flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {active && order.status === "out_for_delivery" ? <Bike className="h-4 w-4" /> : done || active ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
                <span className={`text-[11px] font-semibold ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rider card */}
        {rider && order.status !== "delivered" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Bike className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{rider.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-saffron text-saffron" />
                {rider.rating.toFixed(1)} Rating
                <span className="text-muted-foreground">· Number is private</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rider.live && (
                <a
                  href={mapLink(rider.live)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Live map"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
                >
                  <Navigation className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                aria-label="Chat with rider"
                onClick={() => setChatOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Call rider"
                onClick={() => void call()}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <Phone className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Order summary */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Order summary ({order.items.length} items)
        </h3>
        <div className="mt-2 space-y-2">
          {order.items.map((i) => {
            const p = products.find((x) => x.id === i.productId);
            return (
              <div key={i.productId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary/60">
                  {p?.image ? (
                    <img src={p.image} alt={i.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-xl">{p?.emoji ?? "📦"}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p?.unit ? `${p.unit} · ` : ""}
                    {formatINR(i.price)}
                  </p>
                </div>
                <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-bold">x{i.qty}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-semibold text-muted-foreground">Total</span>
          <span className="font-display text-xl font-bold">{formatINR(order.total)}</span>
        </div>
      </section>

      {chatOpen && customerToken && (
        <OrderChat
          token={customerToken}
          orderId={order.id}
          myRole="customer"
          peerLabel="Delivery partner"
          onClose={() => setChatOpen(false)}
        />
      )}
    </main>
  );
}
