// Asks for notification access straight after the location prompt on first
// open — no in-app card in between. Once granted, PushBridge picks it up via
// the PERMISSION_EVENT and registers the device for pushes.
import { isNativeApp } from "@/lib/native-push";

export const PERMISSION_EVENT = "kartogo:notifications-granted";
const ASKED_KEY = "qk_notif_asked";

function announce() {
  try { window.dispatchEvent(new Event(PERMISSION_EVENT)); } catch { /* ignore */ }
}

export async function askNotificationPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  try { if (sessionStorage.getItem(ASKED_KEY)) return; sessionStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }

  if (await isNativeApp()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const p = await PushNotifications.checkPermissions();
      if (p.receive === "prompt" || p.receive === "prompt-with-rationale") {
        const r = await PushNotifications.requestPermissions();
        if (r.receive === "granted") announce();
      }
    } catch { /* plugin unavailable */ }
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "default") return;
  if (window.top !== window.self) return; // embedded preview frames can't show the prompt

  let result: NotificationPermission = "default";
  try { result = await Notification.requestPermission(); } catch { /* needs a tap */ }
  if (result === "granted") { announce(); return; }
  if (result === "denied") return;

  // Some browsers (e.g. Safari) only show the prompt from a tap: ask on the
  // customer's very next tap anywhere in the app.
  const onTap = () => {
    if (Notification.permission !== "default") return;
    void Notification.requestPermission().then((r) => { if (r === "granted") announce(); }).catch(() => {});
  };
  window.addEventListener("pointerdown", onTap, { once: true, capture: true });
}
