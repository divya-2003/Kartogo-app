import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { enablePush, currentToken, deviceName, onForegroundMessage, platform } from "@/lib/firebase-push";
import { registerPushTokenFn } from "@/lib/push.functions";
import { isNativeApp, startNativePush } from "@/lib/native-push";

/**
 * Keeps the customer's FCM registration token in sync with Supabase, shows
 * foreground pushes as in-app toasts and deep-links notification taps.
 * Renders nothing.
 */
export function PushBridge() {
  const { customerToken } = useAuth();
  const router = useRouter();
  const lastShown = useRef<string>("");
  const [ask, setAsk] = useState(false);

  // Ask for notification access right after login, the same way we ask for
  // location: a clear card whose button triggers the browser's own prompt
  // (browsers block the prompt unless it comes from a tap).
  useEffect(() => {
    if (!customerToken) { setAsk(false); return; }
    void (async () => {
      if (await isNativeApp()) return;
      if (typeof Notification === "undefined" || Notification.permission !== "default") return;
      if (window.top !== window.self) return; // preview frame can't show the prompt
      const later = Number(localStorage.getItem("qk_push_later") || 0);
      if (Date.now() - later < 3 * 864e5) return;
      setAsk(true);
    })();
  }, [customerToken]);

  const allow = async () => {
    setAsk(false);
    const r = await enablePush().catch(() => ({ status: "unsupported" as const }));
    if (r.status === "registered" && customerToken) {
      await registerPushTokenFn({ data: { token: customerToken, fcmToken: r.token, platform: platform(), deviceName: deviceName() } }).catch(() => {});
      toast.success("Notifications turned on");
    } else if (r.status === "not-configured") {
      toast.error("Notifications aren't set up for the website yet.");
    } else if (r.status === "denied") {
      localStorage.setItem("qk_push_later", String(Date.now()));
    }
  };

  // 0) Android app: ask for the notification permission, register the phone's
  // FCM token and handle taps natively. No-ops in a normal browser.
  useEffect(() => {
    if (!customerToken) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void startNativePush({
      onToken: (fcmToken) => {
        void registerPushTokenFn({
          data: { token: customerToken, fcmToken, platform: "android", deviceName: "Android app" },
        }).catch(() => { /* best-effort */ });
      },
      onForeground: (msg) => {
        toast(msg.title, {
          description: msg.body,
          action: { label: "View", onClick: () => router.navigate({ to: msg.path }) },
        });
      },
      onTap: (path) => router.navigate({ to: path }),
    }).then((fn) => { if (cancelled) fn(); else stop = fn; });
    return () => { cancelled = true; stop?.(); };
  }, [customerToken, router]);

  // 1) Register / refresh the device token whenever the customer is logged in.
  useEffect(() => {
    if (!customerToken) return;
    let cancelled = false;
    (async () => {
      if (await isNativeApp()) return; // native path above owns the token
      const token = await currentToken();
      if (!token || cancelled) return;
      try {
        await registerPushTokenFn({
          data: { token: customerToken, fcmToken: token, platform: platform(), deviceName: deviceName() },
        });
      } catch {
        /* push registration is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [customerToken]);

  // 2) Foreground messages -> in-app toast (the SW handles background/closed).
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    void onForegroundMessage((msg) => {
      if (msg.id && lastShown.current === msg.id) return; // no duplicates
      lastShown.current = msg.id;
      toast(msg.title, {
        description: msg.body,
        action: { label: "View", onClick: () => router.navigate({ to: msg.path }) },
      });
    }).then((fn) => {
      if (cancelled) fn();
      else unsubscribe = fn;
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [router]);

  // 3) Notification taps coming back from the service worker.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessageEvent = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | undefined;
      if (data?.type === "KARTOGO_NOTIFICATION_CLICK" && data.path) {
        router.navigate({ to: data.path });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessageEvent);
    return () => navigator.serviceWorker.removeEventListener("message", onMessageEvent);
  }, [router]);

  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-foreground/40 p-4 sm:place-items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-pop">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BellRing className="h-7 w-7" /></div>
        <h2 className="mt-3 font-display text-xl font-extrabold">Turn on notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">Get live updates when your order is confirmed, your rider is nearby and it's delivered.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => { localStorage.setItem("qk_push_later", String(Date.now())); setAsk(false); }} className="h-11 flex-1 rounded-xl border border-border font-bold">Not now</button>
          <button onClick={() => void allow()} className="h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">Allow</button>
        </div>
      </div>
    </div>
  );
}
