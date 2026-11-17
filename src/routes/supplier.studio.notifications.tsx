import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock } from "lucide-react";
import { studioNotificationsFn } from "@/lib/studio.functions";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { Card, Empty, ErrorBox, Loading, PageHeader, fmtDate, fmtTime, fmtWhen } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/notifications")({
  component: Notifications,
  head: () => ({ meta: [{ title: "Notifications — Partner Studio" }, { name: "description", content: "New requests, cancellations, enquiries, stock alerts and upcoming appointments." }] }),
});

const LINK: Record<string, string> = {
  PARTNER_NEW_BOOKING: "/supplier/studio/appointments", PARTNER_BOOKING_CANCELLED: "/supplier/studio/appointments", PARTNER_UPCOMING_APPOINTMENT: "/supplier/studio/appointments",
  PARTNER_NEW_ENQUIRY: "/supplier/studio/enquiries", PARTNER_LOW_STOCK: "/supplier/studio/inventory",
};

function Notifications() {
  const { refresh, me } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("notifications", (a) => studioNotificationsFn({ data: { ...a, markRead: true } }), [], { refetchInterval: 30_000 });
  useEffect(() => { if (q.data && me?.unread) { refresh(); qc.invalidateQueries({ queryKey: ["studio-me"] }); } }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const { notifications, upcoming } = q.data!;
  const visible = notifications.filter((n: any) => n.notification_type.startsWith("PARTNER_") || n.notification_type === "TEST");
  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" crumb="Notifications" sub="Also sent to your phone when notifications are allowed." />
      <Card title="Upcoming appointments (today & tomorrow)">
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing coming up.</p> : <ul className="divide-y divide-border">{upcoming.map((b: any) => (
          <li key={b.id} className="flex items-center gap-2 py-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" /><span className="flex-1">{fmtDate(b.booking_date)} {fmtTime(b.start_time)} · {b.customer_name ?? "Customer"} · {b.appointment_type ?? b.listing?.name ?? "Booking"}</span><Link to="/supplier/studio/appointments" className="text-xs font-semibold text-primary">Open</Link></li>
        ))}</ul>}
      </Card>
      {visible.length === 0 ? <Empty title="No notifications yet" body="New appointment requests, cancellations, enquiries and low-stock alerts appear here." /> : (
        <ul className="space-y-2">{visible.map((n: any) => (
          <li key={n.id} className={`flex gap-3 rounded-xl border bg-card p-3 ${n.read_at ? "border-border" : "border-brand-navy/40"}`}>
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{n.title}</div><div className="text-sm text-muted-foreground">{n.body}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{fmtWhen(n.created_at)}</div></div>
            {LINK[n.notification_type] && <Link to={LINK[n.notification_type]} className="self-center text-xs font-semibold text-primary">View</Link>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}
