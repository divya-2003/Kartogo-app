import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { getDailySummaryFn, type DailyDataset, type DailyRow } from "@/lib/reports.functions";
import { buildCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/admin/reports-daily")({
  component: Page,
  head: () => ({ meta: [{ title: "Daily business summary — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

const HEADERS: { key: string; label: string; get: (r: DailyRow) => unknown }[] = [
  { key: "date", label: "Date", get: r => r.date },
  { key: "totalOrders", label: "Total Orders", get: r => r.totalOrders },
  { key: "completedOrders", label: "Completed Orders", get: r => r.completedOrders },
  { key: "cancelledOrders", label: "Cancelled Orders", get: r => r.cancelledOrders },
  { key: "returnedOrders", label: "Returned Orders", get: r => r.returnedOrders },
  { key: "grossSales", label: "Gross Sales", get: r => r.grossSales },
  { key: "deliveryFeeCollected", label: "Delivery Fee Collected", get: r => r.deliveryFeeCollected },
  { key: "convenienceFeeCollected", label: "Convenience Fee Collected", get: r => r.convenienceFeeCollected },
  { key: "merchantCommission", label: "Merchant Commission Earned", get: r => r.merchantCommission },
  { key: "totalDeliveryCost", label: "Total Delivery Cost", get: r => r.totalDeliveryCost },
  { key: "totalPlatformProfit", label: "Total Platform Profit", get: r => r.totalPlatformProfit },
  { key: "averageOrderValue", label: "Average Order Value", get: r => r.averageOrderValue },
  { key: "newCustomers", label: "New Customers", get: r => r.newCustomers },
  { key: "repeatCustomers", label: "Repeat Customers", get: r => r.repeatCustomers },
  { key: "vendor", label: "Vendor", get: r => r.vendor },
  { key: "area", label: "Area", get: r => r.area },
];

function Page() {
  const [ds, setDs] = useState<DailyDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [vendor, setVendor] = useState("");
  const [area, setArea] = useState("");

  const load = async () => {
    const token = adminToken(); if (!token) return;
    setLoading(true);
    try {
      setDs(await getDailySummaryFn({ data: { adminToken: token } }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!ds) return [] as DailyRow[];
    return ds.rows.filter(r =>
      (!month || r.date.startsWith(month)) &&
      (!year || r.date.startsWith(year)) &&
      (!vendor || r.vendor === vendor) &&
      (!area || r.area === area)
    );
  }, [ds, month, year, vendor, area]);

  const download = () => {
    if (!ds) return;
    downloadCsv(`kartogo-daily-summary-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(filtered, HEADERS));
    toast.success("CSV downloaded");
  };

  return (
    <div className="min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-bold sm:text-2xl">
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" /> <span className="truncate">Daily business summary</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">One row per day — grouped by vendor and area.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={download} disabled={!ds || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !ds ? null : (
        <>
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Month</span>
                <select value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Year</span>
                <select value={year} onChange={e => setYear(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Vendor</span>
                <select value={vendor} onChange={e => setVendor(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Area</span>
                <select value={area} onChange={e => setArea(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-border bg-card">
            <div className="w-full overflow-x-auto">
              <table className="w-max min-w-full text-xs">
                <thead className="bg-secondary/60 text-left">
                  <tr>{HEADERS.map(h => <th key={h.key} className="whitespace-nowrap p-2">{h.label}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.date}-${r.vendor}-${r.area}-${i}`} className="border-t border-border">
                      {HEADERS.map(h => <td key={h.key} className="whitespace-nowrap p-2">{String(h.get(r) ?? "")}</td>)}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={HEADERS.length} className="p-6 text-center text-muted-foreground">No data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
