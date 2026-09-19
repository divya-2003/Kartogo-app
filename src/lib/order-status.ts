// Canonical order lifecycle rules.
//
// These rules MIRROR the database trigger `validate_order_status_transition`
// (public.app_orders) so the app can reject an impossible move before it ever
// reaches Postgres, and so they can be unit-tested without a database.
// The database remains the final authority — this module must never be
// relaxed beyond what the trigger allows.

export const ORDER_STATUSES = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Forward progress ranking. `cancelled` sits outside the happy path. */
const RANK: Record<OrderStatus, number> = {
  placed: 1,
  packed: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: 99,
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export type TransitionVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Can an order move from `from` to `to`?
 * - unknown target        -> no
 * - already terminal      -> no
 * - same status           -> no-op, allowed (the DB trigger short-circuits it)
 * - cancel from any live state -> yes
 * - otherwise forward only
 */
export function canTransition(from: unknown, to: unknown): TransitionVerdict {
  if (!isOrderStatus(to)) return { ok: false, reason: `Invalid order status "${String(to)}"` };
  if (!isOrderStatus(from)) return { ok: false, reason: `Unknown current status "${String(from)}"` };
  if (from === to) return { ok: true };
  if (isTerminal(from)) {
    return { ok: false, reason: `This order is already ${from} and cannot change to ${to}` };
  }
  if (to === "cancelled") return { ok: true };
  if (RANK[to] <= RANK[from]) {
    return { ok: false, reason: `Cannot move an order backwards from ${from} to ${to}` };
  }
  return { ok: true };
}

/** Statuses an operator may legally pick for an order currently in `from`. */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((s) => s !== from && canTransition(from, s).ok);
}

/**
 * What must happen to reserved stock when an order reaches `status`.
 * Mirrors `syncInventoryForStatus` in inventory.server.ts.
 */
export function inventoryEffectFor(status: OrderStatus): "commit" | "release" | "none" {
  if (status === "delivered") return "commit";
  if (status === "cancelled") return "release";
  return "none";
}
