import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Sheet as SheetIcon, Loader2, RefreshCw, Filter } from "lucide-react";
import { getSalesDatasetFn, type SalesDataset, type SalesRow } from "@/lib/reports.functions";
import { buildCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/admin/sales")({
  component: AdminSalesPage,
  head: () => ({ meta: [{ title: "Sales dataset — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

const HEADERS: { key: string; label: string; get: (r: SalesRow) => unknown }[] = [
  { key: "orderId", label: "Order ID", get: r => r.orderId },
  { key: "orderDate", label: "Order Date", get: r => r.orderDate },
  { key: "orderTime", label: "Order Time", get: r => r.orderTime },
  { key: "customerName", label: "Customer Name", get: r => r.customerName ?? "" },
  { key: "customerPhone", label: "Customer Phone", get: r => r.customerPhone ?? "" },
  { key: "address", label: "Delivery Address", get: r => r.address ?? "" },
  { key: "area", label: "Area/Locality", get: r => r.area },
  { key: "vendor", label: "Supermarket/Vendor", get: r => r.vendor },
  { key: "deliveryPartner", label: "Delivery Partner", get: r => r.deliveryPartner },
  { key: "paymentMethod", label: "Payment Method", get: r => r.paymentMethod },
  { key: "paymentStatus", label: "Payment Status", get: r => r.paymentStatus },
  { key: "orderStatus", label: "Order Status", get: r => r.orderStatus },
  { key: "totalItems", label: "Total Items", get: r => r.totalItems },
  { key: "itemsOrdered", label: "Items Ordered", get: r => r.itemsOrdered },
  { key: "orderValue", label: "Order Value", get: r => r.orderValue },
  { key: "deliveryFee", label: "Delivery Fee", get: r => r.deliveryFee },
  { key: "convenienceFee", label: "Convenience Fee", get: r => r.convenienceFee },
  { key: "merchantCommission", label: "Merchant Commission", get: r => r.merchantCommission },
  { key: "platformProfit", label: "Platform Profit", get: r => r.platformProfit },
  { key: "deliveryCost", label: "Delivery Cost", get: r => r.deliveryCost },
  { key: "netProfit", label: "Net Profit", get: r => r.netProfit },
  { key: "deliveryTimeMin", label: "Delivery Time (min)", get: r => r.deliveryTimeMin ?? "" },
  { key: "customerRating", label: "Customer Rating", get: r => r.customerRating ?? "" },
];

function AdminSalesPage() {
  const [ds, setDs] = useState<SalesDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vendor, setVendor] = useState("");
  const [rider, setRider] = useState("");
  const [status, setStatus] = useState("");
  const [pm, setPm] = useState("");
  const [area, setArea] = useState("");

  const load = async () => {
    const token = adminToken(); if (!token) return;
    setLoading(true);
    try {
      const data = await getSalesDatasetFn({ data: { adminToken: token } });
      setDs(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!ds) return [] as SalesRow[];
    return ds.rows.filter(r =>
      (!from || r.orderDate >= from) &&
      (!to || r.orderDate <= to) &&
      (!vendor || r.vendor === vendor) &&
      (!rider || r.deliveryPartner === rider) &&
      (!status || r.orderStatus === status) &&
      (!pm || r.paymentMethod === pm) &&
      (!area || r.area === area)
    );
  }, [ds, from, to, vendor, rider, status, pm, area]);

  const stats = useMemo(() => {
    if (!ds) return null;
    const delivered = filtered.filter(r => r.orderStatus.toLowerCase() === "delivered").length;
    const totalRevenue = filtered.filter(r => r.orderStatus.toLowerCase() === "delivered").reduce((s, r) => s + r.orderValue, 0);
    const netProfit = filtered.reduce((s, r) => s + r.netProfit, 0);
    return { total: filtered.length, delivered, totalRevenue, netProfit };
  }, [ds, filtered]);

  const download = () => {
    if (!ds) return;
    const csv = buildCsv(filtered, HEADERS);
    downloadCsv(`kartogo-sales-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("CSV downloaded");
  };

  const previewRows = filtered.slice(0, 15);

  return (
    <div className="min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-bold sm:text-2xl">
            <SheetIcon className="h-5 w-5 shrink-0 text-primary" /> <span className="truncate">Sales dataset</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">One row per order — full breakdown with filters and CSV export.</p>
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
          {/* Filters */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filters</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">From</span>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">To</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Vendor</span>
                <select value={vendor} onChange={e => setVendor(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Delivery Partner</span>
                <select value={rider} onChange={e => setRider(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.deliveryPartners.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Order Status</span>
                <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.orderStatuses.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Payment</span>
                <select value={pm} onChange={e => setPm(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.paymentMethods.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs"><span className="font-semibold">Area</span>
                <select value={area} onChange={e => setArea(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
                  <option value="">All</option>
                  {ds.areas.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Orders", value: stats.total },
                { label: "Delivered", value: stats.delivered },
                { label: "Revenue", value: `₹${stats.totalRevenue.toLocaleString("en-IN")}` },
                { label: "Net profit", value: `₹${Math.round(stats.netProfit).toLocaleString("en-IN")}` },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-3">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">{s.label}</div>
                  <div className="mt-1 truncate font-display text-base font-bold sm:text-lg">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Preview table — horizontally scrollable inside its own container */}
          <div className="min-w-0 rounded-2xl border border-border bg-card">
            <div className="w-full overflow-x-auto">
              <table className="w-max min-w-full text-xs">
                <thead className="bg-secondary/60 text-left">
                  <tr>
                    {HEADERS.map(h => <th key={h.key} className="whitespace-nowrap p-2">{h.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(r => (
                    <tr key={r.orderId} className="border-t border-border">
                      {HEADERS.map(h => (
                        <td key={h.key} className="whitespace-nowrap p-2">{String(h.get(r) ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={HEADERS.length} className="p-6 text-center text-muted-foreground">No orders match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {filtered.length > previewRows.length && (
            <p className="text-xs text-muted-foreground">
              Showing first {previewRows.length} of {filtered.length} filtered orders. Download the CSV for the complete dataset.
            </p>
          )}
        </>
      )}
    </div>
  );
}
