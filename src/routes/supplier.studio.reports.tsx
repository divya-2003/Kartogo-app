import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { studioReportsFn } from "@/lib/studio.functions";
import { STATUS_LABEL, ENQUIRY_LABEL, type AppointmentStatus, type EnquiryStatus } from "@/lib/studio";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { useStudioQuery } from "@/components/studio/StudioContext";
import { Card, ErrorBox, Kpi, Loading, PageHeader, StockBadge, addDays, btnOutline, fmtWhen, inputCls, inr, isoToday } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: "Reports — Partner Studio" }, { name: "description", content: "Performance, appointments, stock and earnings reports with export." }] }),
});

function Bars({ data, label }: { data: Record<string, number>; label: (k: string) => string }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  if (!entries.length) return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  return <ul className="space-y-1.5">{entries.map(([k, v]) => (
    <li key={k} className="flex items-center gap-2 text-sm"><span className="w-36 shrink-0 truncate">{label(k)}</span><span className="h-2.5 rounded-full bg-brand-navy" style={{ width: `${(v / max) * 100}%`, minWidth: 6 }} /><span className="tabular-nums text-xs">{v}</span></li>
  ))}</ul>;
}

function Reports() {
  const [from, setFrom] = useState(addDays(isoToday(), -29));
  const [to, setTo] = useState(isoToday());
  const q = useStudioQuery("reports", (a) => studioReportsFn({ data: { ...a, from, to } }), [from, to]);
  const preset = (days: number) => { setFrom(addDays(isoToday(), -(days - 1))); setTo(isoToday()); };
  const r = q.data;
  const furniture = r?.kind === "furniture";
  const exp = (name: string, rows: any[], headers: { key: string; label: string; get: (x: any) => unknown }[]) => downloadCsv(`${name}-${from}-to-${to}.csv`, buildCsv(rows, headers));
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" crumb="Reports">
        <input aria-label="From" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={`${inputCls} w-40`} />
        <input aria-label="To" type="date" value={to} min={from} max={isoToday()} onChange={e => setTo(e.target.value)} className={`${inputCls} w-40`} />
        {[7, 30, 90].map(d => <button key={d} className={btnOutline} onClick={() => preset(d)}>{d} days</button>)}
      </PageHeader>
      {q.isLoading || !r ? (q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : <Loading />) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Appointments" value={r.summary.appointments} />
            <Kpi label="Completed" value={r.summary.completed} tone="good" />
            <Kpi label="Cancellation rate" value={`${r.summary.cancelRate}%`} tone={r.summary.cancelRate > 20 ? "bad" : "default"} />
            <Kpi label="Earnings" value={inr(r.summary.earnings)} tone="good" />
            {furniture && <Kpi label="Enquiries" value={r.summary.enquiries} />}
            {furniture && <Kpi label="Converted" value={r.summary.converted} />}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Appointment statistics" action={<button className={btnOutline} onClick={() => exp("appointment-statistics", Object.entries(r.byStatus), [{ key: "s", label: "Status", get: (x) => STATUS_LABEL[x[0] as AppointmentStatus] }, { key: "n", label: "Appointments", get: (x) => x[1] }])}><Download className="h-4 w-4" />CSV</button>}>
              <Bars data={r.byStatus} label={k => STATUS_LABEL[k as AppointmentStatus] ?? k} />
              <div className="mt-4 text-xs font-semibold text-muted-foreground">By appointment type</div>
              <div className="mt-1"><Bars data={r.byType} label={k => k} /></div>
            </Card>
            {furniture ? (
              <Card title="Customer enquiries"><Bars data={r.enquiryStatus} label={k => ENQUIRY_LABEL[k as EnquiryStatus] ?? k} /></Card>
            ) : (
              <Card title="Professional performance" action={<button className={btnOutline} onClick={() => exp("professional-performance", r.professionals, [{ key: "n", label: "Professional", get: x => x.name }, { key: "a", label: "Appointments", get: x => x.appointments }, { key: "c", label: "Completed", get: x => x.completed }, { key: "ns", label: "No-shows", get: x => x.noShows }, { key: "e", label: "Earnings", get: x => x.earnings }])}><Download className="h-4 w-4" />CSV</button>}>
                {r.professionals.length === 0 ? <p className="text-sm text-muted-foreground">No professionals added.</p> : (
                  <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Name</th><th>Appts</th><th>Done</th><th>No-show</th><th className="text-right">Earnings</th></tr></thead>
                    <tbody>{r.professionals.map((p: any) => <tr key={p.name} className="border-t border-border"><td className="py-1.5">{p.name}</td><td>{p.appointments}</td><td>{p.completed}</td><td>{p.noShows}</td><td className="text-right">{inr(p.earnings)}</td></tr>)}</tbody></table>
                )}
              </Card>
            )}
          </div>
          <Card title={furniture ? "Product performance" : "Service performance"} action={<button className={btnOutline} onClick={() => exp(furniture ? "product-performance" : "service-performance", r.products, furniture
            ? [{ key: "n", label: "Product", get: x => x.name }, { key: "s", label: "SKU", get: x => x.sku }, { key: "u", label: "Units sold", get: x => x.unitsSold }, { key: "r", label: "Revenue", get: x => x.revenue }, { key: "a", label: "Appointments", get: x => x.appointments }, { key: "e", label: "Enquiries", get: x => x.enquiries }, { key: "st", label: "Stock", get: x => x.stock ?? "" }]
            : [{ key: "n", label: "Service", get: x => x.name }, { key: "a", label: "Appointments", get: x => x.appointments }, { key: "c", label: "Completed", get: x => x.completed }, { key: "e", label: "Earnings", get: x => x.earnings }])}><Download className="h-4 w-4" />CSV</button>}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">{furniture ? "Product" : "Service"}</th>{furniture ? <><th>Units sold</th><th>Revenue</th><th>Appointments</th><th>Enquiries</th><th>Stock</th></> : <><th>Appointments</th><th>Completed</th><th className="text-right">Earnings</th></>}</tr></thead>
              <tbody>{r.products.map((p: any) => (
                <tr key={p.name + p.sku} className="border-t border-border"><td className="py-1.5">{p.name}</td>{furniture ? <><td>{p.unitsSold}</td><td>{inr(p.revenue)}</td><td>{p.appointments}</td><td>{p.enquiries}</td><td><StockBadge s={p.state} /></td></> : <><td>{p.appointments}</td><td>{p.completed}</td><td className="text-right">{inr(p.earnings)}</td></>}</tr>
              ))}</tbody>
            </table></div>
          </Card>
          {furniture && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Low-stock report" action={<button className={btnOutline} onClick={() => exp("low-stock", r.lowStock, [{ key: "n", label: "Product", get: x => x.name }, { key: "s", label: "SKU", get: x => x.sku }, { key: "q", label: "Stock", get: x => x.stock ?? 0 }])}><Download className="h-4 w-4" />CSV</button>}>
                {r.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">No low-stock products.</p> : <ul className="divide-y divide-border text-sm">{r.lowStock.map((p: any) => <li key={p.name} className="flex items-center justify-between py-1.5"><span>{p.name}</span><span className="flex items-center gap-2"><span className="tabular-nums">{p.stock ?? 0}</span><StockBadge s={p.state} /></span></li>)}</ul>}
              </Card>
              <Card title="Inventory movement" action={<button className={btnOutline} onClick={() => exp("inventory-movement", r.movements, [{ key: "t", label: "When", get: x => x.created_at }, { key: "n", label: "Product", get: x => x.name }, { key: "c", label: "Change", get: x => x.change }, { key: "a", label: "Stock after", get: x => x.qty_after }, { key: "r", label: "Reason", get: x => x.reason }])}><Download className="h-4 w-4" />CSV</button>}>
                {r.movements.length === 0 ? <p className="text-sm text-muted-foreground">No stock changes in this period.</p> : <ul className="max-h-72 divide-y divide-border overflow-y-auto text-sm">{r.movements.map((m: any, i: number) => <li key={i} className="flex justify-between gap-2 py-1.5"><span className="truncate">{m.name} · {String(m.reason).toLowerCase().replace("_", " ")}</span><span className="shrink-0 tabular-nums">{m.change > 0 ? "+" : ""}{m.change} → {m.qty_after} · {fmtWhen(m.created_at)}</span></li>)}</ul>}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
