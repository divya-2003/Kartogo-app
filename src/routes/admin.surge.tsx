import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flame, CloudRain, PartyPopper, TrendingUp, Moon, Sparkles } from "lucide-react";
import { getSurgeConfigFn, setSurgeConfigFn, SURGE_REASON_LABELS, type SurgeReason, type SurgeConfig } from "@/lib/surge.functions";
import { formatINR } from "@/lib/data";

export const Route = createFileRoute("/admin/surge")({
  component: AdminSurgePage,
  head: () => ({ meta: [{ title: "Surge pricing — Kartogo Admin" }] }),
});

const REASON_ICONS: Record<SurgeReason, typeof Flame> = {
  weather: CloudRain,
  festival: PartyPopper,
  high_demand: TrendingUp,
  late_night: Moon,
  custom: Sparkles,
};

const REASONS: SurgeReason[] = ["weather", "festival", "high_demand", "late_night", "custom"];

function AdminSurgePage() {
  const [cfg, setCfg] = useState<SurgeConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSurgeConfigFn().then(setCfg).catch(() => toast.error("Could not load surge settings"));
  }, []);

  const save = async (next: SurgeConfig) => {
    const token = (() => { try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; } })();
    if (!token) return toast.error("Admin session expired");
    setSaving(true);
    try {
      const saved = await setSurgeConfigFn({ data: {
        adminToken: token,
        enabled: next.enabled,
        reason: next.reason,
        amount: next.amount,
        driverSharePercent: next.driverSharePercent,
        note: next.note,
      }});
      setCfg(saved);
      toast.success("Surge settings updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const driverShareRupees = Math.round((cfg.amount * cfg.driverSharePercent) / 100);
  const platformShareRupees = cfg.amount - driverShareRupees;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Flame className="h-6 w-6 text-primary" /> Dynamic surge pricing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a temporary surcharge to every delivery. Customers see the breakdown at checkout; the driver's share is paid on top of the base ₹25 per delivery.
        </p>
      </header>

      {/* Toggle */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg font-bold">Surge active</div>
            <div className="text-xs text-muted-foreground">
              {cfg.enabled ? `Charging +${formatINR(cfg.amount)} per order` : "No surge — customers pay the normal delivery fee"}
            </div>
          </div>
          <button
            onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
            disabled={saving}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${cfg.enabled ? "bg-primary" : "bg-muted"}`}
            aria-pressed={cfg.enabled}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${cfg.enabled ? "left-7" : "left-1"}`} />
          </button>
        </div>
      </section>

      {/* Reason */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 font-display font-bold">Reason</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REASONS.map(r => {
            const Icon = REASON_ICONS[r];
            const active = cfg.reason === r;
            return (
              <button
                key={r}
                onClick={() => save({ ...cfg, reason: r })}
                disabled={saving}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
              >
                <Icon className="h-4 w-4" />
                <span>{SURGE_REASON_LABELS[r]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Amount + driver share */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-sm font-semibold">Surge amount (₹ per order)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={cfg.amount}
            onChange={e => setCfg({ ...cfg, amount: Math.max(0, Number(e.target.value) || 0) })}
            onBlur={() => save(cfg)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">Driver share</span>
            <span className="text-muted-foreground">{cfg.driverSharePercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={cfg.driverSharePercent}
            onChange={e => setCfg({ ...cfg, driverSharePercent: Number(e.target.value) })}
            onMouseUp={() => save(cfg)}
            onTouchEnd={() => save(cfg)}
            className="w-full"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-secondary/60 p-2">
              <div className="text-muted-foreground">Driver gets</div>
              <div className="font-display font-bold text-primary">{formatINR(driverShareRupees)}</div>
            </div>
            <div className="rounded-lg bg-secondary/60 p-2">
              <div className="text-muted-foreground">Platform keeps</div>
              <div className="font-display font-bold">{formatINR(platformShareRupees)}</div>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Internal note (optional)</label>
          <input
            type="text"
            value={cfg.note ?? ""}
            onChange={e => setCfg({ ...cfg, note: e.target.value })}
            onBlur={() => save(cfg)}
            placeholder="e.g. Diwali evening surge"
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Every order permanently records its own surge amount, reason and driver share — future edits here don't change past settlements.
      </p>
    </div>
  );
}
