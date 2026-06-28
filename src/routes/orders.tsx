import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { DeliveryProgress } from "@/components/DeliveryProgress";
import {
  useAuth,
  useOrders,
  useCart,
  useCatalog,
  useWallet,
  DELIVERY_BOYS,
  type OrderStatus,
  type Order,
} from "@/lib/store";
import { formatINR } from "@/lib/data";
import { etaText, formatDeliveryDuration } from "@/lib/eta";
import { paymentBreakdown, PAYMENT_LABELS } from "@/lib/payment";
import {
  CheckCircle2,
  Package,
  Truck,
  Clock,
  XCircle,
  ChevronRight,
  Zap,
  Download,
  AlertTriangle,
  MessageSquareWarning,
  Camera,
  X,
  Star,
} from "lucide-react";
import { downloadInvoice } from "@/lib/invoice";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
  validateSearch: (search: Record<string, unknown>): { open?: string; report?: number } => ({
    open: typeof search.open === "string" ? search.open : undefined,
    report: typeof search.report === "number" ? search.report : undefined,
  }),
  head: () => ({ meta: [{ title: "My orders — Kartigo" }] }),
});

const STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "placed", label: "Placed", icon: <Clock className="h-4 w-4" /> },
  { key: "packed", label: "Packed", icon: <Package className="h-4 w-4" /> },
  { key: "out_for_delivery", label: "Out for delivery", icon: <Truck className="h-4 w-4" /> },
  { key: "delivered", label: "Delivered", icon: <CheckCircle2 className="h-4 w-4" /> },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// One notification message per status. Covers the full lifecycle so the
// customer hears about every change the admin makes.
const STATUS_NOTICE: Record<OrderStatus, (id: string) => { title: string; description: string }> = {
  placed: (id) => ({ title: "Order placed", description: `${id} has been placed successfully.` }),
  packed: (id) => ({
    title: "Order packed",
    description: `${id} is packed and ready to dispatch.`,
  }),
  out_for_delivery: (id) => ({
    title: "Out for delivery",
    description: `${id} is on the way to you.`,
  }),
  delivered: (id) => ({
    title: "Order delivered",
    description: `${id} has been delivered. Enjoy!`,
  }),
  cancelled: (id) => ({ title: "Order cancelled", description: `${id} has been cancelled.` }),
};

const ACTIVE_TITLE: Record<Exclude<OrderStatus, "delivered" | "cancelled">, string> = {
  placed: "Order placed",
  packed: "Order packed",
  out_for_delivery: "Out for delivery",
};

