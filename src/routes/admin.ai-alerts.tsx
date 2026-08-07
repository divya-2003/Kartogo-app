import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BellRing, RefreshCw, Search, Send, TrendingUp, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/lib/store";
import { inventoryAlertsBoardFn, notifyMarketReplenishFn, type InventoryAlertRow } from "@/lib/inventory-alerts.functions";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export const Route = createFileRoute("/admin/ai-alerts")({
  component: AiInventoryAlertsPage,
  head: () => ({
    meta: [
      { title: "AI inventory alerts — Kartogo admin" },
      { name: "description", content: "Predicted stock-outs, partner supermarket stock health and AI replenishment recommendations for Kartogo." },
      { property: "og:title", content: "AI inventory alerts — Kartogo admin" },
      { property: "og:description", content: "Predicted stock-outs and AI replenishment recommendations across partner supermarkets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Board = Awaited<ReturnType<typeof inventoryAlertsBoardFn>>;

const HEALTH_STYLE: Record<string, string> = {
  red: "bg-destructive/10 text-destructive border-destructive/30",
  yellow: "bg-saffron/20 text-foreground border-saffron/40",
  green: "bg-leaf/10 text-leaf border-leaf/30",
};

function AiInventoryAlertsPage() {
  const { adminToken } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState("");
  const [urgency, setUrgency] = useState("");
  const [q, setQ] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [trendFor, setTrendFor] = useState<InventoryAlertRow | null>(null);
  const [busy, setBusy] = useState("");
  const { permission, requestPermission } = usePushNotifications(adminToken);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      setBoard(await inventoryAlertsBoardFn({ data: { adminToken } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load inventory alerts");
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const all = board?.rows ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((r) =>
      (!market || r.marketId === market) &&
      (!urgency || r.urgency === urgency) &&
      (r.confidence * 100 >= minConfidence) &&
      (!needle || `${r.productName} ${r.productId} ${r.marketName}`.toLowerCase().includes(needle)));
  }, [board, market, urgency, q, minConfidence]);

  const notify = async (r: InventoryAlertRow) => {
    if (!adminToken) return;
    setBusy(r.key);
    try {
      await notifyMarketReplenishFn({
        data: { adminToken, marketId: r.marketId, productId: r.productId, quantity: r.recommendedQuantity, note: r.recommendation },
      });
      toast.success(`${r.marketName} notified to restock ${r.productName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the notification");
    } finally {
      setBusy("");
    }
  };

  const s = board?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold">AI inventory alerts</h1>
          <p className="text-sm text-muted-foreground">
            Predicted stock-outs across partner supermarkets. Kartogo does not hold stock — nudge the store to replenish.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {permission !== "granted" && permission !== "unsupported" && (
            <button onClick={requestPermission} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <BellRing className="h-4 w-4" /> Enable push
            </button>
          )}
          <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Inventory health", value: s ? `${s.healthScore}%` : "—" },
          { label: "Critical", value: s?.critical ?? "—" },
          { label: "Needs attention", value: s?.high ?? "—" },
          { label: "Tracked records", value: s?.tracked ?? "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-3">
            <div className="text-xs font-semibold text-muted-foreground">{c.label}</div>
            <div className="font-display text-2xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-input px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Filter by supermarket" className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <option value="">All supermarkets</option>
          {(board?.markets ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={urgency} onChange={(e) => setUrgency(e.target.value)} aria-label="Filter by urgency" className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <option value="">All urgency</option>
          <option value="critical">Critical (red)</option>
          <option value="high">Needs attention (yellow)</option>
          <option value="watch">Healthy (green)</option>
        </select>
        <select value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} aria-label="Filter by AI confidence" className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
          <option value={0}>Any AI confidence</option>
          <option value={50}>Confidence 50%+</option>
          <option value={70}>Confidence 70%+ (strong history)</option>
          <option value={85}>Confidence 85%+ (very strong)</option>
        </select>
      </div>

      {loading && !board ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Analysing demand…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No inventory records match these filters.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-extrabold">{r.productName}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${HEALTH_STYLE[r.health]}`}>{r.health}</span>
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-bold" title="How much historical sales data backs this forecast">
                      {Math.round(r.confidence * 100)}% confidence
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.marketName}</div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setTrendFor(trendFor?.key === r.key ? null : r)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    <TrendingUp className="h-4 w-4" /> Trends
                  </button>
                  <button
                    disabled={busy === r.key}
                    onClick={() => void notify(r)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" /> Notify supermarket
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Current", r.currentStock],
                  ["Reserved", r.reservedStock],
                  ["Available", r.availableStock],
                  ["Stock-out", r.stockoutDate ?? "—"],
                  ["Days left", r.daysToStockout ?? "—"],
                  ["Replenish", r.recommendedQuantity],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-secondary/60 px-3 py-2">
                    <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                    <div className="font-bold">{String(value)}</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r.recommendation}</span>
              </p>

              {trendFor?.key === r.key && (
                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...r.history.map((h) => ({ ...h, type: "actual" })), ...r.projection.map((p) => ({ ...p, type: "forecast" }))]}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={28} />
                      <Tooltip />
                      <Line type="monotone" dataKey="units" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Kartogo operates as a marketplace and delivery platform. Purchase orders, distributor management and warehouse
        procurement are intentionally not part of this module — they can be added later if Kartogo runs its own dark stores.
      </p>
    </div>
  );
}
