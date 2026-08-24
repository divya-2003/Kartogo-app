import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/data";
import { listPendingTopupsFn, confirmWalletTopupFn } from "@/lib/wallet.functions";

type Pending = { id: string; phone: string; amount: number; created_at: string };

/**
 * Wallet top-ups are never credited by the browser. Each request lands here as
 * "pending" and only becomes Kartogo Cash once an admin confirms the payment
 * actually arrived (or a verified gateway callback approves it).
 */
export function PendingTopups() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminToken) { setRows([]); return; }
    try {
      const { topups } = await listPendingTopupsFn({ data: { adminToken } });
      setRows(topups as unknown as Pending[]);
    } catch { /* non-blocking */ }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const review = async (id: string, approve: boolean) => {
    if (!adminToken) return;
    setBusy(id);
    try {
      await confirmWalletTopupFn({ data: { adminToken, topupId: id, approve } });
      toast.success(approve ? "Wallet credited" : "Top-up rejected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update top-up");
    } finally { setBusy(null); }
  };

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-pop">
      <h2 className="font-display text-lg font-bold">Wallet top-ups awaiting verification</h2>
      <p className="text-sm text-muted-foreground">Credit Kartogo Cash only after confirming the payment.</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.phone}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="font-display text-base font-bold">{formatINR(Number(r.amount))}</div>
            <div className="flex gap-2">
              <button
                disabled={busy === r.id}
                onClick={() => void review(r.id, true)}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                Approve
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => void review(r.id, false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
