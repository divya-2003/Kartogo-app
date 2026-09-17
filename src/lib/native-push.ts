// Native (Android) push support for the Capacitor shell.
//
// On a phone the web push path does not apply: Android asks for the
// POST_NOTIFICATIONS permission and Firebase hands us a native FCM
// registration token. That token is stored exactly like a web one, so the
// existing server sender (ORDER_CONFIRMED, DRIVER_NEARBY, …) reaches the phone
// with no server changes.
//
// Every import is dynamic so the browser build never loads native plugins.

export type NativePushHandlers = {
  /** Called with the FCM registration token for this phone. */
  onToken: (token: string) => void;
  /** Push received while the app is open. */
  onForeground: (msg: { title: string; body: string; path: string }) => void;
  /** User tapped a notification. */
  onTap: (path: string) => void;
};

export async function isNativeApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const pathOf = (data: unknown): string => {
  const p = (data as { path?: string } | undefined)?.path;
  return typeof p === "string" && p.startsWith("/") ? p : "/orders";
};

/**
 * Asks for the Android notification permission, registers with FCM and wires
 * the delivery callbacks. Returns a cleanup function.
 */
export async function startNativePush(handlers: NativePushHandlers): Promise<() => void> {
  if (!(await isNativeApp())) return () => {};
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") return () => {};

  const listeners = await Promise.all([
    PushNotifications.addListener("registration", (t) => handlers.onToken(t.value)),
    PushNotifications.addListener("pushNotificationReceived", (n) =>
      handlers.onForeground({
        title: n.title ?? "Kartogo",
        body: n.body ?? "",
        path: pathOf(n.data),
      }),
    ),
    PushNotifications.addListener("pushNotificationActionPerformed", (a) =>
      handlers.onTap(pathOf(a.notification.data)),
    ),
  ]);

  await PushNotifications.register();

  return () => { for (const l of listeners) void l.remove(); };
}
