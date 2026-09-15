import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bell, BellRing, Send } from "lucide-react";
import { useAuth } from "@/lib/store";
import { deviceName, enablePush, platform, pushConfigured } from "@/lib/firebase-push";
import {
  getNotificationPrefsFn,
  registerPushTokenFn,
  saveNotificationPrefsFn,
  sendMyTestPushFn,
  type NotificationPrefs,
} from "@/lib/push.functions";

export const Route = createFileRoute("/notifications")({
  component: NotificationSettingsPage,
  head: () => ({
    meta: [
      { title: "Notification settings — Kartogo" },
      { name: "description", content: "Choose which Kartogo order, delivery and offer notifications you receive on this device." },
      { property: "og:title", content: "Notification settings — Kartogo" },
      { property: "og:description", content: "Manage push notifications for your Kartogo orders and deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROWS: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
  { key: "order_updates", label: "Order Updates", sub: "Confirmation, preparation and cancellation" },
  { key: "delivery_updates", label: "Delivery Updates", sub: "Partner assigned, picked up, nearby, delivered" },
  { key: "important_updates", label: "Important Updates", sub: "Account, refunds and service alerts" },
  { key: "promotional_offers", label: "Promotional Offers", sub: "Coupons and seasonal deals" },
];

function NotificationSettingsPage() {
  const { customerToken } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    order_updates: true, delivery_updates: true, important_updates: true, promotional_offers: false,
  });
  const [devices, setDevices] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  const recheckPermission = () => {
    if (typeof window === "undefined" || !("Notification" in window)) setPermission("unsupported");
    else setPermission(Notification.permission);
  };

  useEffect(() => {
    recheckPermission();
    try {
      setInIframe(window.top !== window.self);
    } catch {
      setInIframe(true);
    }
  }, []);

  useEffect(() => {
    if (!customerToken) return;
    getNotificationPrefsFn({ data: { token: customerToken } })
      .then((r) => { setPrefs(r.prefs); setDevices(r.devices); })
      .catch(() => {});
  }, [customerToken]);

  if (!customerToken) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Please login</h1>
        <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
      </div>
    );
  }

  const save = async (next: NotificationPrefs) => {
    setPrefs(next);
    try {
      await saveNotificationPrefsFn({ data: { token: customerToken, prefs: next } });
    } catch {
      toast.error("Could not save your settings");
    }
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result.status === "registered") {
        await registerPushTokenFn({
          data: { token: customerToken, fcmToken: result.token, platform: platform(), deviceName: deviceName() },
        });
        setPermission("granted");
        setDevices((d) => d + 1);
        toast.success("Push notifications enabled on this device");
      } else if (result.status === "open-in-new-tab") {
        toast.info("Open Kartogo in its own tab or the installed app to allow notifications");
      } else if (result.status === "denied") {
        setPermission("denied");
        toast.error("Notifications are blocked — allow them in your browser or Android app settings");
      } else if (result.status === "unsupported") {
        toast.error("This device does not support push notifications");
      } else {
        toast.error("Push notifications are not configured yet");
      }
    } catch {
      toast.error("Could not enable notifications on this device");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await sendMyTestPushFn({ data: { token: customerToken } });
      if (r.sent > 0) toast.success("Test notification sent to your device(s)");
      else toast.error(r.skipped === "no device" ? "No device registered yet — turn notifications on first" : "Test push failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test push failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/menu" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-lg font-bold">Notifications</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-pop">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Push on this device</div>
                <p className="text-xs text-muted-foreground">
                  {permission === "granted"
                    ? `Enabled · ${devices} device${devices === 1 ? "" : "s"} registered`
                    : permission === "denied"
                      ? "Blocked in your device settings"
                      : permission === "unsupported"
                        ? "Not supported on this device"
                        : "Not enabled yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={turnOn}
                disabled={busy || permission === "unsupported" || !pushConfigured()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {permission === "granted" ? "Re-register" : "Turn on"}
              </button>
              <button
                onClick={test}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl border border-input px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Test
              </button>
            </div>
          </div>
          {permission === "denied" && (
            <p className="mt-3 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
              You previously denied notifications. Allow them again from your browser site settings (or Android app
              settings &rarr; Notifications), then tap Turn on.
            </p>
          )}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          {ROWS.map((r, i) => (
            <label
              key={r.key}
              className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-4 ${i < ROWS.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <span>
                  <span className="block font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.sub}</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs[r.key]}
                onChange={(e) => void save({ ...prefs, [r.key]: e.target.checked })}
                className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
