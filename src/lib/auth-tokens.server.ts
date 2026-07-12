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

// ---- Delivery partner tokens ----
// The delivery roster is defined here on the server. Its ids MUST match the
// client-side DELIVERY_BOYS list (src/lib/data.ts) since orders are assigned by
// that id. A driver logs in with the phone number registered here.
export const DELIVERY_ROSTER: readonly { id: string; name: string; phone: string; active: boolean }[] = [
  { id: "d1", name: "Ravi Kumar", phone: "9876500001", active: true },
  { id: "d2", name: "Suresh M.", phone: "9876500002", active: true },
  { id: "d3", name: "Naveen P.", phone: "9876500003", active: false },
];

export function findDriverByPhone(phone: string) {
  return DELIVERY_ROSTER.find((d) => d.phone === phone) ?? null;
}

function deliverySecret(): string {
  const s = process.env.DELIVERY_SESSION_SECRET;
  if (!s) throw new Error("DELIVERY_SESSION_SECRET is not configured");
  return s;
}

export function issueDeliveryToken(driverId: string, phone: string): string {
  return sign({ role: "delivery", driverId, phone, exp: Date.now() + 30 * DAY }, deliverySecret());
}

export function verifyDeliveryToken(token?: string): { driverId: string; phone: string } | null {
  const data = verify(token, deliverySecret());
  if (data && data.role === "delivery" && typeof data.driverId === "string" && typeof data.phone === "string") {
    return { driverId: data.driverId, phone: data.phone };
  }
  return null;
}

// ---- Supplier tokens ----
// Suppliers own a set of product categories (see src/lib/suppliers.ts). A signed
// supplier token binds a session to one supplier id + phone so inventory and
// order access can be scoped server-side to that supplier's categories.
function supplierSecret(): string {
  const s = process.env.SUPPLIER_SESSION_SECRET;
  if (!s) throw new Error("SUPPLIER_SESSION_SECRET is not configured");
  return s;
}

export function issueSupplierToken(supplierId: string, phone: string): string {
  return sign({ role: "supplier", supplierId, phone, exp: Date.now() + 30 * DAY }, supplierSecret());
}

export function verifySupplierToken(token?: string): { supplierId: string; phone: string } | null {
  const data = verify(token, supplierSecret());
  if (data && data.role === "supplier" && typeof data.supplierId === "string" && typeof data.phone === "string") {
    return { supplierId: data.supplierId, phone: data.phone };
  }
  return null;
}
