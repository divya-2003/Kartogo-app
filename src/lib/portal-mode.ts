// Decides whether a device with a saved partner/admin session should open its
// portal or the customer pages. "Shopping as a customer" is remembered only in
// memory for the current app run, so reopening or reloading the app always
// lands partners back on their own portal.

export type PortalHome = "/delivery" | "/admin" | "/supplier/sales" | "/printer" | "/delivery-request" | "/kitchen";

export const PORTAL_PREFIXES = ["/admin", "/supplier", "/delivery", "/printer", "/kitchen"] as const;

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

const TOKEN_OF: Record<PortalHome, string> = {
  "/delivery": "qk_delivery_token",
  "/delivery-request": "qk_delivery_pending_token",
  "/admin": "qk_admin_token",
  "/supplier/sales": "qk_supplier_token",
  "/printer": "qk_printer_token",
  "/kitchen": "qk_kitchen_token",
};
const PRIORITY: PortalHome[] = ["/delivery", "/delivery-request", "/admin", "/supplier/sales", "/printer", "/kitchen"];
/** The portal the person last opened themselves. Several partner sessions can
 * live on one device (an admin opening the seller portal, for example); the
 * app always returns to the one used last and never hops to another by itself. */
export const ACTIVE_PORTAL_KEY = "qk_active_portal";

/** Which portal a path belongs to, if any. */
export function portalForPath(path: string): PortalHome | null {
  if (path === "/delivery-request" || path.startsWith("/delivery-request/")) return "/delivery-request";
  if (path === "/delivery" || path.startsWith("/delivery/") || path.startsWith("/delivery-")) return "/delivery";
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin-")) return "/admin";
  if (path === "/supplier" || path.startsWith("/supplier/") || path.startsWith("/supplier-")) return "/supplier/sales";
  if (path === "/printer" || path.startsWith("/printer/") || path.startsWith("/printer-")) return "/printer";
  if (path === "/kitchen" || path.startsWith("/kitchen/")) return "/kitchen";
  return null;
}

/** Remember the portal the person just opened (called on every portal page visit). */
export function markActivePortal(path: string) {
  const home = portalForPath(path);
  if (!home) return;
  try { localStorage.setItem(ACTIVE_PORTAL_KEY, home); } catch { /* unavailable */ }
}

/** The portal this device's saved session belongs to, if any. */
export function portalHomeTarget(): PortalHome | null {
  if (typeof window === "undefined") return null;
  let active: string | null = null;
  try { active = localStorage.getItem(ACTIVE_PORTAL_KEY); } catch { active = null; }
  if (active && active in TOKEN_OF && readToken(TOKEN_OF[active as PortalHome])) return active as PortalHome;
  return PRIORITY.find(h => readToken(TOKEN_OF[h])) ?? null;
}

/**
 * Same decision as portalHomeTarget, as a tiny script that runs in the page
 * head before anything paints — so reopening the app goes straight to the
 * right portal instead of flashing the customer home (or another account).
 */
export const EARLY_PORTAL_REDIRECT_SCRIPT = `(function(){try{
var T=${JSON.stringify(TOKEN_OF)},P=${JSON.stringify(PRIORITY)};
function tok(k){var r=localStorage.getItem(k);if(!r||r==="null"||r==="undefined"||r==='""')return null;try{var j=JSON.parse(r);return typeof j==="string"&&j?j:null}catch(e){return r}}
var a=localStorage.getItem("${ACTIVE_PORTAL_KEY}"),h=null;
if(a&&T[a]&&tok(T[a]))h=a;else for(var i=0;i<P.length;i++){if(tok(T[P[i]])){h=P[i];break}}
if(!h)return;
var p=location.pathname,n=(performance.getEntriesByType("navigation")[0]||{}).type;
var portal=["/admin","/supplier","/delivery","/printer","/kitchen"].some(function(x){return p===x||p.indexOf(x+"/")===0||p.indexOf(x+"-")===0});
if(!portal&&p!=="/login"&&(p==="/"||n==="reload"||n==="back_forward"))location.replace(h);
}catch(e){}})();`;

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
