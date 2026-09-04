// Browser-side Firebase Cloud Messaging setup for Kartogo.
// Only public web-push config lives here — the service account stays server-side.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

function configured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && appId && vapidKey && firebaseConfig.messagingSenderId);
}

let messagingRef: Messaging | null = null;

function app(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>);
}

/** Human-readable device label, used to tell a customer's phones apart. */
export function deviceName(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android phone";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone / iPad";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "Browser";
}

export function platform(): "android" | "ios" | "web" {
  if (typeof navigator === "undefined") return "web";
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "ios";
  return "web";
}

/**
 * Asks for notification permission (Android 13+ POST_NOTIFICATIONS is surfaced
 * by the browser/WebView as this same prompt) and returns the FCM token.
 * Must be called from a user gesture.
 */
export async function enablePush(): Promise<PushResult> {
  if (!configured()) return { status: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window)) return { status: "unsupported" };
  if (!(await isSupported().catch(() => false))) return { status: "unsupported" };
  // Cross-origin iframes (the Lovable preview) silently reject the prompt.
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  messagingRef = getMessaging(app());
  const token = await getToken(messagingRef, { vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

/** Silently returns the current token when permission was already granted. */
export async function currentToken(): Promise<string | null> {
  if (!configured()) return null;
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  if (!(await isSupported().catch(() => false))) return null;
  try {
    const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
    const serviceWorkerRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
    messagingRef = getMessaging(app());
    return await getToken(messagingRef, { vapidKey, serviceWorkerRegistration });
  } catch {
    return null;
  }
}

/**
 * Foreground message listener. Initialises Messaging on demand (the bridge can
 * mount before the customer has enabled push). Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  handler: (msg: { title: string; body: string; path: string; id: string }) => void,
): Promise<() => void> {
  if (!configured()) return () => {};
  if (typeof window === "undefined" || !("Notification" in window)) return () => {};
  if (Notification.permission !== "granted") return () => {};
  if (!(await isSupported().catch(() => false))) return () => {};
  if (!messagingRef) {
    try { messagingRef = getMessaging(app()); } catch { return () => {}; }
  }
  return onMessage(messagingRef, (payload) => {
    handler({
      title: payload.notification?.title ?? "Kartogo",
      body: payload.notification?.body ?? "",
      path: (payload.data?.path as string) ?? "/orders",
      id: (payload.data?.notificationId as string) ?? "",
    });
  });
}

export const pushConfigured = configured;
