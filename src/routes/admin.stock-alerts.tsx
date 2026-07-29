import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, RefreshCw, Store } from "lucide-react";
import { useAuth } from "@/lib/store";
import { listStockAlertsFn, updateStockAlertStatusFn, type StockAlert } from "@/lib/stock-alerts.functions";

export const Route = createFileRoute("/admin/stock-alerts")({ component: StockAlertsAdmin });

const NEXT: Record<StockAlert["status"], StockAlert["status"][]> = {
  pending: ["sourcing", "closed"],
  sourcing: ["restocked", "closed"],
  restocked: ["closed"],
  closed: [],
};

const TONE: Record<StockAlert["status"], string> = {
  pending: "bg-destructive/10 text-destructive",
  sourcing: "bg-saffron/20 text-saffron-foreground",
  restocked: "bg-leaf/15 text-leaf",
  closed: "bg-muted text-muted-foreground",
};

function StockAlertsAdmin() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!adminToken) return;
    setLoading(true);
    try { setRows(await listStockAlertsFn({ data: { adminToken } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load requests"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const setStatus = async (id: string, status: StockAlert["status"]) => {
    if (!adminToken) return;
    try {
      await updateStockAlertStatusFn({ data: { adminToken, id, status } });
      setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  };

  const pending = rows.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">Restock requests</h1>
          <p className="text-sm text-muted-foreground">
            Customers who tapped “Notify me” on an out-of-stock product, with the markets we source it from.
          </p>
        </div>
        <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">{pending} pending</span>
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No restock requests yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(r => (
            <div key={r.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-bold">{r.productName || r.productId}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.category || "—"} · {new Date(r.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${TONE[r.status]}`}>{r.status}</span>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words">{r.markets || "No connected markets recorded"}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Customer: {r.customerName || "Guest"}{r.customerPhone ? ` · ${r.customerPhone}` : ""}
              </div>

              {NEXT[r.status].length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {NEXT[r.status].map(s => (
                    <button key={s} onClick={() => void setStatus(r.id, s)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold capitalize hover:bg-secondary">
                      Mark {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