function OrdersPage() {
  const { user } = useAuth();
  const { orders, refresh, cancel } = useOrders();
  const { refresh: refreshWallet } = useWallet();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const confirmCancel = async (reason: string) => {
    const o = cancelTarget;
    if (!o || o.status !== "placed") return;
    setCancelling(o.id);
    try {
      // The server verifies ownership, confirms the order is still cancellable,
      // and reverses any Kartigo Cash payment back into the wallet itself. The
      // client only refreshes its view of the authoritative balance.
      const cancelled = await cancel(o.id, reason);
      if (o.paymentMethod === "wallet" && o.total > 0 && cancelled.refunded) {
        void refreshWallet();
        toast.success(`Order cancelled · ${formatINR(o.total)} refunded to Kartigo Cash`);
      } else {
        toast.success("Order cancelled");
      }
      setCancelTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel order");
    } finally {
      setCancelling(null);
    }
  };
  const { products } = useCatalog();
  const { add, clear } = useCart();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Order | null>(null);
  const [rateTarget, setRateTarget] = useState<Order | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const { open: openParam, report: reportParam } = Route.useSearch();
  useEffect(() => {
    if (openParam) setOpenId(openParam);
  }, [openParam]);
  const [notices, setNotices] = useState<{ id: string; title: string; description: string }[]>([]);
  const userPhone = user?.phone;
  const previousOrdersRef = useRef(
    new Map<string, { status: OrderStatus; deliveryBoyId?: string }>(),
  );
  const notificationReadyRef = useRef(false);
  const notifiedRef = useRef(new Set<string>());

  const imageFor = (productId: string) => products.find((p) => p.id === productId)?.image;

  const notifyOnce = (key: string, title: string, description: string) => {
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    setNotices((prev) => [{ id: key, title, description }, ...prev].slice(0, 3));
    toast(title, { description, duration: 2000 });
    setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== key));
    }, 2000);
  };

  // Notify for any status change. When the order is out for delivery and a
  // driver is assigned, include the latest driver details in the message.
  // When delivered, include how long the order took from placed to delivered.
  const notifyStatus = (
    orderId: string,
    status: OrderStatus,
    deliveryBoyId?: string,
    placedAt?: number,
    deliveredAt?: number,
  ) => {
    const make = STATUS_NOTICE[status];
    if (!make) return;
    const base = make(orderId);
    let description = base.description;
    if (status === "out_for_delivery" && deliveryBoyId) {
      const boy = DELIVERY_BOYS.find((d) => d.id === deliveryBoyId);
      if (boy) description += ` Driver: ${boy.name} · ${boy.phone}`;
    }
    if (status === "delivered" && placedAt) {
      const duration = formatDeliveryDuration(placedAt, deliveredAt ?? Date.now());
      description += ` Delivered in ${duration}.`;
    }
    notifyOnce(`${orderId}:status:${status}`, base.title, description);
  };

  const notifyDriver = (orderId: string, deliveryBoyId?: string) => {
    if (!deliveryBoyId) return;
    const boy = DELIVERY_BOYS.find((d) => d.id === deliveryBoyId);
    if (!boy) return;
    notifyOnce(
      `${orderId}:driver:${deliveryBoyId}`,
      "Delivery partner assigned",
      `${boy.name} · ${boy.phone}`,
    );
  };

  useEffect(() => {
    if (userPhone) void refresh(userPhone);
  }, [refresh, userPhone]);

  // Short polling fallback: keep refreshing every few seconds while any of the
  // current user's orders are still in a non-final state. Stops automatically
  // once every order reaches "delivered" or "cancelled".
  const FINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];
  const hasActiveOrders =
    !!userPhone &&
    orders.some((o) => o.customerPhone === userPhone && !FINAL_STATUSES.includes(o.status));

  useEffect(() => {
    if (!hasActiveOrders || !userPhone) return;
    const id = window.setInterval(() => {
      void refresh(userPhone);
    }, 2000);
    return () => window.clearInterval(id);
  }, [hasActiveOrders, refresh, userPhone]);

  const mine = useMemo(
    () => orders.filter((o) => o.customerPhone === userPhone),
    [orders, userPhone],
  );

  // If the user lands here from the Refund & Returns CTA, open the report
  // issue modal for their most recent order and clean the search param.
  useEffect(() => {
    if (reportParam && mine.length > 0 && !reportTarget) {
      setReportTarget(mine[0]);
      navigate({ to: "/orders", search: {}, replace: true });
    }
  }, [reportParam, mine, navigate, reportTarget]);

  // Detect status/driver changes from the polled order list (order PII is no
  // longer broadcast over realtime). Notify once per transition, then remember
  // the latest state so we don't re-notify on the next poll.
  useEffect(() => {
    if (!userPhone) return;
    const prevMap = previousOrdersRef.current;
    for (const o of mine) {
      const previous = prevMap.get(o.id);
      // Skip the very first observation of an order to avoid replaying history.
      if (notificationReadyRef.current) {
        if (o.status && (!previous || previous.status !== o.status)) {
          notifyStatus(o.id, o.status, o.deliveryBoyId, o.createdAt, o.updatedAt ?? Date.now());
        }
        if (o.deliveryBoyId && (!previous || previous.deliveryBoyId !== o.deliveryBoyId)) {
          notifyDriver(o.id, o.deliveryBoyId);
        }
      }
      prevMap.set(o.id, { status: o.status, deliveryBoyId: o.deliveryBoyId });
    }
    notificationReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, userPhone]);

  // When each order entered its CURRENT status (from the order status log).
  // Used to estimate arrival time. Keyed by order id.
  const [statusSince, setStatusSince] = useState<Record<string, number>>({});
  // Tick so the "Arriving in X mins" countdown stays fresh.
  const [now, setNow] = useState(() => Date.now());

  const mineKey = mine.map((o) => `${o.id}:${o.status}`).join(",");

  useEffect(() => {
    const ids = mine.map((o) => o.id);
    if (ids.length === 0) {
      setStatusSince({});
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("order_status_log")
        .select("order_id,to_status,changed_at")
        .in("order_id", ids)
        .order("changed_at", { ascending: false });
      if (error || !data || !active) return;
      const byOrder: Record<string, number> = {};
      const statusById = new Map(mine.map((o) => [o.id, o.status]));
      for (const row of data as {
        order_id: string;
        to_status: OrderStatus;
        changed_at: string;
      }[]) {
        // First match (latest, since ordered desc) for the order's current status.
        if (byOrder[row.order_id] !== undefined) continue;
        if (row.to_status === statusById.get(row.order_id)) {
          byOrder[row.order_id] = new Date(row.changed_at).getTime();
        }
      }
      setStatusSince(byOrder);
    })();
    return () => {
      active = false;
    };
  }, [mineKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const nextSnapshot = new Map<string, { status: OrderStatus; deliveryBoyId?: string }>();

    for (const order of mine) {
      nextSnapshot.set(order.id, {
        status: order.status,
        deliveryBoyId: order.deliveryBoyId,
      });
    }

    if (!notificationReadyRef.current) {
      previousOrdersRef.current = nextSnapshot;
      notificationReadyRef.current = true;
      return;
    }

    for (const order of mine) {
      const previous = previousOrdersRef.current.get(order.id);

      if (previous && previous.status !== order.status) {
        const placedAt = order.createdAt ? new Date(order.createdAt).getTime() : undefined;
        const deliveredAt = statusSince[order.id] ?? Date.now();
        notifyStatus(order.id, order.status, order.deliveryBoyId, placedAt, deliveredAt);
      }

      if (previous && previous.deliveryBoyId !== order.deliveryBoyId && order.deliveryBoyId) {
        notifyDriver(order.id, order.deliveryBoyId);
      }
    }

    previousOrdersRef.current = nextSnapshot;
  }, [mine]);

  const orderAgain = (o: Order) => {
    clear();
    o.items.forEach((i) => add(i.productId, i.qty));
    toast.success("Items added to your cart");
    navigate({ to: "/cart" });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link
            to="/login"
            className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
          >
            Login with OTP
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <Header />
      {notices.length > 0 && (
        <div className="fixed left-1/2 top-20 z-50 w-[min(92vw,420px)] -translate-x-1/2 space-y-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-xl border border-primary/25 bg-card p-3 text-sm shadow-pop"
            >
              <div className="font-bold text-primary">{notice.title}</div>
              <div className="text-muted-foreground">{notice.description}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mx-auto max-w-2xl px-3 py-5 md:px-4 md:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold md:text-3xl">Your Orders</h1>
        </div>

        {mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="font-semibold">No orders yet</div>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {mine.map((o) => {
              const cancelled = o.status === "cancelled";
              const delivered = o.status === "delivered";
              const active = !cancelled && !delivered;
              const boy = DELIVERY_BOYS.find((d) => d.id === o.deliveryBoyId);
              const open = openId === o.id;
              const mrpTotal = o.items.reduce((s, i) => {
                const p = products.find((p) => p.id === i.productId);
                return s + (p?.mrp ?? i.price) * i.qty;
              }, 0);
              const deliveredDuration = delivered
                ? formatDeliveryDuration(
                    o.createdAt,
                    statusSince[o.id] ?? o.updatedAt ?? Date.now(),
                  )
                : null;

              return (
                <article
                  key={o.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  {/* Summary row — tap to expand */}
                  <button
                    onClick={() => setOpenId(open ? null : o.id)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {cancelled ? (
                          <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                        ) : delivered ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf" />
                        ) : (
                          <Truck className="h-5 w-5 shrink-0 text-primary" />
                        )}
                        <span className="font-display text-base font-bold">
                          {cancelled
                            ? "Order cancelled"
                            : delivered
                              ? "Order delivered"
                              : ACTIVE_TITLE[
                                  o.status as Exclude<OrderStatus, "delivered" | "cancelled">
                                ]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Placed at{" "}
                        {new Date(o.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-2">
                      <span className="font-display text-base font-bold">{formatINR(o.total)}</span>
                      <ChevronRight
                        className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Thumbnails strip */}
                  <div className="flex gap-2 overflow-x-auto px-4 pb-4">
                    {o.items.map((i) => {
                      const img = imageFor(i.productId);
                      return (
                        <div
                          key={i.productId}
                          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-secondary/50"
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={i.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xl">📦</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Live tracking for active orders */}
                  {active && (
                    <div className="px-4 pb-4">
                      <DeliveryProgress
                        status={o.status}
                        eta={etaText(o.status, statusSince[o.id], now)}
                      />
                      {boy && (
                        <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                          Delivery partner: <span className="font-semibold">{boy.name}</span> ·{" "}
                          <a className="text-primary" href={`tel:${boy.phone}`}>
                            {boy.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded detail — bill summary */}
                  {open && (
                    <div className="border-t border-border px-4 py-4">
                      {delivered && (
                        <div className="mb-4 flex items-center justify-between rounded-xl bg-leaf/10 px-3 py-2.5">
                          <span className="flex items-center gap-2 font-bold text-leaf">
                            <CheckCircle2 className="h-5 w-5" /> Delivered
                          </span>
                          {deliveredDuration && (
                            <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                              <Zap className="h-3.5 w-3.5" /> Arrived in {deliveredDuration}
                            </span>
                          )}
                        </div>
                      )}
                      {cancelled && (
                        <div className="mb-4 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                          <div className="flex items-center gap-2 font-semibold">
                            <XCircle className="h-5 w-5" /> Order cancelled
                          </div>
                          {o.cancelReason && (
                            <div className="mt-1 pl-7 text-xs">Reason: {o.cancelReason}</div>
                          )}
                        </div>
                      )}

                      <div className="mb-2 text-sm font-bold">
                        {o.items.length} {o.items.length === 1 ? "item" : "items"} in order
                      </div>
                      <ul className="space-y-3">
                        {o.items.map((i) => {
                          const p = products.find((p) => p.id === i.productId);
                          const img = imageFor(i.productId);
                          const hasDiscount = p?.mrp && p.mrp > i.price;
                          return (
                            <li key={i.productId} className="flex items-center gap-3">
                              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary/50">
                                {img ? (
                                  <img
                                    src={img}
                                    alt={i.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>📦</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{i.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p?.unit ?? ""} · {i.qty} unit{i.qty > 1 ? "s" : ""}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">
                                  {formatINR(i.price * i.qty)}
                                </div>
                                {hasDiscount && (
                                  <div className="text-xs text-muted-foreground line-through">
                                    {formatINR(p!.mrp! * i.qty)}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-4 rounded-xl bg-secondary/40 p-3">
                        <div className="mb-2 text-sm font-bold">Bill Summary</div>
                        <div className="space-y-1.5 text-sm">
                          <Row
                            label="Item Total"
                            value={
                              <span className="flex items-center gap-2">
                                {mrpTotal > o.subtotal && (
                                  <span className="text-muted-foreground line-through">
                                    {formatINR(mrpTotal)}
                                  </span>
                                )}
                                <span className="font-semibold">{formatINR(o.subtotal)}</span>
                              </span>
                            }
                          />
                          <Row
                            label="Delivery Fee"
                            value={
                              o.deliveryFee > 0 ? (
                                <span className="font-semibold">{formatINR(o.deliveryFee)}</span>
                              ) : (
                                <span className="font-semibold text-leaf">FREE</span>
                              )
                            }
                          />
                          {o.discount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Discount{o.promoCode ? ` (${o.promoCode})` : ""}
                              </span>
                              <span className="font-semibold text-primary">
                                −{formatINR(o.discount)}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold">
                            <span>Total Bill</span>
                            <span>{formatINR(o.total)}</span>
                          </div>
                        </div>

                        {/* Payment breakdown */}
                        {(() => {
                          const b = paymentBreakdown(o);
                          return (
                            <div className="mt-3 border-t border-border pt-3">
                              <div className="mb-2 text-sm font-bold">Payment</div>
                              <div className="space-y-1.5 text-sm">
                                <Row
                                  label="Method"
                                  value={
                                    <span className="font-semibold">
                                      {PAYMENT_LABELS[o.paymentMethod]}
                                    </span>
                                  }
                                />
                                {b.walletUsed > 0 && (
                                  <Row
                                    label="Kartigo Cash used"
                                    value={
                                      <span className="font-semibold text-primary">
                                        {formatINR(b.walletUsed)}
                                      </span>
                                    }
                                  />
                                )}
                                {b.otherUsed > 0 && (
                                  <Row
                                    label={`${b.otherLabel}`}
                                    value={
                                      <span className="font-semibold">
                                        {formatINR(b.otherUsed)}
                                      </span>
                                    }
                                  />
                                )}
                                <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-bold">
                                  <span>Total paid</span>
                                  <span>{formatINR(o.total)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground">
                        Deliver to: {o.address}
                      </div>

                      <button
                        onClick={() => downloadInvoice(o)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/10"
                      >
                        <Download className="h-4 w-4" /> Download invoice
                      </button>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="grid grid-cols-2 border-t border-border">
                    {!cancelled ? (
                      <>
                        <button
                          onClick={() => setReportTarget(o)}
                          className="border-r border-border py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10"
                        >
                          Report Issue
                        </button>
                        <button
                          onClick={() => orderAgain(o)}
                          className="py-3 text-sm font-bold text-primary transition hover:bg-secondary"
                        >
                          Order Again
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => orderAgain(o)}
                        className="col-span-2 py-3 text-sm font-bold text-primary transition hover:bg-secondary"
                      >
                        Order Again
                      </button>
                    )}
                  </div>

                  {/* Rate order — available for every order */}
                  <button
                    onClick={() => setRateTarget(o)}
                    className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm font-bold text-saffron transition hover:bg-saffron/10"
                  >
                    {ratings[o.id] ? (
                      <>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-4 w-4 ${
                                idx < ratings[o.id]
                                  ? "fill-saffron text-saffron"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          ))}
                        </span>
                        Rated · Tap to change
                      </>
                    ) : (
                      <>
                        <Star className="h-4 w-4" /> Rate order
                      </>
                    )}
                  </button>


                  {/* Cancellation — only allowed while the order is still "Placed".
                      Once packed it is locked to avoid wasted store effort/inventory. */}
                  {active &&
                    (o.status === "placed" ? (
                      <button
                        onClick={() => setCancelTarget(o)}
                        disabled={cancelling === o.id}
                        className="w-full border-t border-border py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {cancelling === o.id ? "Cancelling…" : "Cancel order"}
                      </button>
                    ) : (
                      <div className="w-full border-t border-border py-3 text-center text-xs font-medium text-muted-foreground">
                        Cancellation unavailable once the order is packed
                      </div>
                    ))}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {cancelTarget && (
        <CancelReasonModal
          busy={cancelling === cancelTarget.id}
          onClose={() => {
            if (cancelling !== cancelTarget.id) setCancelTarget(null);
          }}
          onConfirm={confirmCancel}
        />
      )}

      {reportTarget && (
        <ReportIssueModal
          order={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={(data) => {
            toast.success(
              `Issue reported for ${reportTarget.id}: ${data.type} · ${data.resolution}`,
            );
            setReportTarget(null);
          }}
        />
      )}
    </div>
  );
}

const CANCEL_REASONS = [
  "Changed my mind",
  "Forgot to add an item",
  "Delivery time too long",
  "Ordered by mistake",
  "Found a better price elsewhere",
];

function CancelReasonModal({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const reason = selected === "Other" ? other.trim() : (selected ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Cancel order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Help us improve — why are you cancelling?
        </p>

        <div className="mt-4 space-y-2">
          {[...CANCEL_REASONS, "Other"].map((r) => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                selected === r
                  ? "border-primary bg-primary/5 font-semibold"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full border ${selected === r ? "border-primary" : "border-muted-foreground/40"}`}
              >
                {selected === r && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              {r}
            </button>
          ))}
        </div>

        {selected === "Other" && (
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value.slice(0, 200))}
            placeholder="Tell us more…"
            rows={2}
            className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-border py-2.5 text-sm font-bold transition hover:bg-secondary disabled:opacity-50"
          >
            Keep order
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy || !reason}
            className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReportIssueData = {
  type: string;
  resolution: "Refund" | "Replacement";
  details: string;
  photo?: File;
};

const ISSUE_TYPES = [
  "Damaged product",
  "Expired product",
  "Wrong item delivered",
  "Missing item",
  "Other",
];

// Refund destination + timeline per the Refund & Returns Policy. Wallet orders
// are returned instantly to Kartigo Cash; UPI/COD follow the policy windows.
function refundTimeline(method: Order["paymentMethod"]): { destination: string; eta: string } {
  switch (method) {
    case "wallet":
      return { destination: "Kartigo Cash (Wallet)", eta: "Instantly after approval" };
    case "upi":
      return { destination: "Original UPI account", eta: "1–3 business days" };
    case "cash":
    default:
      return { destination: "UPI or bank transfer", eta: "3–5 business days" };
  }
}


function ReportIssueModal({
  order,
  onClose,
  onSubmit,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (data: ReportIssueData) => void;
}) {
  const [type, setType] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"Refund" | "Replacement" | null>(null);
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-2xl bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Report an issue</h2>
            <p className="text-xs text-muted-foreground">Order {order.id}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Tell us what went wrong
          </div>
        </div>

        <div className="space-y-2">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                type === t
                  ? "border-destructive bg-destructive/5 font-semibold"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full border ${type === t ? "border-destructive" : "border-muted-foreground/40"}`}
              >
                {type === t && <span className="h-2 w-2 rounded-full bg-destructive" />}
              </span>
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-bold">What would you prefer?</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setResolution("Refund")}
              className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                resolution === "Refund"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              Refund
            </button>
            <button
              onClick={() => setResolution("Replacement")}
              className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                resolution === "Replacement"
                  ? "border-leaf bg-leaf/10 text-leaf"
                  : "border-border hover:bg-secondary"
              }`}
            >
              Replacement
            </button>
          </div>
        </div>

        {/* Policy-aware refund details — shown once a refund is requested. */}
        {resolution === "Refund" &&
          (() => {
            const t = refundTimeline(order.paymentMethod);
            return (
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Clock className="h-4 w-4" /> Refund details
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <Row
                    label="Refund to"
                    value={<span className="font-semibold">{t.destination}</span>}
                  />
                  <Row
                    label="Estimated time"
                    value={<span className="font-semibold">{t.eta}</span>}
                  />
                </div>
                <Link
                  to="/refund-returns"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View Refund &amp; Returns Policy
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })()}


        <div className="mt-4">
          <div className="mb-2 text-sm font-bold">Add details (optional)</div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 300))}
            placeholder="Describe the issue…"
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition hover:bg-secondary">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {photo ? photo.name : "Upload product photo (optional)"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(f);
              }}
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-border py-2.5 text-sm font-bold transition hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!type || !resolution) return;
              onSubmit({ type, resolution, details, photo: photo ?? undefined });
            }}
            disabled={!type || !resolution}
            className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
