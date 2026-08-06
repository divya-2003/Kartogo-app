import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { recentAlertNotificationsFn } from "@/lib/notifications.functions";

/**
 * Browser push notifications for inventory alerts.
 *
 * Polls the admin-authenticated alert feed (notifications stay server-side —
 * they are never exposed to anonymous clients) and raises an OS notification
 * plus an in-app toast for anything new since the page loaded.
 */
export function usePushNotifications(adminToken: string | null, intervalMs = 30_000) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) setPermission("unsupported");
    else setPermission(Notification.permission);
  }, []);

  const poll = useCallback(async () => {
    if (!adminToken) return;
    try {
      const { notifications } = await recentAlertNotificationsFn({ data: { adminToken } });
      for (const n of notifications) {
        if (seen.current.has(n.id)) continue;
        seen.current.add(n.id);
        if (!primed.current) continue; // don't replay history on first load
        toast.warning(n.title, { description: n.body });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { new Notification(n.title, { body: n.body, tag: n.id }); } catch { /* toast still shows */ }
        }
      }
      primed.current = true;
    } catch { /* alerts are best-effort */ }
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) return;
    void poll();
    const t = setInterval(() => void poll(), intervalMs);
    return () => clearInterval(t);
  }, [adminToken, intervalMs, poll]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Push alerts enabled on this device");
  };

  return { permission, requestPermission };
}
