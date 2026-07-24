import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Package, Loader2, RefreshCw } from "lucide-react";
import { getProductAnalyticsFn, type ProductRow } from "@/lib/reports.functions";
import { buildCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/admin/reports-products")({
  component: Page,
  head: () => ({ meta: [{ title: "Product analytics — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

const HEADERS: { key: string; label: string; get: (r: ProductRow) => unknown }[] = [
  { key: "productName", label: "Product Name", get: r => r.productName },
  { key: "sku", label: "SKU", get: r => r.sku },
  { key: "category", label: "Category", get: r => r.category },
  { key: "unitsSold", label: "Units Sold", get: r => r.unitsSold },
  { key: "revenue", label: "Revenue", get: r => r.revenue },
  { key: "ordersCount", label: "Number of Orders", get: r => r.ordersCount },
  { key: "averageSellingPrice", label: "Average Selling Price", get: r => r.averageSellingPrice },
  { key: "lastSoldDate", label: "Last Sold Date", get: r => r.lastSoldDate ?? "" },
  { key: "available", label: "Current Availability", get: r => (r.available ? `In stock (${r.currentStock})` : "Out of stock") },
];

type SortKey = "best" | "least" | "revenue";

function Page() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("best");

  const load = async () => {
    const token = adminToken(); if (!token) return;
    setLoading(true);
    try {
      const res = await getProductAnalyticsFn({ data: { adminToken: token } });
      setRows(res.rows);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "best") copy.sort((a, b) => b.unitsSold - a.unitsSold);
    else if (sort === "least") copy.sort((a, b) => a.unitsSold - b.unitsSold);
    else copy.sort((a, b) => b.revenue - a.revenue);
    return copy;
  }, [rows, sort]);

  const download = () => {
    downloadCsv(`kartogo-product-analytics-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(sorted, HEADERS));
    toast.success("CSV downloaded");
  };

  return (
    <div className="min-w-0 space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-xl font-bold sm:text-2xl">
            <Package className="h-5 w-5 shrink-0 text-primary" /> <span className="truncate">Product analytics</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Units sold, revenue and availability for every SKU.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={download} disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-bold uppercase text-muted-foreground">Sort</span>
        {([
          { k: "best", label: "Best Selling" },
          { k: "least", label: "Least Selling" },
          { k: "revenue", label: "Highest Revenue" },
        ] as const).map(o => (
          <button key={o.k} onClick={() => setSort(o.k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${sort === o.k ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>{o.label}</button>
        ))}
      </div>

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
                {sorted.map(r => (
                  <tr key={r.productId} className="border-t border-border">
                    {HEADERS.map(h => <td key={h.key} className="whitespace-nowrap p-2">{String(h.get(r) ?? "")}</td>)}
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={HEADERS.length} className="p-6 text-center text-muted-foreground">No products.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
