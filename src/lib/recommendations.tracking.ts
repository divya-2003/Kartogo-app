// Single reusable event-tracking service. Components never talk to the
// database directly — they call these helpers, which batch events and flush
// them to the server every couple of seconds.

import { trackCustomerEventsFn } from "./recommendations.functions";
import type { CustomerEventType } from "./recommendations.shared";

type QueuedEvent = {
  eventType: CustomerEventType;
  productId?: string;
  category?: string;
  orderId?: string;
  searchQuery?: string;
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = "qk_rec_session";
const TOKEN_KEY = "qk_customer_token";
const RECOMMENDATION_CART_KEY = "qk_rec_cart_products";

function readStore(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    // store.tsx persists values as JSON strings.
    try { const parsed = JSON.parse(raw); return typeof parsed === "string" ? parsed : raw; }
    catch { return raw; }
  } catch { return null; }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = readStore(SESSION_KEY);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    try { window.localStorage.setItem(SESSION_KEY, id); } catch { /* private mode */ }
  }
  return id;
}

function getToken(): string {
  return readStore(TOKEN_KEY) ?? "";
}

function rememberRecommendationCartProduct(productId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_CART_KEY);
    const existing = raw ? JSON.parse(raw) as unknown : [];
    const ids = Array.isArray(existing) ? existing.filter((id): id is string => typeof id === "string") : [];
    window.localStorage.setItem(RECOMMENDATION_CART_KEY, JSON.stringify([...new Set([...ids, productId])].slice(-50)));
  } catch { /* attribution must not affect shopping */ }
}

export function getRecommendationCartProductIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_CART_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(-50) : [];
  } catch { return []; }
}

export function clearRecommendationCartProductIds() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(RECOMMENDATION_CART_KEY); } catch { /* noop */ }
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
// Cheap de-duplication so a re-render cannot log the same view twice.
const recent = new Map<string, number>();

async function flush() {
  timer = null;
  const events = queue;
  queue = [];
  if (events.length === 0) return;
  try {
    await trackCustomerEventsFn({
      data: { token: getToken(), sessionId: getSessionId(), events },
    });
  } catch {
    // Tracking must never break the shopping experience.
  }
}

export function trackEvent(event: QueuedEvent, opts: { dedupeMs?: number } = {}) {
  if (typeof window === "undefined") return;
  const dedupeMs = opts.dedupeMs ?? 4000;
  const key = `${event.eventType}:${event.productId ?? ""}:${event.category ?? ""}:${event.searchQuery ?? ""}:${event.orderId ?? ""}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < dedupeMs) return;
  recent.set(key, now);
  queue.push(event);
  if (queue.length >= 20) { void flush(); return; }
  if (!timer) timer = setTimeout(() => { void flush(); }, 1500);
}

export const customerEventService = {
  trackEvent,
  trackAppOpened: () => trackEvent({ eventType: "APP_OPENED" }, { dedupeMs: 60_000 }),
  trackHomeViewed: () => trackEvent({ eventType: "HOME_VIEWED" }, { dedupeMs: 30_000 }),
  trackCategoryViewed: (category: string) => trackEvent({ eventType: "CATEGORY_VIEWED", category }),
  trackProductView: (productId: string, category?: string) =>
    trackEvent({ eventType: "PRODUCT_VIEWED", productId, category }, { dedupeMs: 15_000 }),
  trackSearch: (searchQuery: string, productId?: string) =>
    trackEvent({ eventType: "PRODUCT_SEARCHED", searchQuery, productId }, { dedupeMs: 3000 }),
  trackAddToCart: (productId: string) => trackEvent({ eventType: "PRODUCT_ADDED_TO_CART", productId }, { dedupeMs: 1000 }),
  trackRemoveFromCart: (productId: string) => trackEvent({ eventType: "PRODUCT_REMOVED_FROM_CART", productId }, { dedupeMs: 1000 }),
  trackCartView: () => trackEvent({ eventType: "CART_VIEWED" }, { dedupeMs: 15_000 }),
  trackCheckoutStarted: () => trackEvent({ eventType: "CHECKOUT_STARTED" }, { dedupeMs: 15_000 }),
  trackPaymentStarted: () => trackEvent({ eventType: "PAYMENT_STARTED" }, { dedupeMs: 10_000 }),
  trackOrderPlaced: (orderId: string) => trackEvent({ eventType: "ORDER_PLACED", orderId }, { dedupeMs: 600_000 }),
  trackOrderCancelled: (orderId: string) => trackEvent({ eventType: "ORDER_CANCELLED", orderId }, { dedupeMs: 600_000 }),
  trackProductFavorite: (productId: string, favorited: boolean) =>
    trackEvent({ eventType: favorited ? "PRODUCT_FAVORITED" : "PRODUCT_UNFAVORITED", productId }, { dedupeMs: 500 }),
  trackProductShared: (productId: string) => trackEvent({ eventType: "PRODUCT_SHARED", productId }),
  trackRecommendationViewed: (productId: string, type: string) =>
    trackEvent({ eventType: "RECOMMENDATION_VIEWED", productId, metadata: { type } }, { dedupeMs: 60_000 }),
  trackRecommendationClicked: (productId: string, type: string) =>
    trackEvent({ eventType: "RECOMMENDATION_CLICKED", productId, metadata: { type } }, { dedupeMs: 1000 }),
  trackRecommendationAddedToCart: (productId: string, type: string) =>
    (rememberRecommendationCartProduct(productId),
    trackEvent({ eventType: "RECOMMENDATION_ADDED_TO_CART", productId, metadata: { type } }, { dedupeMs: 1000 })),
  trackRecommendationPurchased: (productId: string, orderId: string) =>
    trackEvent({ eventType: "RECOMMENDATION_PURCHASED", productId, orderId }, { dedupeMs: 600_000 }),
};

export type CustomerEventService = typeof customerEventService;
