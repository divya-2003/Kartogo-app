// Keeps every Kartogo account (customer, seller, rider, printer, admin) signed
// in on this device.
//
//  1. Every session key is mirrored into a long-lived cookie, so a phone or
//     browser that clears app storage on close restores the session on the
//     next open instead of showing the login screen.
//  2. Tokens are silently re-signed by the server with a fresh expiry, so a
//     session never runs out while the app is used.
//
// Only an explicit sign-out (removeItem on a session key) clears the cookie.

import { renewSessionsFn } from "./session.functions";

/** Session keys. `json` keys hold JSON.stringify'd values; delivery is raw. */
const TOKEN_KEYS = {
  customer: { key: "qk_customer_token", json: true },
  admin: { key: "qk_admin_token", json: true },
  delivery: { key: "qk_delivery_token", json: false },
  supplier: { key: "qk_supplier_token", json: true },
  printer: { key: "qk_printer_token", json: true },
} as const;

type Role = keyof typeof TOKEN_KEYS;

const PROFILE_KEYS = ["qk_user", "qk_delivery_driver", "qk_supplier", "qk_printer"];
const ALL_KEYS = new Set<string>([...Object.values(TOKEN_KEYS).map((t) => t.key), ...PROFILE_KEYS]);

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days
const RENEW_EVERY = 12 * 60 * 60 * 1000;
const RENEWED_AT = "qk_session_renewed_at";
export const SESSION_RENEWED_EVENT = "qk-session-renewed";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

function readCookie(key: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(key: string, raw: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = raw == null || raw === "null"
    ? `${key}=; path=/; max-age=0; SameSite=Lax${secure}`
    : `${key}=${encodeURIComponent(raw)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

let patched = false;
/** Mirror every write/removal of a session key into its cookie. */
function patchStorage() {
  if (patched) return;
  patched = true;
  try {
    const proto = Object.getPrototypeOf(window.localStorage) as Storage;
    const origSet = proto.setItem;
    const origRemove = proto.removeItem;
    proto.setItem = function (this: Storage, key: string, value: string) {
      origSet.call(this, key, value);
      if (this === window.localStorage && ALL_KEYS.has(key)) { try { setCookie(key, value); } catch { /* noop */ } }
    };
    proto.removeItem = function (this: Storage, key: string) {
      origRemove.call(this, key);
      if (this === window.localStorage && ALL_KEYS.has(key)) { try { setCookie(key, null); } catch { /* noop */ } }
    };
  } catch { /* storage unavailable */ }
}

/** Put back any session the browser dropped from storage but kept in cookies. */
export function restoreSessions() {
  if (!isBrowser()) return;
  try {
    for (const key of ALL_KEYS) {
      const local = localStorage.getItem(key);
      const cookie = readCookie(key);
      if ((!local || local === "null") && cookie && cookie !== "null") localStorage.setItem(key, cookie);
      else if (local && local !== "null" && local !== cookie) setCookie(key, local);
    }
  } catch { /* noop */ }
}

function readToken(role: Role): string | null {
  const { key, json } = TOKEN_KEYS[role];
  const raw = localStorage.getItem(key);
  if (!raw || raw === "null") return null;
  if (!json) return raw;
  try { const v = JSON.parse(raw); return typeof v === "string" ? v : null; } catch { return raw; }
}

let inflight: Promise<Partial<Record<Role, string>>> | null = null;

/**
 * Ask the server to re-sign every token on this device. Safe to call often;
 * network failures never remove a session.
 */
export function renewSessions(force = false): Promise<Partial<Record<Role, string>>> {
  if (!isBrowser()) return Promise.resolve({});
  if (!force) {
    const last = Number(localStorage.getItem(RENEWED_AT) || 0);
    if (Date.now() - last < RENEW_EVERY) return Promise.resolve({});
  }
  if (inflight) return inflight;
  const input: Partial<Record<Role, string>> = {};
  for (const role of Object.keys(TOKEN_KEYS) as Role[]) {
    const t = readToken(role);
    if (t) input[role] = t;
  }
  if (Object.keys(input).length === 0) return Promise.resolve({});
  inflight = renewSessionsFn({ data: input })
    .then((res) => {
      const renewed: Partial<Record<Role, string>> = {};
      for (const role of Object.keys(TOKEN_KEYS) as Role[]) {
        const fresh = (res as Record<string, string | null | undefined>)[role];
        // Only replace a token that is still on the device (not signed out meanwhile).
        if (fresh && readToken(role) === input[role]) {
          const { key, json } = TOKEN_KEYS[role];
          localStorage.setItem(key, json ? JSON.stringify(fresh) : fresh);
          renewed[role] = fresh;
        }
      }
      localStorage.setItem(RENEWED_AT, String(Date.now()));
      window.dispatchEvent(new CustomEvent(SESSION_RENEWED_EVENT, { detail: renewed }));
      return renewed;
    })
    .catch(() => ({}))
    .finally(() => { inflight = null; });
  return inflight;
}

let started = false;
/** Start mirroring + periodic renewal. Idempotent. */
export function startSessionKeeper() {
  if (!isBrowser() || started) return;
  started = true;
  restoreSessions();
  void renewSessions();
  const onVisible = () => { if (document.visibilityState === "visible") { restoreSessions(); void renewSessions(); } };
  document.addEventListener("visibilitychange", onVisible);
  window.setInterval(() => void renewSessions(), 60 * 60 * 1000);
}

// Run as early as possible on the client so route guards that read storage
// directly already see a restored session.
if (isBrowser()) {
  patchStorage();
  restoreSessions();
}
