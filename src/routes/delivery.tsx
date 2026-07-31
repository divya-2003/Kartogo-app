import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Phone, Package, Undo2, ShieldAlert, Truck, CheckCircle2, MapPin, LogOut, RefreshCw, IndianRupee, HandPlatter, User2, Wallet, ListChecks, Navigation, ChevronDown, MessageSquare } from "lucide-react";
import { listDeliveryOrdersFn, deliverySetStatusFn, listAvailableOrdersFn, claimOrderFn, listReturnPickupsFn, markReturnPickedUpFn } from "@/lib/delivery.functions";
import { initiateMaskedCallFn } from "@/lib/chat.functions";
import { getDriverStatusFn } from "@/lib/drivers.functions";

import { supabase } from "@/integrations/supabase/client";
import { OrderChat } from "@/components/OrderChat";
import { formatINR } from "@/lib/data";



export const Route = createFileRoute("/delivery")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    // Delivery portal is gated on a saved driver session; missing session goes
    // to /login, never to the customer home page.
    const token = localStorage.getItem("qk_delivery_token");
    const driver = localStorage.getItem("qk_delivery_driver");
    if (!token || !driver) throw redirect({ to: "/login" });
  },
  component: DeliveryPortal,
  head: () => ({ meta: [{ title: "Delivery Partner — Kartogo" }] }),
});

type Driver = { id: string; name: string; phone: string };
type DeliveryStatus = "packed" | "out_for_delivery" | "delivered";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  items: { productId: string; name: string; qty: number; price: number }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  status: string;
  surge_amount?: number | null;
  surge_reason?: string | null;
  driver_surge_share?: number | null;
  refund_request_type?: string | null;
  refund_request_reason?: string | null;
  refund_request_status?: string | null;
  refund_requested_at?: string | null;
  return_stage?: string | null;
  return_picked_up_at?: string | null;

};

const TOKEN_KEY = "qk_delivery_token";
const DRIVER_KEY = "qk_delivery_driver";

const STATUS_META: Record<string, { label: string; chip: string }> = {
  placed: { label: "New", chip: "bg-saffron/20 text-saffron-foreground" },
  packed: { label: "Packed", chip: "bg-primary/15 text-primary" },
  out_for_delivery: { label: "Out for delivery", chip: "bg-primary/15 text-primary" },
  delivered: { label: "Delivered", chip: "bg-leaf/15 text-leaf" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground" },
};

// The next action a driver can take from each status.
const NEXT: Partial<Record<string, { next: DeliveryStatus; label: string; icon: typeof Package }>> = {
  placed: { next: "packed", label: "Mark as Packed", icon: Package },
  packed: { next: "out_for_delivery", label: "Start Delivery", icon: Truck },
  out_for_delivery: { next: "delivered", label: "Mark Delivered", icon: CheckCircle2 },
};

function DeliveryPortal() {
  const nav = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let t: string | null = null;
    let d: Driver | null = null;
    try {
      t = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(DRIVER_KEY);
      if (raw) d = JSON.parse(raw) as Driver;
    } catch { /* noop */ }
    if (t) setToken(t);
    if (d) setDriver(d);
    setReady(true);
    // No delivery session → send them to the unified login.
    if (!t || !d) nav({ to: "/login" });
  }, [nav]);

  const onLogout = () => {
    setToken(null);
    setDriver(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(DRIVER_KEY);
    } catch { /* noop */ }
    nav({ to: "/login" });
  };

  if (!ready) return null;
  if (!token || !driver) return null;
  return <Dashboard token={token} driver={driver} onLogout={onLogout} onExpired={onLogout} />;
}

