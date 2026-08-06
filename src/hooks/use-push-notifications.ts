import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Audience = "admin" | "supplier";

/**
 * Browser push notifications for inventory alerts.
 * Subscribes to new `inventory_notifications` rows in realtime and raises an OS
 * notification (when the user granted permission) plus an in-app toast.
 */
export function usePushNotifications(audience: Audience, enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`inv-notify-${audience}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_notifications", filter: `audience=eq.${audience}` },
        (payload) => {
          const row = payload.new as { id: string; title: string; body: string };
          if (!row?.id || seen.current.has(row.id)) return;
          seen.current.add(row.id);
          toast.warning(row.title, { description: row.body });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(row.title, { body: row.body, tag: row.id });
            } catch { /* some browsers require a service worker; the toast still shows */ }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [audience, enabled]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Push alerts enabled on this device");
  };

  return { permission, requestPermission };
}
