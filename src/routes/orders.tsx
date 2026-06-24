import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useAuth, useOrders, DELIVERY_BOYS, type OrderStatus } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { CheckCircle2, Package, Truck, Clock, XCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
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
  placed: id => ({ title: "Order placed", description: `${id} has been placed successfully.` }),
  packed: id => ({ title: "Order packed", description: `${id} is packed and ready to dispatch.` }),
  out_for_delivery: id => ({ title: "Out for delivery", description: `${id} is on the way to you.` }),
  delivered: id => ({ title: "Order delivered", description: `${id} has been delivered. Enjoy!` }),
  cancelled: id => ({ title: "Order cancelled", description: `${id} has been cancelled.` }),
};

function OrdersPage() {
  const { user, logout } = useAuth();
  const { orders, refresh } = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [notices, setNotices] = useState<{ id: string; title: string; description: string }[]>([]);
  const userPhone = user?.phone;
  const previousOrdersRef = useRef(new Map<string, { status: OrderStatus; deliveryBoyId?: string }>());
  const notificationReadyRef = useRef(false);
  const notifiedRef = useRef(new Set<string>());

  const notifyOnce = (key: string, title: string, description: string) => {
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    setNotices(prev => [{ id: key, title, description }, ...prev].slice(0, 3));
    toast(title, { description });
  };

  // Notify for any status change. When the order is out for delivery and a
  // driver is assigned, include the latest driver details in the message.
  const notifyStatus = (orderId: string, status: OrderStatus, deliveryBoyId?: string) => {
    const make = STATUS_NOTICE[status];
    if (!make) return;
    const base = make(orderId);
    let description = base.description;
    if (status === "out_for_delivery" && deliveryBoyId) {
      const boy = DELIVERY_BOYS.find(d => d.id === deliveryBoyId);
      if (boy) description += ` Driver: ${boy.name} · ${boy.phone}`;
    }
    notifyOnce(`${orderId}:status:${status}`, base.title, description);
  };

  const notifyDriver = (orderId: string, deliveryBoyId?: string) => {
    if (!deliveryBoyId) return;
    const boy = DELIVERY_BOYS.find(d => d.id === deliveryBoyId);
    if (!boy) return;
    notifyOnce(`${orderId}:driver:${deliveryBoyId}`, "Delivery partner assigned", `${boy.name} · ${boy.phone}`);
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
    orders.some(
      o => o.customerPhone === userPhone && !FINAL_STATUSES.includes(o.status),
    );

  useEffect(() => {
    if (!hasActiveOrders || !userPhone) return;
    const id = window.setInterval(() => {
      void refresh(userPhone);
    }, 2000);
    return () => window.clearInterval(id);
  }, [hasActiveOrders, refresh, userPhone]);

  useEffect(() => {
    if (!userPhone) return;

    const channel = supabase
      .channel(`customer_order_updates_${userPhone}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_orders",
          filter: `customer_phone=eq.${userPhone}`,
        },
        payload => {
          const next = payload.new as { id?: string; status?: OrderStatus; delivery_boy_id?: string | null; updated_at?: string } | null;
          if ((payload.eventType === "UPDATE" || payload.eventType === "INSERT") && next?.id) {
            const previous = previousOrdersRef.current.get(next.id);
            const nextDeliveryBoyId = next.delivery_boy_id ?? undefined;

            if (next.status && (!previous || previous.status !== next.status)) {
              notifyStatus(next.id, next.status, nextDeliveryBoyId);
            }

            if (nextDeliveryBoyId && (!previous || previous.deliveryBoyId !== nextDeliveryBoyId)) {
              notifyDriver(next.id, nextDeliveryBoyId);
            }
          }

          void refresh(userPhone);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, userPhone]);

  const mine = useMemo(
    () => orders.filter(o => o.customerPhone === userPhone),
    [orders, userPhone],
  );

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
        notifyStatus(order.id, order.status, order.deliveryBoyId);
      }

      if (previous && previous.deliveryBoyId !== order.deliveryBoyId && order.deliveryBoyId) {
        notifyDriver(order.id, order.deliveryBoyId);
      }
    }

    previousOrdersRef.current = nextSnapshot;
  }, [mine]);

  const handleRefresh = async () => {
    if (!userPhone) return;
    setRefreshing(true);
    try {
      await refresh(userPhone);
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {notices.length > 0 && (
        <div className="fixed left-1/2 top-20 z-50 w-[min(92vw,420px)] -translate-x-1/2 space-y-2">
          {notices.map(notice => (
            <div key={notice.id} className="rounded-xl border border-primary/25 bg-card p-3 text-sm shadow-pop">
              <div className="font-bold text-primary">{notice.title}</div>
              <div className="text-muted-foreground">{notice.description}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">My orders</h1>
            <p className="text-sm text-muted-foreground">Signed in as {user.name || user.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={logout} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">Logout</button>
          </div>
        </div>
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <div className="font-semibold">No orders yet</div>
            <Link to="/" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start shopping</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {mine.map(o => {
              const stepIdx = STEPS.findIndex(s => s.key === o.status);
              const cancelled = o.status === "cancelled";
              const boy = DELIVERY_BOYS.find(d => d.id === o.deliveryBoyId);
              return (
                <article key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-pop">
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg font-bold">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-IN")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold">{formatINR(o.total)}</div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{o.paymentMethod === "cash" ? "Cash" : "UPI"} on delivery</div>
                      <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${cancelled ? "bg-destructive/10 text-destructive" : "bg-primary text-primary-foreground"}`}>
                        Status: {STATUS_LABELS[o.status]}
                      </div>
                    </div>
                  </header>

                  {cancelled ? (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><XCircle className="h-4 w-4" /> Order cancelled</div>
                  ) : (
                      <div className="mt-4 flex items-center gap-2">
                      {STEPS.map((s, i) => {
                        const done = i <= stepIdx;
                          const current = s.key === o.status;
                        return (
                          <div key={s.key} className="flex flex-1 items-center gap-2">
                            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${current ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{s.icon}</div>
                            <div className={`text-xs font-semibold ${current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIdx ? "bg-primary" : "bg-border"}`} />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {boy && !cancelled && (
                    <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                      Delivery partner: <span className="font-semibold">{boy.name}</span> · <a className="text-primary" href={`tel:${boy.phone}`}>{boy.phone}</a>
                    </div>
                  )}

                  <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                    {o.items.map(i => (
                      <li key={i.productId} className="flex justify-between text-muted-foreground">
                        <span>{i.name} × {i.qty}</span>
                        <span className="font-semibold text-foreground">{formatINR(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs text-muted-foreground">Deliver to: {o.address}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
