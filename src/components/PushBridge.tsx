import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { currentToken, deviceName, onForegroundMessage, platform } from "@/lib/firebase-push";
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

  return null;
}
