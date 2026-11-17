import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { listStudioCustomersFn, saveCustomerNoteFn } from "@/lib/studio.functions";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { Empty, EnquiryBadge, ErrorBox, Loading, PageHeader, Pager, Spinner, StatusBadge, btnPrimary, fmtDate, fmtTime, fmtWhen, inputCls } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/customers")({
  component: Customers,
  head: () => ({ meta: [{ title: "Customers — Partner Studio" }, { name: "description", content: "Customers who booked or enquired, with their history and your notes." }] }),
});

const PER = 12;
function Customers() {
  const { token, partnerId, me } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("customers", (a) => listStudioCustomersFn({ data: a }));
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => (q.data ?? []).filter((c: any) => !term || `${c.name} ${c.phone}`.toLowerCase().includes(term.toLowerCase())), [q.data, term]);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const c = (q.data ?? []).find((x: any) => x.key === openKey);
  const saveNote = async () => {
    if (!c) return;
    setBusy(true);
    const r = await saveCustomerNoteFn({ data: { token, partnerId, key: c.key, note } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Note saved"); qc.invalidateQueries({ queryKey: ["studio-customers"] });
  };
  return (
    <div>
      <PageHeader title="Customers" crumb="Customers" sub="Everyone who booked or enquired with you. Mobile numbers stay masked for privacy." />
      <input aria-label="Search customers" placeholder="Search by name" value={term} onChange={e => { setTerm(e.target.value); setPage(1); }} className={`${inputCls} mb-3 max-w-xs`} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : rows.length === 0 ? <Empty title="No customers yet" /> : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ul className="space-y-2">{rows.slice((page - 1) * PER, page * PER).map((x: any) => (
              <li key={x.key}><button onClick={() => { setOpenKey(x.key); setNote(x.note ?? ""); }} className={`w-full rounded-xl border bg-card p-3 text-left ${openKey === x.key ? "border-brand-navy" : "border-border"}`}>
                <div className="flex justify-between gap-2"><span className="truncate font-semibold">{x.name}</span><span className="text-xs text-muted-foreground">{x.phone}</span></div>
                <div className="text-xs text-muted-foreground">{x.bookings.length} bookings · {x.completed} completed · {x.cancelled} cancelled{me?.partner.kind === "furniture" ? ` · ${x.enquiries.length} enquiries` : ""}</div>
                <div className="text-[11px] text-muted-foreground">Last activity {fmtWhen(x.lastActivity)}</div>
              </button></li>
            ))}</ul>
            <Pager page={page} pages={pages} onPage={setPage} />
          </div>
          <div className="lg:col-span-3">
            {!c ? <Empty title="Select a customer" body="See their bookings, enquiries and your private notes." /> : (
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div><h2 className="text-lg font-semibold">{c.name}</h2><div className="text-sm text-muted-foreground">{c.phone} · {c.completed} completed · {c.cancelled} cancelled</div></div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">Booking history</div>
                  {c.bookings.length === 0 ? <p className="text-sm text-muted-foreground">No bookings.</p> : <ul className="divide-y divide-border text-sm">{c.bookings.map((b: any) => (
                    <li key={b.id} className="flex items-center gap-2 py-2"><span className="min-w-0 flex-1 truncate">{fmtDate(b.booking_date)} {fmtTime(b.start_time)} · {b.appointment_type ?? b.listing?.name ?? "Booking"} · {b.booking_code}</span><StatusBadge s={b.appointment_status} /></li>
                  ))}</ul>}
                </div>
                {me?.partner.kind === "furniture" && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Enquiry history</div>
                    {c.enquiries.length === 0 ? <p className="text-sm text-muted-foreground">No enquiries.</p> : <ul className="divide-y divide-border text-sm">{c.enquiries.map((e: any) => (
                      <li key={e.id} className="flex items-center gap-2 py-2"><span className="min-w-0 flex-1 truncate">{fmtWhen(e.created_at)} · {e.listing?.name ?? "General"} — {e.message}</span><EnquiryBadge s={e.status} /></li>
                    ))}</ul>}
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">Private notes (only you see these)</div>
                  <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="e.g. Prefers evening visits, interested in teak finish" />
                  <div className="mt-2 flex justify-end"><button disabled={busy} onClick={saveNote} className={btnPrimary}>{busy && <Spinner />}Save note</button></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