// ---------------- Dashboard ----------------
function Dashboard({ token, driver, onLogout, onExpired }: {
  token: string; driver: Driver; onLogout: () => void; onExpired: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [available, setAvailable] = useState<OrderRow[]>([]);
  const [returns, setReturns] = useState<OrderRow[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"available" | "active" | "returns" | "done">("available");
  const [view, setView] = useState<"orders" | "account">("orders");
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);

  const maskedCall = async (orderId: string) => {
    try {
      const res = await initiateMaskedCallFn({ data: { token, orderId } });
      toast.success(res.message);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };




  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, open, pickups] = await Promise.all([
        listDeliveryOrdersFn({ data: { token } }),
        listAvailableOrdersFn({ data: { token } }),
        listReturnPickupsFn({ data: { token } }),
      ]);
      setBlocked(null);
      setOrders(mine as unknown as OrderRow[]);
      setAvailable(open as unknown as OrderRow[]);
      setReturns(pickups as unknown as OrderRow[]);
    } catch (err) {
      const msg = (err as Error).message;
      if (/session has expired/i.test(msg)) { toast.error(msg); onExpired(); return; }
      // Admin turned this rider off — block the portal but keep the session so
      // access comes straight back when they're re-activated.
      if (/turned off by the admin/i.test(msg)) { setBlocked(msg); return; }
      toast.error(msg);
    } finally { setLoading(false); }
  }, [token, onExpired]);

  useEffect(() => { void load(); }, [load]);
  // Keep the list fresh so newly-placed and newly-assigned orders show up automatically.
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  // While access is paused, poll the roster so the dashboard unlocks the moment
  // the admin approves — no logout / hard refresh needed.
  useEffect(() => {
    if (!blocked) return;
    let alive = true;
    const check = async () => {
      try {
        const s = await getDriverStatusFn({ data: { phone: driver.phone } });
        if (!alive || !s.found || !s.active) return;
        try { localStorage.setItem("qk_delivery_active", "1"); } catch { /* noop */ }
        setBlocked(null);
        await load();
        toast.success("Access approved — welcome back!");
      } catch { /* keep waiting */ }
    };
    void check();
    const t = setInterval(() => { void check(); }, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [blocked, driver.phone, load]);

  // Realtime: listen for this rider's access flag flipping to active. The
  // moment the admin approves, swap the "Request access" screen for the live
  // dashboard — no logout / login round trip. Polling above stays as fallback.
  useEffect(() => {
    if (!blocked || !driver.id) return;
    const channel = supabase
      .channel(`driver-access-${driver.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_access_events", filter: `driver_id=eq.${driver.id}` },
        (payload) => {
          const row = payload.new as { active?: boolean } | null;
          if (!row?.active) return;
          try { localStorage.setItem("qk_delivery_active", "1"); } catch { /* noop */ }
          setBlocked(null);
          void load();
          toast.success("Access approved — welcome back!");
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [blocked, driver.id, load]);




  const advance = async (o: OrderRow, next: DeliveryStatus, label: string) => {
    setBusyId(o.id);
    try {
      const row = await deliverySetStatusFn({ data: { token, id: o.id, status: next } });
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: (row as unknown as OrderRow).status } : x));
      toast.success(`${o.id} · ${label} ✓`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusyId(null); }
  };

  // Self-assign a freshly placed order to this driver.
  const claim = async (o: OrderRow) => {
    setBusyId(o.id);
    try {
      const row = await claimOrderFn({ data: { token, id: o.id } });
      setAvailable(prev => prev.filter(x => x.id !== o.id));
      setOrders(prev => [row as unknown as OrderRow, ...prev]);
      setTab("active");
      toast.success(`${o.id} is now assigned to you ✓`);
    } catch (err) {
      toast.error((err as Error).message);
      // Someone else may have grabbed it — refresh the list.
      void load();
    } finally { setBusyId(null); }
  };

  // Confirm the returned items were collected from the customer.
  const pickupReturn = async (o: OrderRow) => {
    setBusyId(o.id);
    try {
      const row = await markReturnPickedUpFn({ data: { token, id: o.id } });
      setReturns(prev => prev.map(x => x.id === o.id ? (row as unknown as OrderRow) : x));
      toast.success(`${o.id} · returned items picked up ✓`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusyId(null); }
  };

  const pendingReturns = returns.filter(o => (o.return_stage ?? "requested") === "requested");
  const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const done = orders.filter(o => o.status === "delivered" || o.status === "cancelled");
  const delivered = orders.filter(o => o.status === "delivered");


  const visible = tab === "available" ? available : tab === "active" ? active : tab === "returns" ? returns : done;


  if (blocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-3 font-display text-xl font-bold">Access paused</h1>
          <p className="mt-2 text-sm text-muted-foreground">{blocked}</p>
          <p className="mt-2 text-xs text-muted-foreground">Your delivery history and earnings are safe — everything returns when the admin marks you available again.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/delivery-request"
              search={{ phone: driver.phone }}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Request delivery page
            </Link>
            <button onClick={() => void load()} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">Try again</button>
            <button onClick={onLogout} className="rounded-xl border border-destructive/40 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/10">Log out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bike className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="font-display text-base font-bold leading-tight">{driver.name}</div>
            <div className="text-xs text-muted-foreground">+91 {driver.phone}</div>
          </div>
          <button onClick={() => void load()} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary" aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setView(v => v === "account" ? "orders" : "account")} className={`grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary ${view === "account" ? "bg-primary text-primary-foreground" : ""}`} aria-label="Account">
            <User2 className="h-4 w-4" />
          </button>
        </div>
      </header>


      <div className="mx-auto max-w-2xl px-4 py-4">
        {view === "account" ? (
          <AccountView
            driver={driver}
            deliveredCount={delivered.length}
            activeCount={active.length}
            orders={orders}
            onLogout={onLogout}
          />
        ) : (
        <>
        <DailySummary orders={orders} returns={returns} />


        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setTab("available")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "available" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Available ({available.length})
          </button>
          <button onClick={() => setTab("active")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "active" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Active ({active.length})
          </button>
          <button onClick={() => setTab("returns")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "returns" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Returns ({pendingReturns.length})
          </button>
          <button onClick={() => setTab("done")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "done" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Completed ({done.length})
          </button>
        </div>

        {loading && orders.length === 0 && available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            {tab === "available"
              ? "No new orders waiting to be picked up right now. New orders appear here automatically."
              : tab === "active"
                ? "No orders assigned to you yet."
                : tab === "returns"
                  ? "No return pickups right now. Refund requests on orders you delivered appear here."
                  : "No completed deliveries yet."}
          </div>
        ) : (

          <div className="space-y-3">
            {visible.map(o => {
              const meta = STATUS_META[o.status] ?? STATUS_META.placed;
              const step = NEXT[o.status];
              const Icon = step?.icon ?? Package;
              return (
                <article key={o.id} className="rounded-2xl border border-border bg-card p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-bold">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
                  </header>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="font-semibold">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">Phone hidden — use in-app chat or masked call</div>
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{o.address}</span>
                    </div>
                  </div>


                  <ul className="my-3 grid gap-1 border-y border-border py-3 text-sm">
                    {o.items.map(i => (
                      <li key={i.productId} className="flex justify-between text-muted-foreground">
                        <span>{i.name} × <span className="font-semibold text-foreground">{i.qty}</span></span>
                        <span>{formatINR(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span className="font-display text-lg font-bold">{formatINR(o.total)}</span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold uppercase">{o.payment_method}</span>
                    </div>
                  </div>

                  {tab === "returns" && (
                    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <div className="flex items-center gap-2 font-bold text-destructive">
                        <Undo2 className="h-4 w-4" /> Return pickup
                      </div>
                      {o.refund_request_type && <div className="mt-1 text-xs text-muted-foreground">Issue: {o.refund_request_type}</div>}
                      {o.refund_request_reason && <div className="mt-0.5 text-xs text-muted-foreground">“{o.refund_request_reason}”</div>}
                      <div className="mt-2 text-xs font-semibold">
                        {(o.return_stage ?? "requested") === "requested"
                          ? "Collect the items from the customer"
                          : o.return_stage === "picked_up"
                            ? "Picked up · with the store"
                            : o.return_stage === "refund_initiated"
                              ? "Refund initiated (3–5 business days)"
                              : o.return_stage === "refunded"
                                ? "Refunded to the customer"
                                : "Refund request declined"}
                      </div>
                      {(o.return_stage ?? "requested") === "requested" && (
                        <button
                          onClick={() => pickupReturn(o)}
                          disabled={busyId === o.id}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
                        >
                          <Undo2 className="h-4 w-4" />
                          {busyId === o.id ? "Updating…" : "Returned items picked up"}
                        </button>
                      )}
                    </div>
                  )}

                  {tab === "available" ? (
                    <button
                      onClick={() => claim(o)}
                      disabled={busyId === o.id}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-pop transition hover:opacity-90 disabled:opacity-60"
                    >
                      <HandPlatter className="h-4 w-4" />
                      {busyId === o.id ? "Taking…" : "I'm taking this order"}
                    </button>
                  ) : step && (
                    <button
                      onClick={() => advance(o, step.next, step.label)}
                      disabled={busyId === o.id}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-pop transition hover:opacity-90 disabled:opacity-60"
                    >
                      <Icon className="h-4 w-4" />
                      {busyId === o.id ? "Updating…" : step.label}
                    </button>
                  )}

                  {/* Chat / masked call / directions — available once the order is assigned. */}
                  {(tab === "active" || (tab === "returns" && (o.return_stage ?? "requested") === "requested")) && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Directions
                      </a>
                      <button
                        onClick={() => setChatOrderId(o.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Chat
                      </button>
                      <button
                        onClick={() => void maskedCall(o.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </button>
                    </div>
                  )}


                </article>

              );
            })}
          </div>
        )}
        </>
        )}
      </div>

      {chatOrderId && (
        <OrderChat
          token={token}
          orderId={chatOrderId}
          myRole="driver"
          peerLabel="Customer"
          onClose={() => setChatOrderId(null)}
        />
      )}
    </div>
  );
}


// ---------------- Today's summary ----------------
const isSameDay = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

function DailySummary({ orders, returns }: { orders: OrderRow[]; returns: OrderRow[] }) {
  const deliveredToday = orders.filter(o => o.status === "delivered" && isSameDay(o.created_at));
  const returnsToday = returns.filter(o => (o.return_stage ?? "") !== "requested" && isSameDay(o.return_picked_up_at));
  const earnedToday = deliveredToday.reduce(
    (s, o) => s + EARNING_PER_ORDER + Math.max(0, Number(o.driver_surge_share) || 0),
    0,
  );

  return (
    <section className="mb-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-card p-4 shadow-pop sm:p-5">
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-extrabold sm:text-lg">Today&apos;s summary</h2>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="font-display text-xl font-extrabold sm:text-2xl">{deliveredToday.length}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Deliveries</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="font-display text-xl font-extrabold sm:text-2xl">{returnsToday.length}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Returns</div>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-center">
          <div className="font-display text-xl font-extrabold text-primary sm:text-2xl">{formatINR(earnedToday)}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Earned today</div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Earnings (monthly, clickable) ----------------

// Delivery partners earn a flat ₹25 for every order they deliver.
const EARNING_PER_ORDER = 25;

function EarningsSection({ orders, deliveredCount, activeCount }: {
  orders: OrderRow[];
  deliveredCount: number;
  activeCount: number;
}) {
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + now.getMonth();
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(currentKey);
  const [visibleCount, setVisibleCount] = useState(5);

  const PAGE = 5;

  // Group delivered orders into calendar months.
  const groups = new Map<number, OrderRow[]>();
  for (const o of orders.filter(o => o.status === "delivered")) {
    const d = new Date(o.created_at);
    const key = d.getFullYear() * 12 + d.getMonth();
    const arr = groups.get(key) ?? [];
    arr.push(o);
    groups.set(key, arr);
  }
  const keys = [...groups.keys()].sort((a, b) => b - a);
  if (!keys.includes(currentKey)) keys.unshift(currentKey);

  const labelFor = (key: number) =>
    new Date(Math.floor(key / 12), key % 12, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const monthOrdersFor = (key: number) =>
    (groups.get(key) ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const current = monthOrdersFor(currentKey);
  const payoutFor = (o: OrderRow) => EARNING_PER_ORDER + Math.max(0, Number(o.driver_surge_share) || 0);
  const totalFor = (list: OrderRow[]) => list.reduce((s, o) => s + payoutFor(o), 0);
  const currentTotal = totalFor(current);

  const selected = monthOrdersFor(selectedKey);
  const selectedTotal = totalFor(selected);
  const shown = selected.slice(0, visibleCount);

  return (
    <section>
      {/* My earnings — clickable header that expands everything inside */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-secondary/60"
        >
          <Wallet className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <div className="font-display text-lg font-bold">My earnings</div>
            <div className="text-xs text-muted-foreground">{current.length} deliver{current.length === 1 ? "y" : "ies"} this month</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-display text-lg font-bold text-primary">{formatINR(currentTotal)}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        {open && (
          <div className="space-y-3 border-t border-border p-4">
            {/* Delivered / Active quick stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-background p-4 text-center">
                <div className="font-display text-2xl font-bold">{current.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Delivered</div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 text-center">
                <div className="font-display text-2xl font-bold">{activeCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">Active</div>
              </div>
            </div>

            {/* Month picker + payouts for the chosen month */}
            <div className="overflow-hidden rounded-2xl border border-primary/40 bg-background">
              <div className="flex flex-wrap items-center gap-2 p-4">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="earnings-month">Month</label>
                <select
                  id="earnings-month"
                  value={selectedKey}
                  onChange={e => { setSelectedKey(Number(e.target.value)); setVisibleCount(PAGE); }}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"
                >
                  {keys.map(k => (
                    <option key={k} value={k}>
                      {labelFor(k)}{k === currentKey ? " · this month" : ""}
                    </option>
                  ))}
                </select>
                <span className="font-display text-lg font-bold text-primary">{formatINR(selectedTotal)}</span>
              </div>

              <div className="border-t border-border">
                {selected.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No deliveries in {labelFor(selectedKey)}.</div>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {shown.map(o => {
                        const share = Math.max(0, Number(o.driver_surge_share) || 0);
                        return (
                          <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-semibold">{o.id}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(o.created_at).toLocaleString("en-IN")}
                                {share > 0 && <span className="ml-1 text-primary">· +{formatINR(share)} surge</span>}
                              </div>
                            </div>
                            <span className="shrink-0 font-semibold text-primary">+{formatINR(payoutFor(o))}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {selected.length > shown.length && (
                      <button
                        onClick={() => setVisibleCount(c => c + PAGE)}
                        className="w-full border-t border-border py-3 text-sm font-bold text-primary hover:bg-secondary/60"
                      >
                        Show more ({selected.length - shown.length} left)
                      </button>
                    )}
                    {shown.length > PAGE && selected.length === shown.length && (
                      <button
                        onClick={() => setVisibleCount(PAGE)}
                        className="w-full border-t border-border py-3 text-sm font-bold text-muted-foreground hover:bg-secondary/60"
                      >
                        Show less
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Flat {formatINR(EARNING_PER_ORDER)} per delivery + your share of any surge.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------- Account view ----------------

function AccountView({ driver, deliveredCount, activeCount, orders, onLogout }: {
  driver: Driver;
  deliveredCount: number;
  activeCount: number;
  orders: OrderRow[];
  onLogout: () => void;
}) {
  // Only keep addresses from today — at the end of the day (past midnight) these
  // drop off automatically, so old delivery locations don't linger on this page.
  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  };
  const withLocations = orders
    .filter(o => o.status !== "cancelled" && isToday(o.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);
  return (
    <div className="space-y-5">
      {/* My earnings */}
      <EarningsSection orders={orders} deliveredCount={deliveredCount} activeCount={activeCount} />


      {/* Account details */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <User2 className="h-5 w-5 text-primary" /> Account details
        </h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <User2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Name</div>
              <div className="font-semibold">{driver.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="font-semibold">+91 {driver.phone}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Bike className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Partner ID</div>
              <div className="font-semibold">{driver.id}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery locations for every order */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
          <ListChecks className="h-5 w-5 text-primary" /> Delivery locations
        </h2>
        {withLocations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            No customer orders yet.
          </div>
        ) : (
          <div className="space-y-3">
            {withLocations.map(o => {
              const meta = STATUS_META[o.status] ?? STATUS_META.placed;
              return (
                <article key={o.id} className="rounded-2xl border border-border bg-card p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-sm font-bold">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_name}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
                  </header>
                  <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{o.address}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Directions
                    </a>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> Call via app
                    </span>

                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Log out */}
      <button
        onClick={onLogout}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-secondary"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}
