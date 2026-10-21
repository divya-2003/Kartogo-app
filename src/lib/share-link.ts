// Builds public share links for products. Preview/editor hosts require a
// Lovable login, so links generated there point at the public app instead —
// whoever receives the link can open it without an account.
export const PUBLIC_APP_ORIGIN = "https://kartogoapp.lovable.app";

export function publicOrigin(currentOrigin?: string): string {
  const origin = currentOrigin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return PUBLIC_APP_ORIGIN;
  let host = "";
  try { host = new URL(origin).hostname; } catch { return PUBLIC_APP_ORIGIN; }
  const isPrivate =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com");
  return isPrivate ? PUBLIC_APP_ORIGIN : origin;
}

export function productShareUrl(productId: string, currentOrigin?: string): string {
  return `${publicOrigin(currentOrigin)}/product/${encodeURIComponent(productId)}`;
}

export type ShareTarget = "whatsapp" | "telegram" | "sms" | "facebook" | "x";

export function shareTargetUrl(target: ShareTarget, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const both = encodeURIComponent(`${text} ${url}`);
  switch (target) {
    case "whatsapp": return `https://wa.me/?text=${both}`;
    case "telegram": return `https://t.me/share/url?url=${u}&text=${t}`;
    case "sms": return `sms:?&body=${both}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x": return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
  }
}
