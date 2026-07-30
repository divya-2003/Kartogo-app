import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getDriverStatusFn, requestDriverAccessFn, activateDriverSessionFn } from "@/lib/drivers.functions";

export const Route = createFileRoute("/delivery-request")({
  validateSearch: (search: Record<string, unknown>): { phone?: string } => ({
    phone: typeof search.phone === "string" ? search.phone : undefined,
  }),
  component: DeliveryRequestPage,
  head: () => ({
    meta: [
      { title: "Delivery access request — Kartogo" },
      { name: "description", content: "Request access to the Kartogo delivery partner portal when your account is paused by the store admin." },
    ],
  }),
});

type Status = Awaited<ReturnType<typeof getDriverStatusFn>>;

function DeliveryRequestPage() {
  const { phone } = Route.useSearch();
  const [status, setStatus] = useState<Status | null>(null);
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState(false);
  const nav = useNavigate();

  // Live approval watch: the paused rider holds a signed pending token. Every
  // 3s we ask the server to upgrade it — the instant the admin marks them
  // available we drop a real delivery session in and land on the portal, with
  // no logout / re-login and no accidental bounce to the customer home page.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      let pending: string | null = null;
      try { pending = JSON.parse(localStorage.getItem("qk_delivery_pending_token") || "null"); } catch { pending = null; }
      if (!pending) return;
      try {
        const res = await activateDriverSessionFn({ data: { pendingToken: pending } });
        if (!alive || !res.active) return;
        localStorage.setItem("qk_delivery_token", JSON.stringify(res.token));
        localStorage.setItem("qk_delivery_driver", JSON.stringify(res.driver));
        localStorage.removeItem("qk_delivery_pending_token");
        toast.success("Access approved — opening your delivery page");
        void nav({ to: "/delivery" });
      } catch { /* keep waiting */ }
    };
    void tick();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void tick(); }, 3000);
    return () => { alive = false; window.clearInterval(id); };
  }, [nav]);

  useEffect(() => {
    if (!phone) return;
    let alive = true;
    void (async () => {
      try {
        const s = await getDriverStatusFn({ data: { phone } });
        if (!alive) return;
        setStatus(s);
        if (s.found && s.requested) setRequested(true);
      } catch { /* keep the default screen */ }
    })();
    return () => { alive = false; };
  }, [phone]);

  const send = async () => {
    if (!phone) return;
    setSending(true);
    try {
      const res = await requestDriverAccessFn({ data: { phone } });
      if (res.alreadyActive) {
        toast.success("Your access is already active — please log in again.");
      } else {
        setRequested(true);
        toast.success("Request sent to the store admin");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send your request");
    } finally { setSending(false); }
  };

  const shift = status?.found
    ? status.shiftType === "part_time"
      ? `Part time${status.shiftStart && status.shiftEnd ? ` · ${status.shiftStart} – ${status.shiftEnd}` : ""}`
      : "Full time"
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-pop">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Bike className="h-7 w-7" />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold">
          {status?.found ? `Hi ${status.name}` : "Delivery partner"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your delivery page is ready, but access is currently paused by the store admin.
        </p>

        {shift && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" /> {shift}
          </div>
        )}

        {requested ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-leaf/10 px-4 py-3 text-sm font-semibold text-leaf">
            <CheckCircle2 className="h-5 w-5" /> Request sent — waiting for admin approval. This page opens automatically once approved.
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !phone}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-pop hover:bg-primary/90 disabled:opacity-60"
            >
              {sending ? "Sending..." : "Request delivery page access"}
            </button>
            <Link to="/login" className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary">
              Back to login
            </Link>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> Your past orders and earnings are safe.
        </p>
      </div>
    </div>
  );
}
