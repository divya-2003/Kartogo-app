import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import { currentToken, deviceName, onForegroundMessage, platform } from "@/lib/firebase-push";
import { registerPushTokenFn } from "@/lib/push.functions";

/**
 * Keeps the customer's FCM registration token in sync with Supabase, shows
 * foreground pushes as in-app toasts and deep-links notification taps.
 * Renders nothing.
 */
export function PushBridge() {
  const { customerToken } = useAuth();
  const router = useRouter();
  const lastShown = useRef<string>("");

  // 1) Register / refresh the device token whenever the customer is logged in.
  useEffect(() => {
    if (!customerToken) return;
    let cancelled = false;
    (async () => {
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
    const unsubscribe = onForegroundMessage((msg) => {
      if (msg.id && lastShown.current === msg.id) return; // no duplicates
      lastShown.current = msg.id;
      toast(msg.title, {
        description: msg.body,
        action: { label: "View", onClick: () => router.navigate({ to: msg.path }) },
      });
    });
    return unsubscribe;
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
