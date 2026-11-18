import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Send } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { listEnquiriesFn, respondEnquiryFn, listInventoryFn } from "@/lib/studio.functions";
import { ENQUIRY_LABEL, ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/studio";
import { useStudio, useStudioQuery, unwrap } from "@/components/studio/StudioContext";
import { NewAppointmentDialog } from "@/components/studio/AppointmentActions";
import { Empty, EnquiryBadge, ErrorBox, Loading, PageHeader, Spinner, btnOutline, btnPrimary, fmtWhen, inputCls } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/enquiries")({
  component: Enquiries,
  head: () => ({ meta: [{ title: "Customer Enquiries — Partner Studio" }, { name: "description", content: "Reply to customer questions and turn them into appointments." }] }),
});

function Enquiries() {
  const { token, partnerId } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("enquiries", (a) => listEnquiriesFn({ data: a }), [], { refetchInterval: 30_000 });
  const [status, setStatus] = useState<"" | EnquiryStatus>("");
  const [term, setTerm] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState<any | null>(null);
  const products = useQuery({ queryKey: ["studio-inventory-lite", partnerId], queryFn: async () => (await unwrap(listInventoryFn({ data: { token, partnerId } }))).products, enabled: !!converting });
  const rows = useMemo(() => (q.data ?? []).filter((e: any) => (!status || e.status === status) && (!term || `${e.customer_name ?? ""} ${e.message} ${e.listing?.name ?? ""}`.toLowerCase().includes(term.toLowerCase()))), [q.data, status, term]);
  const current = rows.find((e: any) => e.id === openId) ?? (q.data ?? []).find((e: any) => e.id === openId);
  const reload = () => { qc.invalidateQueries({ queryKey: ["studio-enquiries"] }); qc.invalidateQueries({ queryKey: ["studio-overview"] }); };
  const send = async (payload: { message?: string; status?: "NEW" | "RESPONDED" | "IN_PROGRESS" | "CLOSED" }) => {
    if (!current) return;
    setBusy(true);
    const r = await respondEnquiryFn({ data: { token, partnerId, id: current.id, ...payload } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    if (payload.message) { setReply(""); toast.success("Reply sent to the customer"); } else toast.success("Status updated");
    reload();
  };
  return (
    <div>
      <PageHeader title="Customer Enquiries" crumb="Customer Enquiries" sub="Questions customers asked about your products." />
      <div className="mb-3 flex flex-wrap gap-2">
        <input aria-label="Search enquiries" placeholder="Search customer, product or message" value={term} onChange={e => setTerm(e.target.value)} className={`${inputCls} max-w-xs`} />
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as never)} className={`${inputCls} w-48`}><option value="">All statuses</option>{ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{ENQUIRY_LABEL[s]}</option>)}</select>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : rows.length === 0 ? <Empty title="No enquiries" body="When a customer taps “Ask the seller” on a product, it shows up here." /> : (
        <div className="grid gap-4 lg:grid-cols-5">
          <ul className="space-y-2 lg:col-span-2">{rows.map((e: any) => (
            <li key={e.id}><button onClick={() => setOpenId(e.id)} className={`w-full rounded-xl border bg-card p-3 text-left ${openId === e.id ? "border-brand-navy" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{e.customer_name || "Customer"}</span><EnquiryBadge s={e.status} /></div>
              <div className="truncate text-xs text-muted-foreground">{e.listing?.name ?? "General enquiry"} · {fmtWhen(e.created_at)}</div>
              <p className="mt-1 line-clamp-2 text-sm">{e.message}</p>
            </button></li>
          ))}</ul>
          <div className="lg:col-span-3">
            {!current ? <Empty title="Select an enquiry" body="Open an enquiry to see the full history and reply." /> : (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h2 className="font-semibold">{current.customer_name || "Customer"} <span className="text-sm font-normal text-muted-foreground">· {current.customer_phone}</span></h2>
                    <div className="text-sm text-muted-foreground">Interested in <b className="text-foreground">{current.listing?.name ?? "your products"}</b> · {fmtWhen(current.created_at)}</div></div>
                  <EnquiryBadge s={current.status} />
                </div>
                <ol className="mt-4 space-y-2">{current.events.map((ev: any) => (
                  <li key={ev.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${ev.kind !== "MESSAGE" ? "mx-auto bg-transparent text-center text-xs text-muted-foreground" : ev.actor === "SELLER" ? "ml-auto bg-brand-navy text-brand-on-navy" : "bg-secondary"}`}>
                    {ev.message}<div className={`mt-0.5 text-[10px] ${ev.actor === "SELLER" && ev.kind === "MESSAGE" ? "text-brand-on-navy/70" : "text-muted-foreground"}`}>{fmtWhen(ev.created_at)}</div>
                  </li>
                ))}</ol>
                {current.status !== "CLOSED" && current.status !== "CONVERTED" && (
                  <div className="mt-4 flex gap-2"><textarea aria-label="Reply" rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply — the customer gets it as a notification" className={inputCls} />
                    <button disabled={busy || !reply.trim()} onClick={() => send({ message: reply.trim() })} className={btnPrimary}>{busy ? <Spinner /> : <Send className="h-4 w-4" />}Send</button></div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.status !== "CONVERTED" && <button className={btnPrimary} onClick={() => setConverting(current)}><CalendarPlus className="h-4 w-4" />Convert to appointment</button>}
                  {current.status !== "IN_PROGRESS" && current.status !== "CONVERTED" && current.status !== "CLOSED" && <button disabled={busy} className={btnOutline} onClick={() => send({ status: "IN_PROGRESS" })}>Mark in progress</button>}
                  {current.status !== "CLOSED" && current.status !== "CONVERTED" && <button disabled={busy} className={btnOutline} onClick={() => send({ status: "CLOSED" })}>Close enquiry</button>}
                  {current.status === "CLOSED" && <button disabled={busy} className={btnOutline} onClick={() => send({ status: "IN_PROGRESS" })}>Reopen</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {converting && <NewAppointmentDialog enquiry={{ id: converting.id, customer_name: converting.customer_name, listing_id: converting.listing?.id ?? null }} listings={(products.data ?? []) as any[]} onClose={() => setConverting(null)} onDone={() => { setConverting(null); reload(); qc.invalidateQueries({ queryKey: ["studio-appointments"] }); }} />}
    </div>
  );
}
