// Browser-safe helpers for the admin "Customers" activity section.
// Turns raw customer_events rows into per-customer summaries and spots
// actions the shopper started but never finished.

export type ActivityEvent = {
  id: string;
  phone: string | null;
  session_id: string | null;
  event_type: string;
  product_id: string | null;
  category: string | null;
  order_id: string | null;
  search_query: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type IncompleteKind = "LEFT_IN_CART" | "CHECKOUT_NOT_FINISHED" | "PAYMENT_NOT_FINISHED";

export type IncompleteAction = { kind: IncompleteKind; at: string; productIds: string[] };

export type CustomerActivity = {
  key: string;
  phone: string | null;
  name: string | null;
  sessionIds: string[];
  firstSeen: string;
  lastSeen: string;
  counts: Record<string, number>;
  incomplete: IncompleteAction[];
  events: ActivityEvent[];
};

export const EVENT_LABELS: Record<string, string> = {
  APP_OPENED: "Opened the app",
  HOME_VIEWED: "Viewed home",
  CATEGORY_VIEWED: "Opened a category",
  PRODUCT_VIEWED: "Viewed a product",
  PRODUCT_SEARCHED: "Searched",
  PRODUCT_ADDED_TO_CART: "Added to cart",
  PRODUCT_REMOVED_FROM_CART: "Removed from cart",
  CART_VIEWED: "Opened the cart",
  CHECKOUT_STARTED: "Started checkout",
  PAYMENT_STARTED: "Started payment",
  ORDER_PLACED: "Placed an order",
  ORDER_CANCELLED: "Cancelled an order",
  PRODUCT_PURCHASED: "Bought a product",
  PRODUCT_FAVORITED: "Added to wishlist",
  PRODUCT_UNFAVORITED: "Removed from wishlist",
  PRODUCT_SHARED: "Shared a product",
  RECOMMENDATION_VIEWED: "Saw a suggestion",
  RECOMMENDATION_CLICKED: "Tapped a suggestion",
  RECOMMENDATION_ADDED_TO_CART: "Added a suggestion to cart",
  RECOMMENDATION_PURCHASED: "Bought a suggestion",
  ELEMENT_CLICKED: "Clicked",
};

export const INCOMPLETE_LABELS: Record<IncompleteKind, string> = {
  LEFT_IN_CART: "Left items in cart",
  CHECKOUT_NOT_FINISHED: "Checkout not finished",
  PAYMENT_NOT_FINISHED: "Payment not finished",
};

const ADD = new Set(["PRODUCT_ADDED_TO_CART", "RECOMMENDATION_ADDED_TO_CART"]);
const CLEAR = new Set(["PRODUCT_REMOVED_FROM_CART", "PRODUCT_PURCHASED", "RECOMMENDATION_PURCHASED"]);
const time = (e: { created_at: string }) => new Date(e.created_at).getTime();

/**
 * Actions a shopper began and did not complete:
 * - a product added to the cart and not removed or bought afterwards,
 * - checkout or payment started after their latest placed order.
 */
export function findIncompleteActions(events: ActivityEvent[]): IncompleteAction[] {
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  let lastOrder = -Infinity;
  for (const e of sorted) if (e.event_type === "ORDER_PLACED") lastOrder = Math.max(lastOrder, time(e));

  const added = new Map<string, number>();
  const cleared = new Map<string, number>();
  let checkoutAt: string | null = null;
  let paymentAt: string | null = null;
  for (const e of sorted) {
    const t = time(e);
    if (e.product_id && ADD.has(e.event_type)) added.set(e.product_id, t);
    if (e.product_id && CLEAR.has(e.event_type)) cleared.set(e.product_id, t);
    if (t > lastOrder && e.event_type === "CHECKOUT_STARTED") checkoutAt = e.created_at;
    if (t > lastOrder && e.event_type === "PAYMENT_STARTED") paymentAt = e.created_at;
  }

  const out: IncompleteAction[] = [];
  const left = [...added.entries()].filter(([id, t]) => t > (cleared.get(id) ?? -Infinity));
  if (left.length) {
    const latest = Math.max(...left.map(([, t]) => t));
    out.push({ kind: "LEFT_IN_CART", at: new Date(latest).toISOString(), productIds: left.map(([id]) => id) });
  }
  if (checkoutAt) out.push({ kind: "CHECKOUT_NOT_FINISHED", at: checkoutAt, productIds: [] });
  if (paymentAt) out.push({ kind: "PAYMENT_NOT_FINISHED", at: paymentAt, productIds: [] });
  return out;
}

/**
 * Groups events per customer. Guest sessions that later signed in are folded
 * into that phone number so one shopper shows up once.
 */
export function groupCustomerActivity(events: ActivityEvent[], names: Record<string, string> = {}, perCustomer = 300): CustomerActivity[] {
  const sessionPhone = new Map<string, string>();
  for (const e of events) if (e.phone && e.session_id && !sessionPhone.has(e.session_id)) sessionPhone.set(e.session_id, e.phone);

  const groups = new Map<string, { phone: string | null; sessions: Set<string>; events: ActivityEvent[] }>();
  for (const e of events) {
    const phone = e.phone ?? (e.session_id ? sessionPhone.get(e.session_id) ?? null : null);
    const key = phone ? `phone:${phone}` : e.session_id ? `guest:${e.session_id}` : null;
    if (!key) continue;
    let g = groups.get(key);
    if (!g) { g = { phone, sessions: new Set(), events: [] }; groups.set(key, g); }
    if (e.session_id) g.sessions.add(e.session_id);
    g.events.push(e);
  }

  return [...groups.entries()].map(([key, g]) => {
    const desc = [...g.events].sort((a, b) => time(b) - time(a));
    const counts: Record<string, number> = {};
    for (const e of desc) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
    return {
      key,
      phone: g.phone,
      name: g.phone ? names[g.phone] ?? null : null,
      sessionIds: [...g.sessions],
      firstSeen: desc[desc.length - 1].created_at,
      lastSeen: desc[0].created_at,
      counts,
      incomplete: findIncompleteActions(desc),
      events: desc.slice(0, perCustomer),
    };
  }).sort((a, b) => time({ created_at: b.lastSeen }) - time({ created_at: a.lastSeen }));
}

/** Short, privacy-safe label for a clicked button or link. */
export function clickLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/\d{6,}/g, "•••").slice(0, 60);
}
