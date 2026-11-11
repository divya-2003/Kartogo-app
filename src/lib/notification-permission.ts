// Asks for notification access: straight after the location prompt on first
// open, and — on every page, including partner portals — on the person's next
// tap whenever the phone still hasn't answered. Mobile browsers ignore a
// permission request that isn't triggered by a tap, so the tap is what makes
// the system prompt actually appear. Once granted, PushBridge picks it up via
// PERMISSION_EVENT and registers the device for pushes.
import { isNativeApp } from "@/lib/native-push";

export const PERMISSION_EVENT = "kartogo:notifications-granted";
const ASKED_KEY = "qk_notif_asked";

function announce() {
  try { window.dispatchEvent(new Event(PERMISSION_EVENT)); } catch { /* ignore */ }
}

const webUndecided = () =>
  typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && window.top === window.self;

let armed = false;
/** Shows the system notification prompt on the next tap anywhere in the app. */
function armTapPrompt() {
  if (armed || !webUndecided()) return;
  armed = true;
  const onTap = () => {
    window.removeEventListener("click", onTap, true);
    window.removeEventListener("touchend", onTap, true);
    armed = false;
    if (!webUndecided()) return;
    void Notification.requestPermission()
      .then((r) => { if (r === "granted") announce(); else if (r === "default") armTapPrompt(); })
      .catch(() => {});
  };
  // click / touchend carry the "user tapped" signal mobile browsers require.
  window.addEventListener("click", onTap, true);
  window.addEventListener("touchend", onTap, true);
}

async function askNative(): Promise<boolean> {
  if (!(await isNativeApp())) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const p = await PushNotifications.checkPermissions();
    if (p.receive === "prompt" || p.receive === "prompt-with-rationale") {
      const r = await PushNotifications.requestPermissions();
      if (r.receive === "granted") announce();
    } else if (p.receive === "granted") announce();
  } catch { /* plugin unavailable */ }
  return true;
}

/** Called once per app open from the root, on every page. */
export async function ensureNotificationPrompt(): Promise<void> {
  if (typeof window === "undefined") return;
  if (await askNative()) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") { announce(); return; }
  armTapPrompt();
}

/** Straight after the first-open location prompt. */
export async function askNotificationPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  try { if (sessionStorage.getItem(ASKED_KEY)) return; sessionStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }
  if (await askNative()) return;
  if (!webUndecided()) return;
  let result: NotificationPermission = "default";
  try { result = await Notification.requestPermission(); } catch { /* needs a tap */ }
  if (result === "granted") { announce(); return; }
  if (result === "default") armTapPrompt();
}
