import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { listStudioReviewsFn, replyReviewFn } from "@/lib/studio.functions";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { Empty, ErrorBox, Kpi, Loading, PageHeader, Spinner, btnOutline, btnPrimary, fmtWhen, inputCls } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/reviews")({
  component: Reviews,
  head: () => ({ meta: [{ title: "Reviews — Partner Studio" }, { name: "description", content: "Customer ratings and reviews with your replies." }] }),
});

function Reviews() {
  const q = useStudioQuery("reviews", (a) => listStudioReviewsFn({ data: a }));
  const [stars, setStars] = useState(0);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const all = q.data ?? [];
  const rows = all.filter((r: any) => !stars || Math.round(Number(r.rating)) === stars);
  const avg = all.length ? all.reduce((s: number, r: any) => s + Number(r.rating), 0) / all.length : 0;
  return (
    <div>
      <PageHeader title="Reviews" crumb="Reviews" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Average rating" value={all.length ? avg.toFixed(1) : "—"} />
        <Kpi label="Reviews" value={all.length} />
        <Kpi label="Replied" value={all.filter((r: any) => r.reply).length} tone="good" />
        <Kpi label="Awaiting reply" value={all.filter((r: any) => !r.reply).length} tone={all.some((r: any) => !r.reply) ? "warn" : "default"} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">{[0, 5, 4, 3, 2, 1].map(s => <button key={s} onClick={() => setStars(s)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${stars === s ? "border-brand-navy bg-brand-navy text-brand-on-navy" : "border-border bg-card"}`}>{s ? `${s}★` : "All"}</button>)}</div>
      {rows.length === 0 ? <Empty title="No reviews yet" body="Reviews customers leave after a visit or delivery show up here." /> : <ul className="space-y-2">{rows.map((r: any) => <ReviewItem key={r.id} r={r} />)}</ul>}
    </div>
  );
}

function ReviewItem({ r }: { r: any }) {
  const { token, partnerId } = useStudio();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.reply ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await replyReviewFn({ data: { token, partnerId, id: r.id, reply: text } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Reply posted"); setEditing(false); qc.invalidateQueries({ queryKey: ["studio-reviews"] });
  };
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{r.customer_name ?? "Customer"} <span className="ml-1 inline-flex items-center gap-0.5 text-sm text-saffron">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(r.rating) ? "fill-current" : "opacity-30"}`} />)}</span></div>
        <div className="text-xs text-muted-foreground">{r.listing?.name ?? "Your business"} · {fmtWhen(r.created_at)}</div>
      </div>
      {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
      {r.reply && !editing && <div className="mt-2 rounded-lg bg-secondary/60 p-2 text-sm"><b>Your reply:</b> {r.reply}</div>}
      {editing ? (
        <div className="mt-2 flex gap-2"><textarea rows={2} value={text} onChange={e => setText(e.target.value)} className={inputCls} /><div className="flex flex-col gap-1"><button disabled={busy || text.trim().length < 2} onClick={save} className={btnPrimary}>{busy && <Spinner />}Post</button><button onClick={() => setEditing(false)} className={btnOutline}>Cancel</button></div></div>
      ) : <button onClick={() => setEditing(true)} className={`${btnOutline} mt-2`}>{r.reply ? "Edit reply" : "Reply"}</button>}
    </li>
  );
}
