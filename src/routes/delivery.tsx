import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Phone, Package, Truck, CheckCircle2, MapPin, LogOut, RefreshCw, IndianRupee, HandPlatter, User2, Wallet, ChevronLeft, ListChecks, Navigation } from "lucide-react";
import { listDeliveryOrdersFn, deliverySetStatusFn, listAvailableOrdersFn, claimOrderFn } from "@/lib/delivery.functions";
import { formatINR } from "@/lib/data";


export const Route = createFileRoute("/delivery")({
  component: DeliveryPortal,
  head: () => ({ meta: [{ title: "Delivery Partner — Kartogo" }] }),
});

type Driver = { id: string; name: string; phone: string };
type DeliveryStatus = "packed" | "out_for_delivery" | "delivered";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  items: { productId: string; name: string; qty: number; price: number }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  status: string;
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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"available" | "active" | "done">("available");
  const [view, setView] = useState<"orders" | "account">("orders");



  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, open] = await Promise.all([
        listDeliveryOrdersFn({ data: { token } }),
        listAvailableOrdersFn({ data: { token } }),
      ]);
      setOrders(mine as unknown as OrderRow[]);
      setAvailable(open as unknown as OrderRow[]);
    } catch (err) {
      const msg = (err as Error).message;
      if (/session has expired/i.test(msg)) { toast.error(msg); onExpired(); return; }
      toast.error(msg);
    } finally { setLoading(false); }
  }, [token, onExpired]);

  useEffect(() => { void load(); }, [load]);
  // Keep the list fresh so newly-placed and newly-assigned orders show up automatically.
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

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

  const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const done = orders.filter(o => o.status === "delivered" || o.status === "cancelled");
  const delivered = orders.filter(o => o.status === "delivered");
  const earnings = delivered.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);

  const visible = tab === "available" ? available : tab === "active" ? active : done;


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
            earnings={earnings}
            deliveredCount={delivered.length}
            activeCount={active.length}
            orders={orders}
            onLogout={onLogout}
          />
        ) : (
        <>
        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("available")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "available" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Available ({available.length})
          </button>
          <button onClick={() => setTab("active")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "active" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Active ({active.length})
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
                    <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1.5 text-primary">
                      <Phone className="h-3.5 w-3.5" /> +91 {o.customer_phone}
                    </a>
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

                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
