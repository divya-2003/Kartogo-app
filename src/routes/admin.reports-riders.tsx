import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Bike, Loader2, RefreshCw } from "lucide-react";
import { getRiderReportFn, type RiderRow } from "@/lib/reports.functions";
import { buildCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/admin/reports-riders")({
  component: Page,
  head: () => ({ meta: [{ title: "Delivery partner report — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

const HEADERS: { key: string; label: string; get: (r: RiderRow) => unknown }[] = [
  { key: "riderName", label: "Rider Name", get: r => r.riderName },
  { key: "ordersDelivered", label: "Orders Delivered", get: r => r.ordersDelivered },
  { key: "averageDeliveryTimeMin", label: "Average Delivery Time (min)", get: r => r.averageDeliveryTimeMin ?? "" },
  { key: "onTimePercent", label: "On-Time Delivery %", get: r => `${r.onTimePercent}%` },
  { key: "failedDeliveries", label: "Failed Deliveries", get: r => r.failedDeliveries },
  { key: "customerRating", label: "Customer Rating", get: r => r.customerRating ?? "" },
  { key: "earnings", label: "Earnings", get: r => r.earnings },
];

function Page() {
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const token = adminToken(); if (!token) return;
    setLoading(true);
    try {
      const res = await getRiderReportFn({ data: { adminToken: token } });
      setRows(res.rows);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const download = () => {
    downloadCsv(`kartogo-rider-report-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(rows, HEADERS));
    toast.success("CSV downloaded");
  };

  return (
    <div className="min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-bold sm:text-2xl">
            <Bike className="h-5 w-5 shrink-0 text-primary" /> <span className="truncate">Delivery partner report</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Deliveries, on-time %, ratings and earnings per rider.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={download} disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="min-w-0 rounded-2xl border border-border bg-card">
          <div className="w-full overflow-x-auto">
            <table className="w-max min-w-full text-xs">
              <thead className="bg-secondary/60 text-left">
                <tr>{HEADERS.map(h => <th key={h.key} className="whitespace-nowrap p-2">{h.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.riderName} className="border-t border-border">
                    {HEADERS.map(h => <td key={h.key} className="whitespace-nowrap p-2">{String(h.get(r) ?? "")}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={HEADERS.length} className="p-6 text-center text-muted-foreground">No delivery partners.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
