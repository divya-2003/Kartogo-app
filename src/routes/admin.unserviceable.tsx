import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, ExternalLink, Phone, MapPin, RefreshCw, CheckCircle2, Archive, Loader2 } from "lucide-react";
import {
  listUnserviceableRequestsFn,
  updateUnserviceableStatusFn,
  type UnserviceableRequest,
} from "@/lib/unserviceable.functions";

export const Route = createFileRoute("/admin/unserviceable")({
  component: AdminUnserviceablePage,
  head: () => ({ meta: [{ title: "Unserviceable area requests — Kartogo Admin" }] }),
});

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

const STATUS_LABEL: Record<UnserviceableRequest["status"], string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  closed: "Closed",
};

function AdminUnserviceablePage() {
  const [rows, setRows] = useState<UnserviceableRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | UnserviceableRequest["status"]>("pending");

  const load = async () => {
    const token = adminToken(); if (!token) return;
    setLoading(true);
    try {
      const data = await listUnserviceableRequestsFn({ data: { adminToken: token } });
      setRows(data);
      // Mark seen for badge clearing
      localStorage.setItem("kartogo_unserv_seen_count", String(data.length));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: UnserviceableRequest["status"]) => {
    const token = adminToken(); if (!token) return;
    try {
      await updateUnserviceableStatusFn({ data: { adminToken: token, id, status } });
      setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const visible = rows.filter(r => filter === "all" ? true : r.status === filter);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Inbox className="h-6 w-6 text-primary" /> Unserviceable area requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers who asked Kartogo to expand to their area. Live location and area details attached.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto">
        {(["pending", "reviewed", "closed", "all"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s === "all" ? "All" : STATUS_LABEL[s]} ({s === "all" ? rows.length : rows.filter(r => r.status === s).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No requests here yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(r => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold">Pincode {r.pincode ?? "—"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "pending" ? "bg-saffron/20 text-saffron-foreground" : r.status === "reviewed" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </div>
                  {r.areaText && (
                    <div className="mt-2 flex items-start gap-1 text-sm">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{r.areaText}</span>
                    </div>
                  )}
                  {r.note && <p className="mt-1 text-xs italic text-muted-foreground">"{r.note}"</p>}
                  {r.phone && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs font-semibold">
                      <Phone className="h-3.5 w-3.5" /> {r.phone}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {r.lat != null && r.lng != null && (
                    <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Maps
                    </a>
                  )}
                </div>
              </div>

              {r.lat != null && r.lng != null && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                  <iframe title={`Location ${r.id}`} src={`https://maps.google.com/maps?q=${r.lat},${r.lng}&z=14&output=embed`} className="h-40 w-full" loading="lazy" />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.status !== "reviewed" && (
                  <button onClick={() => setStatus(r.id, "reviewed")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark reviewed
                  </button>
                )}
                {r.status !== "closed" && (
                  <button onClick={() => setStatus(r.id, "closed")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                    <Archive className="h-3.5 w-3.5" /> Close
                  </button>
                )}
                {r.status !== "pending" && (
                  <button onClick={() => setStatus(r.id, "pending")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                    Re-open
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
