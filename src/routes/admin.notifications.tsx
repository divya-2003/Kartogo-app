import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, RefreshCw, RotateCw, Send, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/store";
import { adminTestPushFn, notificationOverviewFn, retryNotificationFn } from "@/lib/push.functions";

export const Route = createFileRoute("/admin/notifications")({
  component: PushMonitorPage,
  head: () => ({
    meta: [
      { title: "Push notifications — Kartogo admin" },
      { name: "description", content: "Monitor Kartogo push notification delivery, inspect failures and resend transactional alerts." },
      { property: "og:title", content: "Push notifications — Kartogo admin" },
      { property: "og:description", content: "Delivery monitoring for Kartogo Firebase Cloud Messaging pushes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Data = Awaited<ReturnType<typeof notificationOverviewFn>>;

function PushMonitorPage() {
  const { adminToken } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState("");

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      setData(await notificationOverviewFn({ data: { adminToken } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load notifications");
    }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const sendTest = async () => {
    if (!adminToken) return;
    setBusy(true);
    try {
      await adminTestPushFn({ data: { adminToken, phone: testPhone.trim() } });
      toast.success("Test push sent");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test push failed");
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    if (!adminToken) return;
    setRetrying(id);
    try {
      await retryNotificationFn({ data: { adminToken, id } });
      toast.success("Notification re-sent");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying("");
    }
  };

  const failures = (data?.recent ?? []).filter((r) => r.status === "failed");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Push notifications</h1>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-input px-3 py-2 text-sm font-semibold">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={data?.total ?? 0} />
        <Stat label="Sent" value={data?.sent ?? 0} />
        <Stat label="Delivered" value={data?.delivered ?? 0} />
        <Stat label="Failed" value={data?.failed ?? 0} tone="danger" />
        <Stat label="Devices" value={data?.devices ?? 0} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4 text-primary" /> Send a test push
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Customer mobile number (e.g. 9110310034)"
            className="min-w-[240px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => void sendTest()}
            disabled={busy || !testPhone.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send test
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The number must have push turned on at least once from their Kartogo app (Profile &rarr; Notifications).
        </p>
      </div>

      {failures.length > 0 && (
        <Section title={`Recent failures (${failures.length})`}>
          {failures.slice(0, 20).map((r) => (
            <Row key={r.id} row={r} onRetry={() => void retry(r.id as string)} retrying={retrying === r.id} />
          ))}
        </Section>
      )}

      <Section title="Recent notifications">
        {(data?.recent ?? []).slice(0, 60).map((r) => (
          <Row key={r.id} row={r} onRetry={() => void retry(r.id as string)} retrying={retrying === r.id} />
        ))}
        {(data?.recent ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</p>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 font-semibold">{title}</div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

type RowData = Data["recent"][number];

function Row({ row, onRetry, retrying }: { row: RowData; onRetry: () => void; retrying: boolean }) {
  const failed = row.status === "failed";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">{String(row.notification_type)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${failed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {String(row.status)}
          </span>
          {row.order_id && <span className="text-xs text-muted-foreground">Order {String(row.order_id)}</span>}
        </div>
        <div className="mt-1 truncate text-sm font-semibold">{String(row.title)}</div>
        <div className="truncate text-xs text-muted-foreground">{String(row.body ?? "")}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {String(row.user_phone)} · {new Date(String(row.created_at)).toLocaleString("en-IN")}
          {row.error_message ? ` · ${String(row.error_message).slice(0, 120)}` : ""}
        </div>
      </div>
      {failed && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 rounded-xl border border-input px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} /> Retry
        </button>
      )}
    </div>
  );
}
