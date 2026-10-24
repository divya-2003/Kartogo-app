import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Store, MapPin, Phone } from "lucide-react";
import { useAuth } from "@/lib/store";
import { listPartnerApplicationsFn, setPartnerApplicationStatusFn } from "@/lib/partner-applications.functions";

export const Route = createFileRoute("/admin/partner-applications")({
  component: ApplicationsPage,
  head: () => ({
    meta: [
      { title: "Partner applications — Kartogo admin" },
      { name: "description", content: "Review seller applications with business, GSTIN and FSSAI details." },
      { property: "og:title", content: "Partner applications — Kartogo admin" },
      { property: "og:description", content: "Review Kartogo partner seller applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type App = Awaited<ReturnType<typeof listPartnerApplicationsFn>>[number];
const STATUSES = ["new", "contacted", "approved", "rejected"] as const;

function ApplicationsPage() {
  const { adminToken } = useAuth();
  const [rows, setRows] = useState<App[] | null>(null);
  const [filter, setFilter] = useState<string>("new");

  const load = useCallback(async () => {
    if (!adminToken) return;
    try { setRows(await listPartnerApplicationsFn({ data: { token: adminToken } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load applications"); }
  }, [adminToken]);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: (typeof STATUSES)[number]) => {
    if (!adminToken) return;
    try {
      await setPartnerApplicationStatusFn({ data: { token: adminToken, id, status } });
      setRows(r => r?.map(a => a.id === id ? { ...a, status } : a) ?? r);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  };

  const shown = (rows ?? []).filter(a => filter === "all" || a.status === filter);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><Store className="h-5 w-5 text-primary" /> Partner applications</h1>
        <p className="text-sm text-muted-foreground">Sellers who applied from Become a Partner, with their business and licence details.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {s} {rows ? `(${s === "all" ? rows.length : rows.filter(a => a.status === s).length})` : ""}
          </button>
        ))}
      </div>
      {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No applications here yet.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map(a => (
            <article key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-extrabold">{a.business_name}</div>
                  <div className="text-xs text-muted-foreground">{a.partner_type} · {new Date(a.created_at).toLocaleDateString("en-IN")}</div>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold capitalize">{a.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{a.owner_name} · +91 {a.phone}{a.email ? ` · ${a.email}` : ""}</div>
                <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{a.address}, {a.city} {a.pincode}{a.lat != null && a.lng != null && <> · <a className="font-semibold text-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}>Map</a></>}</span></div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Detail label="GSTIN" value={a.gstin} />
                <Detail label="FSSAI" value={a.fssai} />
                <Detail label="PAN" value={a.pan} />
              </dl>
              {a.categories && <p className="mt-2 text-xs text-muted-foreground">Sells: {a.categories}</p>}
              {a.notes && <p className="mt-1 text-xs text-muted-foreground">Note: {a.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.filter(s => s !== a.status).map(s => (
                  <button key={s} onClick={() => void setStatus(a.id, s)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold capitalize hover:bg-secondary">Mark {s}</button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg bg-secondary/60 p-2"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono font-semibold">{value || "—"}</dd></div>;
}
