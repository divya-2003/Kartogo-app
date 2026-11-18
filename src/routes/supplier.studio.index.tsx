import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, MessageSquare, Package } from "lucide-react";
import { studioOverviewFn } from "@/lib/studio.functions";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { Card, Empty, EnquiryBadge, ErrorBox, Kpi, Loading, PageHeader, StatusBadge, StockBadge, fmtDate, fmtTime, fmtWhen, inr } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/")({
  component: Overview,
  head: () => ({ meta: [{ title: "Overview — Partner Studio" }, { name: "description", content: "Your business at a glance: appointments, stock and enquiries." }] }),
});

function Overview() {
  const { me } = useStudio();
  const q = useStudioQuery("overview", ({ token, partnerId }) => studioOverviewFn({ data: { token, partnerId } }), [], { refetchInterval: 30_000 });
  if (q.isLoading) return <Loading rows={6} />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const k = o.kpis as unknown as Record<string, number>;
  const furniture = o.kind === "furniture";
  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${me?.partner.name}`} sub={furniture ? "Inventory, appointments and customer enquiries at a glance." : "Today's schedule, requests and earnings at a glance."} />
      {furniture ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Total products" value={k.totalProducts} />
          <Kpi label="Active products" value={k.activeProducts} tone="good" />
          <Kpi label="Out of stock" value={k.outOfStock} tone={k.outOfStock ? "bad" : "default"} />
          <Kpi label="Low stock" value={k.lowStock} tone={k.lowStock ? "warn" : "default"} />
          <Kpi label="Today's appointments" value={k.todaysAppointments} />
          <Kpi label="Pending appointments" value={k.pendingAppointments} tone={k.pendingAppointments ? "warn" : "default"} />
          <Kpi label="New enquiries" value={k.newEnquiries} tone={k.newEnquiries ? "warn" : "default"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Today's appointments" value={k.todaysAppointments} />
          <Kpi label="Upcoming" value={k.upcomingAppointments} />
          <Kpi label="Pending requests" value={k.pendingRequests} tone={k.pendingRequests ? "warn" : "default"} />
          <Kpi label="Completed" value={k.completedAppointments} tone="good" />
          <Kpi label="Cancelled" value={k.cancelledAppointments} tone={k.cancelledAppointments ? "bad" : "default"} />
          <Kpi label="Earnings this month" value={inr(k.monthlyEarnings)} tone="good" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={furniture ? "Recent appointments" : "Today's schedule"} className="lg:col-span-2" action={<Link to="/supplier/studio/appointments" className="text-xs font-semibold text-primary">View all</Link>}>
          {(furniture ? o.recentAppointments : o.todaysSchedule).length === 0 ? <Empty title={furniture ? "No appointments yet" : "Nothing scheduled today"} /> : (
            <ul className="divide-y divide-border">
              {(furniture ? o.recentAppointments : o.todaysSchedule).map((b: any) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{b.customer_name || "Customer"} · {b.appointment_type ?? b.listing?.name ?? "Booking"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(b.booking_date)} {fmtTime(b.start_time)}{b.staff?.name ? ` · ${b.staff.name}` : ""}</div>
                  </div>
                  <StatusBadge s={b.appointment_status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Business performance (30 days)">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Bookings</dt><dd className="text-lg font-bold">{o.performance.bookings30}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Completed</dt><dd className="text-lg font-bold text-leaf">{o.performance.completed30}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Cancelled</dt><dd className="text-lg font-bold">{o.performance.cancelled30}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Earnings</dt><dd className="text-lg font-bold">{inr(o.performance.revenue30)}</dd></div>
            {furniture && <div><dt className="text-xs text-muted-foreground">Enquiries</dt><dd className="text-lg font-bold">{o.performance.enquiries30}</dd></div>}
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {furniture ? (
          <>
            <Card title="Recent enquiries" action={<Link to="/supplier/studio/enquiries" className="text-xs font-semibold text-primary">View all</Link>}>
              {o.recentEnquiries.length === 0 ? <Empty title="No enquiries yet" /> : (
                <ul className="divide-y divide-border">{o.recentEnquiries.map((e: any) => (
                  <li key={e.id} className="flex items-start gap-2 py-2.5 text-sm"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{e.customer_name || "Customer"} · {e.listing?.name ?? "General"}</div><div className="line-clamp-1 text-xs text-muted-foreground">{e.message}</div></div>
                    <EnquiryBadge s={e.status} /></li>
                ))}</ul>
              )}
            </Card>
            <Card title="Inventory alerts" action={<Link to="/supplier/studio/inventory" className="text-xs font-semibold text-primary">Inventory</Link>}>
              {o.inventoryAlerts.length === 0 ? <Empty title="Stock looks healthy" /> : (
                <ul className="divide-y divide-border">{o.inventoryAlerts.map((l: any) => (
                  <li key={l.id} className="flex items-center gap-2 py-2.5 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-saffron" />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span><span className="tabular-nums text-xs">{l.stock_qty ?? 0} left</span><StockBadge s={l.state} /></li>
                ))}</ul>
              )}
            </Card>
          </>
        ) : (
          <Card title="Upcoming appointments" className="lg:col-span-2">
            {o.upcoming.length === 0 ? <Empty title="No upcoming appointments" /> : (
              <ul className="divide-y divide-border">{o.upcoming.map((b: any) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{b.listing?.name ?? b.appointment_type ?? "Booking"} · {b.customer_name || "Customer"}</div><div className="text-xs text-muted-foreground">{fmtDate(b.booking_date)} {fmtTime(b.start_time)}{b.staff?.name ? ` · ${b.staff.name}` : ""}</div></div>
                  <StatusBadge s={b.appointment_status} /></li>
              ))}</ul>
            )}
          </Card>
        )}
        <Card title="Recent activity">
          {o.activity.length === 0 ? <Empty title="No activity yet" /> : (
            <ul className="space-y-2.5">{o.activity.map((a: any, i: number) => (
              <li key={i} className="flex gap-2 text-sm"><Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><div className="line-clamp-2">{a.text}</div><div className="text-[11px] text-muted-foreground">{fmtWhen(a.at)}</div></div></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
