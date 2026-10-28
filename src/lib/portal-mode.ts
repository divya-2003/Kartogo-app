// Decides whether a device with a saved partner/admin session should open its
// portal or the customer pages. "Shopping as a customer" is remembered only in
// memory for the current app run, so reopening or reloading the app always
// lands partners back on their own portal.

export type PortalHome = "/delivery" | "/admin" | "/supplier/sales" | "/printer" | "/delivery-request";

export const PORTAL_PREFIXES = ["/admin", "/supplier", "/delivery", "/printer"] as const;

let customerMode = false;

/** Reads a stored token that may be saved raw or JSON-encoded. */
function readToken(key: string): string | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return null; }
  if (!raw || raw === "null" || raw === "undefined" || raw === '""') return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" && parsed ? parsed : null;
  } catch { return raw; }
}

/** The portal this device's saved session belongs to, if any. */
export function portalHomeTarget(): PortalHome | null {
  if (typeof window === "undefined") return null;
  if (readToken("qk_delivery_token")) return "/delivery";
  if (readToken("qk_delivery_pending_token")) return "/delivery-request";
  if (readToken("qk_admin_token")) return "/admin";
  if (readToken("qk_supplier_token")) return "/supplier/sales";
  if (readToken("qk_printer_token")) return "/printer";
  return null;
}

export function isPortalPath(path: string): boolean {
  return PORTAL_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}-`));
}

/** The customer explicitly chose a customer page (bottom nav, Back to Home, partner "Shop as a customer"). */
export function enterCustomerMode() {
  customerMode = true;
  try { sessionStorage.setItem("qk_customer_home", "1"); } catch { /* unavailable */ }
}

export function leaveCustomerMode() {
  customerMode = false;
  try { sessionStorage.removeItem("qk_customer_home"); } catch { /* unavailable */ }
}

/** True only while the current app run explicitly chose the customer pages. */
export function inCustomerMode() {
  return customerMode;
}

/** Where Home should send this device right now (null = show the customer home). */
export function homeRedirectTarget(): PortalHome | null {
  if (customerMode) return null;
  return portalHomeTarget();
}
