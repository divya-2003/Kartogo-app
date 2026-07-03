import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Phone, Package, Truck, CheckCircle2, MapPin, LogOut, RefreshCw, IndianRupee } from "lucide-react";
import { requestOtpFn } from "@/lib/auth.functions";
import { deliveryLoginFn, listDeliveryOrdersFn, deliverySetStatusFn } from "@/lib/delivery.functions";
import { formatINR } from "@/lib/data";
import kartigoLogo from "@/assets/kartigo-logo.png.asset.json";

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
  const [token, setToken] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const d = localStorage.getItem(DRIVER_KEY);
      if (t) setToken(t);
      if (d) setDriver(JSON.parse(d) as Driver);
    } catch { /* noop */ }
    setReady(true);
  }, []);

  const onLogin = (t: string, d: Driver) => {
    setToken(t);
    setDriver(d);
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(DRIVER_KEY, JSON.stringify(d));
    } catch { /* noop */ }
  };

  const onLogout = () => {
    setToken(null);
    setDriver(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(DRIVER_KEY);
    } catch { /* noop */ }
  };

  if (!ready) return null;
  if (!token || !driver) return <LoginScreen onLogin={onLogin} />;
  return <Dashboard token={token} driver={driver} onLogout={onLogout} onExpired={onLogout} />;
}

// ---------------- Login ----------------
function LoginScreen({ onLogin }: { onLogin: (token: string, driver: Driver) => void }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) { toast.error("Enter a valid 10-digit mobile"); return; }
    setLoading(true);
    try {
      const res = await requestOtpFn({ data: { phone } });
      setStage("otp");
      if (res.demo && "demoCode" in res && res.demoCode) {
        setDemoCode(res.demoCode);
        setOtp(res.demoCode);
        toast.success(`Demo mode: use OTP ${res.demoCode}`);
      } else {
        setDemoCode(null);
        toast.success(`OTP sent to +91 ${phone}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await deliveryLoginFn({ data: { phone, code: otp } });
      toast.success(`Welcome, ${res.driver.name}!`);
      onLogin(res.token, res.driver);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-[#15205a] shadow-pop">
          <img src={kartigoLogo.url} alt="Kartogo" className="h-full w-full object-cover" />
        </div>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Bike className="h-3.5 w-3.5" /> Delivery Partner
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Kartogo Partner</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deliver orders assigned to you</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-pop md:p-8">
          <h2 className="font-display text-xl font-bold">Partner login</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your registered delivery number.</p>

          {stage === "phone" && (
            <form onSubmit={send} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mobile number</label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">+91</span>
                  <input
                    autoFocus inputMode="numeric" maxLength={10}
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile" className="w-full bg-transparent text-base outline-none"
                  />
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          )}

          {stage === "otp" && (
            <form onSubmit={verify} className="mt-6 space-y-4">
              {demoCode && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  <span className="font-semibold">Demo mode:</span> use OTP {demoCode}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Enter OTP</label>
                <input
                  autoFocus inputMode="numeric" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button disabled={loading} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
              <button type="button" onClick={() => setStage("phone")} className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                ← Change number
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo partners: 9876500001 · 9876500002
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------- Dashboard ----------------
function Dashboard({ token, driver, onLogout, onExpired }: {
  token: string; driver: Driver; onLogout: () => void; onExpired: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "done">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listDeliveryOrdersFn({ data: { token } });
      setOrders(rows as unknown as OrderRow[]);
    } catch (err) {
      const msg = (err as Error).message;
      if (/session has expired/i.test(msg)) { toast.error(msg); onExpired(); return; }
      toast.error(msg);
    } finally { setLoading(false); }
  }, [token, onExpired]);

  useEffect(() => { void load(); }, [load]);
  // Keep the list fresh so newly-assigned orders show up automatically.
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

  const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const done = orders.filter(o => o.status === "delivered" || o.status === "cancelled");
  const visible = tab === "active" ? active : done;

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
          <button onClick={onLogout} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("active")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "active" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Active ({active.length})
          </button>
          <button onClick={() => setTab("done")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "done" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
            Completed ({done.length})
          </button>
        </div>

        {loading && orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Loading your orders…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            {tab === "active" ? "No orders assigned to you yet. New assignments appear here automatically." : "No completed deliveries yet."}
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

                  {step && (
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
