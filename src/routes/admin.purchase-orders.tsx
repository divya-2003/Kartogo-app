import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/store";
import { listPurchaseOrdersFn, setPurchaseOrderStatusFn } from "@/lib/inventory.functions";

export const Route = createFileRoute("/admin/purchase-orders")({
  component: PurchaseOrdersPage,
  head: () => ({
    meta: [
      { title: "Purchase orders — Kartogo admin" },
      { name: "description", content: "Approve auto-generated replenishment purchase orders for every supermarket." },
    ],
  }),
});

type Line = { id: string; product_name: string; product_id: string; quantity: number; unit_cost: number };
type PO = { id: string; market_name: string; status: string; expected_cost: number; auto_generated: boolean; notes: string | null; created_at: string; items: Line[] };

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-saffron/20 text-saffron-foreground",
  approved: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/10 text-destructive",
  delivered: "bg-primary/10 text-primary",
};

const NEXT: Record<string, string[]> = {
  draft: ["pending_approval", "rejected"],
  pending_approval: ["approved", "rejected"],
  approved: ["delivered", "rejected"],
  rejected: [],
  delivered: [],
};

function PurchaseOrdersPage() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const { purchaseOrders } = await listPurchaseOrdersFn({ data: { adminToken } });
      setRows(purchaseOrders as PO[]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load purchase orders"); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    if (!adminToken) return;
    try {
      await setPurchaseOrderStatusFn({ data: { adminToken, id, status } });
      toast.success(`Purchase order ${status.replace("_", " ")}`);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">Drafts are created automatically when stock hits the reorder level. Approve before sending to the supplier.</p>
        </div>
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No purchase orders yet. They appear here automatically when a product reaches its reorder level.
        </div>
      ) : rows.map((po) => (
        <div key={po.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="font-display text-lg font-bold">{po.market_name || "Store"}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[po.status] ?? TONE.draft}`}>{po.status.replace("_", " ")}</span>
            {po.auto_generated && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">auto</span>}
            <span className="ml-auto text-sm font-bold">₹{Math.round(Number(po.expected_cost))}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Created {new Date(po.created_at).toLocaleString("en-IN")}{po.notes ? ` · ${po.notes}` : ""}</p>

          <div className="mt-3 -mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1">Product</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th><th className="text-right">Line total</th></tr>
              </thead>
              <tbody>
                {po.items.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-1.5">{l.product_name || l.product_id}</td>
                    <td className="text-right">{l.quantity}</td>
                    <td className="text-right">₹{Number(l.unit_cost)}</td>
                    <td className="text-right font-semibold">₹{Math.round(l.quantity * Number(l.unit_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(NEXT[po.status] ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(NEXT[po.status] ?? []).map((s) => (
                <button key={s} onClick={() => void setStatus(po.id, s)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${s === "rejected" ? "border border-destructive text-destructive hover:bg-destructive/10" : "bg-primary text-primary-foreground"}`}>
                  {s === "pending_approval" ? "Send for approval" : s === "approved" ? "Approve" : s === "delivered" ? "Mark delivered (add stock)" : "Reject"}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
