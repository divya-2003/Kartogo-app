// Server-only HMAC-signed session tokens. Roles and identity are derived ONLY
// from values the server signs — never from anything the client claims.
import { createHmac, timingSafeEqual } from "node:crypto";

const DAY = 86_400_000;

function adminSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return s;
}
function customerSecret(): string {
  const s = process.env.CUSTOMER_SESSION_SECRET;
  if (!s) throw new Error("CUSTOMER_SESSION_SECRET is not configured");
  return s;
}

function sign(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string | undefined, secret: string): Record<string, unknown> | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof data.exp === "number" && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- Customer (phone-bound) tokens ----
export function issueCustomerToken(phone: string): string {
  return sign({ phone, exp: Date.now() + 30 * DAY }, customerSecret());
}
export function verifyCustomerToken(token?: string): { phone: string } | null {
  const data = verify(token, customerSecret());
  return data && typeof data.phone === "string" ? { phone: data.phone } : null;
}

// ---- Admin tokens ----
export function issueAdminToken(): string {
  return sign({ admin: true, exp: Date.now() + DAY }, adminSecret());
}
export function verifyAdminToken(token?: string): boolean {
  const data = verify(token, adminSecret());
  return !!(data && data.admin === true);
}

// Allow list lives on the server only. Used to decide whether to prompt for the
// admin passcode after OTP — it never grants any access on its own.
const ADMIN_PHONES: readonly string[] = ["9110310034"];
export const isAdminPhone = (phone: string) => ADMIN_PHONES.includes(phone);
