import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Sheet, Loader2, RefreshCw } from "lucide-react";
import { getSalesDatasetFn, type SalesDataset } from "@/lib/sales-dataset.functions";

export const Route = createFileRoute("/admin/sales")({
  component: AdminSalesPage,
  head: () => ({ meta: [{ title: "Sales dataset — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(ds: SalesDataset): string {
  const baseHeaders = [
    "order_id", "created_at", "status", "payment_method",
    "customer_name", "customer_phone", "address",
    "number_of_items", "subtotal", "delivery_fee", "discount", "surge_amount", "total",
    "cancelled", "returned", "cancel_reason", "refund_status",
  ];
  const itemHeaders = ds.productIds.map(pid => {
    const name = ds.productNamesById[pid] || pid;
    return `item:${pid} (${name})`;
  });
  const headers = [...baseHeaders, ...itemHeaders];

  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (const r of ds.rows) {
    const base = [
      r.orderId, r.createdAt, r.status, r.paymentMethod,
      r.customerName, r.customerPhone, r.address,
      r.numberOfItems, r.subtotal, r.deliveryFee, r.discount, r.surgeAmount, r.total,
      r.cancelled ? "yes" : "no", r.returned ? "yes" : "no",
      r.cancelReason, r.refundStatus,
    ];
    const items = ds.productIds.map(pid => r.itemQtyByProductId[pid] ?? 0);
    lines.push([...base, ...items].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function AdminSalesPage() {
  const [ds, setDs] = useState<SalesDataset | null>(null);
  const [loading, setLoading] = useState(true);

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

  const stats = useMemo(() => {
    if (!ds) return null;
    const delivered = ds.rows.filter(r => r.status === "delivered").length;
    const cancelled = ds.rows.filter(r => r.cancelled).length;
    const returned = ds.rows.filter(r => r.returned).length;
    const totalRevenue = ds.rows.filter(r => r.status === "delivered").reduce((s, r) => s + r.total, 0);
    return { total: ds.rows.length, delivered, cancelled, returned, totalRevenue };
  }, [ds]);

  const downloadCsv = () => {
    if (!ds) return;
    const csv = buildCsv(ds);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kartogo-sales-dataset-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const previewRows = ds?.rows.slice(0, 10) ?? [];
  const previewProductIds = ds?.productIds.slice(0, 6) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Sheet className="h-6 w-6 text-primary" /> Sales dataset
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per order, with per-item quantities across every catalog product. Cancelled and returned orders are recorded too.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={downloadCsv} disabled={!ds || ds.rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !ds ? null : (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "Total orders", value: stats.total },
                { label: "Delivered", value: stats.delivered },
                { label: "Cancelled", value: stats.cancelled },
                { label: "Returned", value: stats.returned },
                { label: "Revenue (delivered)", value: `₹${stats.totalRevenue.toLocaleString("en-IN")}` },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-3">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground">{s.label}</div>
                  <div className="mt-1 font-display text-lg font-bold">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="p-2">Order</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Items</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Cancelled</th>
                  <th className="p-2">Returned</th>
                  {previewProductIds.map(pid => (
                    <th key={pid} className="p-2 whitespace-nowrap">{ds.productNamesById[pid] ?? pid}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map(r => (
                  <tr key={r.orderId} className="border-t border-border">
                    <td className="p-2 font-mono">{r.orderId.slice(0, 8)}</td>
                    <td className="p-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">{r.numberOfItems}</td>
                    <td className="p-2">₹{r.total.toLocaleString("en-IN")}</td>
                    <td className="p-2">{r.cancelled ? "yes" : "no"}</td>
                    <td className="p-2">{r.returned ? "yes" : "no"}</td>
                    {previewProductIds.map(pid => (
                      <td key={pid} className="p-2 text-center">{r.itemQtyByProductId[pid] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                {ds.rows.length === 0 && (
                  <tr><td colSpan={7 + previewProductIds.length} className="p-6 text-center text-muted-foreground">No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {ds.rows.length > previewRows.length && (
            <p className="text-xs text-muted-foreground">
              Showing first {previewRows.length} of {ds.rows.length} orders and {previewProductIds.length} of {ds.productIds.length} product columns. Download the CSV for the complete dataset.
            </p>
          )}
        </>
      )}
    </div>
  );
}
