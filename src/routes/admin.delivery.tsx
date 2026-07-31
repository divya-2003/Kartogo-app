import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useDrivers, useOrders, type Order } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { Switch } from "@/components/ui/switch";
import { Bike, Phone, CircleDot, Wallet, UserPlus, Clock, BellRing, Users, RefreshCw } from "lucide-react";
import { addDeliveryPartnerFn, updateDeliveryPartnerFn } from "@/lib/drivers.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/delivery")({ component: DeliveryAdmin });

type Availability = "active" | "on_delivery" | "offline";
type Section = "team" | "add" | "requests";

// Flat payout a delivery partner earns for every order they deliver.
const EARNING_PER_ORDER = 25;

const META: Record<Availability, { label: string; dot: string; chip: string }> = {
  active: { label: "Available", dot: "text-leaf", chip: "bg-leaf/15 text-leaf" },
  on_delivery: { label: "On Delivery", dot: "text-saffron", chip: "bg-saffron/20 text-saffron-foreground" },
  offline: { label: "Unavailable", dot: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

function DeliveryAdmin() {
  const { orders } = useOrders();
  const { adminToken } = useAuth();
  const { drivers, setAvailable, refresh } = useDrivers();
  const [filter, setFilter] = useState<"all" | Availability>("all");
  const [section, setSection] = useState<Section>("team");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<number>(() => Date.now());

  // Live roster: access requests raised by paused riders must land here without
  // the admin reloading the page, so we re-pull the roster every second while
  // the tab is visible (and expose a manual refresh, like the delivery app).
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try { await refresh(); setLastSync(Date.now()); } catch { /* keep polling */ }
    };
    const id = window.setInterval(() => { void tick(); }, 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const manualRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); setLastSync(Date.now()); toast.success("Delivery team refreshed"); }
    catch { toast.error("Could not refresh right now"); }
    finally { setRefreshing(false); }
  };

  const riders = useMemo(() => {
    return drivers.map(d => {
      const inProgress = orders.filter(
        o => o.deliveryBoyId === d.id && o.status !== "delivered" && o.status !== "cancelled",
      );
      const deliveredOrders = orders.filter(o => o.deliveryBoyId === d.id && o.status === "delivered");
      // Group delivered orders by calendar month → flat ₹25 payout each.
      const byMonth = new Map<string, { label: string; orders: number; amount: number; sort: number }>();
      for (const o of deliveredOrders) {
        const dt = new Date(o.createdAt);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        const label = dt.toLocaleString("en-IN", { month: "short", year: "numeric" });
        const existing = byMonth.get(key);
        if (existing) {
          existing.orders += 1;
          existing.amount += EARNING_PER_ORDER;
        } else {
          byMonth.set(key, { label, orders: 1, amount: EARNING_PER_ORDER, sort: dt.getFullYear() * 12 + dt.getMonth() });
        }
      }
      const monthlyEarnings = [...byMonth.values()].sort((a, b) => b.sort - a.sort);
      const totalEarnings = deliveredOrders.length * EARNING_PER_ORDER;
      const availability: Availability = !d.active
        ? "offline"
        : inProgress.length > 0
          ? "on_delivery"
          : "active";
      return { ...d, inProgress, availability, monthlyEarnings, totalEarnings, deliveredCount: deliveredOrders.length };
    });
  }, [orders, drivers]);

  const counts = useMemo(
    () => ({
      active: riders.filter(r => r.availability === "active").length,
      on_delivery: riders.filter(r => r.availability === "on_delivery").length,
      offline: riders.filter(r => r.availability === "offline").length,
    }),
    [riders],
  );

  const pendingRequests = riders.filter(r => !r.active && r.accessRequestedAt);
  const visible = filter === "all" ? riders : riders.filter(r => r.availability === filter);

  const onToggle = async (id: string, name: string, next: boolean) => {
    try {
      await setAvailable(id, next);
      toast.success(
        next
          ? `${name} marked available — delivery app access restored`
          : `${name} marked unavailable — delivery app access blocked (history kept)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update availability");
    }
  };

  const shiftLabel = (d: { shiftType?: string; shiftStart?: string | null; shiftEnd?: string | null }) =>
    d.shiftType === "part_time"
      ? `Part time${d.shiftStart && d.shiftEnd ? ` · ${d.shiftStart}–${d.shiftEnd}` : ""}`
      : "Full time";

  const SECTIONS: { key: Section; label: string; icon: typeof Users; badge?: number }[] = [
    { key: "team", label: "Team", icon: Users },
    { key: "add", label: "Add partner", icon: UserPlus },
    { key: "requests", label: "Access requests", icon: BellRing, badge: pendingRequests.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="font-display text-3xl font-bold">Delivery team</h1>
        <p className="text-sm text-muted-foreground">Toggle availability — only available riders can be assigned to orders and sign in to the delivery app. Blocking a rider never deletes their past orders or earnings.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Live · synced {new Date(lastSync).toLocaleTimeString("en-IN")}</span>
          <button
            type="button"
            onClick={() => void manualRefresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Subsections */}
      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${section === s.key ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}
          >
            <s.icon className="h-4 w-4" /> {s.label}
            {!!s.badge && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${section === s.key ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"}`}>{s.badge}</span>
            )}
          </button>
        ))}
      </div>

      {section === "add" && (
        <AddPartnerForm
          adminToken={adminToken}
          onAdded={async () => { await refresh(); setSection("team"); }}
        />
      )}

      {section === "requests" && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No pending access requests.</div>
          ) : (
            pendingRequests.map(d => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-saffron/15 text-saffron"><BellRing className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="font-display text-base font-bold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">+91 {d.phone} · {shiftLabel(d)}</div>
                  <div className="text-xs text-muted-foreground">
                    Requested {new Date(d.accessRequestedAt as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                <button
                  onClick={() => void onToggle(d.id, d.name, true)}
                  className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Grant delivery page
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {section === "team" && (
        <>
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

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                    <Clock className="h-3 w-3" /> {shiftLabel(d)}
                  </span>
                  {!d.active && d.accessRequestedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                      <BellRing className="h-3 w-3" /> Access requested
                    </span>
                  )}
                </div>

                {/* Availability toggle */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2">
                  <span className="text-sm font-semibold">{d.active ? "Available for orders" : "Not available"}</span>
                  <Switch
                    checked={d.active}
                    onCheckedChange={next => onToggle(d.id, d.name, next)}
                    aria-label={`Toggle availability for ${d.name}`}
                  />
                </div>

                <ShiftEditor
                  adminToken={adminToken}
                  driver={d}
                  onSaved={() => void refresh()}
                />

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

                {/* Monthly earnings — flat ₹25 per delivered order */}
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" /> Earnings (₹25/order)
                    </div>
                    <div className="font-display text-lg font-bold text-primary">{formatINR(d.totalEarnings)}</div>
                  </div>
                  {d.monthlyEarnings.length === 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">No deliveries yet.</div>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {d.monthlyEarnings.map(m => (
                        <li key={m.label} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{m.label} · {m.orders} order{m.orders === 1 ? "" : "s"}</span>
                          <span className="font-display font-semibold tabular-nums">{formatINR(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No riders in this state.</div>
          )}
        </>
      )}
    </div>
  );
}

function AddPartnerForm({ adminToken, onAdded }: { adminToken: string | null; onAdded: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shiftType, setShiftType] = useState<"full_time" | "part_time">("full_time");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("13:00");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) { toast.error("Admin session expired — please log in again"); return; }
    setSaving(true);
    try {
      await addDeliveryPartnerFn({ data: { adminToken, name, phone, shiftType, shiftStart, shiftEnd, active } });
      toast.success(`${name} added — they can log in with +91 ${phone}`);
      setName(""); setPhone("");
      await onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add this delivery partner");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Add a delivery partner</h2>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted-foreground">
          Name
          <input
            value={name} onChange={e => setName(e.target.value)} placeholder="Rider name"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Mobile number
          <input
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric" placeholder="10-digit mobile"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          {(["full_time", "part_time"] as const).map(t => (
            <button
              key={t} type="button" onClick={() => setShiftType(t)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${shiftType === t ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
            >
              {t === "full_time" ? "Full time" : "Part time"}
            </button>
          ))}
        </div>
        {shiftType === "part_time" && (
          <div className="flex items-end gap-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Duty from
              <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                className="mt-1 block rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Duty to
              <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                className="mt-1 block rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Switch checked={active} onCheckedChange={setActive} aria-label="Give delivery page access now" />
          Give delivery page access now
        </label>
        <button
          disabled={saving}
          className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Adding..." : "Add partner"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The new partner gets the same delivery page as everyone else — they sign in on the normal login screen with this mobile number and an OTP.
      </p>
    </form>
  );
}

function ShiftEditor({
  adminToken,
  driver,
  onSaved,
}: {
  adminToken: string | null;
  driver: { id: string; name: string; shiftType?: string; shiftStart?: string | null; shiftEnd?: string | null };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [shiftType, setShiftType] = useState<"full_time" | "part_time">(driver.shiftType === "part_time" ? "part_time" : "full_time");
  const [start, setStart] = useState(driver.shiftStart ?? "09:00");
  const [end, setEnd] = useState(driver.shiftEnd ?? "13:00");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!adminToken) { toast.error("Admin session expired — please log in again"); return; }
    setSaving(true);
    try {
      await updateDeliveryPartnerFn({ data: { adminToken, driverId: driver.id, name: driver.name, shiftType, shiftStart: start, shiftEnd: end } });
      toast.success("Duty details saved");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save duty details");
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-primary">Edit duty type / timings</button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["full_time", "part_time"] as const).map(t => (
          <button
            key={t} type="button" onClick={() => setShiftType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${shiftType === t ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
          >
            {t === "full_time" ? "Full time" : "Part time"}
          </button>
        ))}
      </div>
      {shiftType === "part_time" && (
        <div className="mt-2 flex items-center gap-2">
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs" />
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary">Cancel</button>
      </div>
    </div>
  );
}
