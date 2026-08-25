export const EVENT_TYPES = [
  "APP_OPENED", "HOME_VIEWED", "CATEGORY_VIEWED", "PRODUCT_VIEWED", "PRODUCT_SEARCHED",
  "PRODUCT_ADDED_TO_CART", "PRODUCT_REMOVED_FROM_CART", "CART_VIEWED", "CHECKOUT_STARTED",
  "PAYMENT_STARTED", "ORDER_PLACED", "ORDER_CANCELLED", "PRODUCT_PURCHASED",
  "PRODUCT_FAVORITED", "PRODUCT_UNFAVORITED", "PRODUCT_SHARED",
  "RECOMMENDATION_VIEWED", "RECOMMENDATION_CLICKED", "RECOMMENDATION_ADDED_TO_CART",
  "RECOMMENDATION_PURCHASED",
] as const;

export type CustomerEventType = (typeof EVENT_TYPES)[number];

export type TrackInput = {
  token?: string;
  sessionId?: string;
  events: {
    eventType: string;
    productId?: string;
    category?: string;
    orderId?: string;
    searchQuery?: string;
    metadata?: Record<string, unknown>;
  }[];
};

export function cleanString(value: unknown, max = 200): string {
  return String(value ?? "").trim().slice(0, max);
}

export function validateTrackInput(data: TrackInput) {
  return {
    token: cleanString(data?.token, 800),
    sessionId: cleanString(data?.sessionId, 80),
    events: (Array.isArray(data?.events) ? data.events : []).slice(0, 25).map((event) => ({
      eventType: cleanString(event?.eventType, 40),
      productId: cleanString(event?.productId, 64),
      category: cleanString(event?.category, 64),
      orderId: cleanString(event?.orderId, 64),
      searchQuery: cleanString(event?.searchQuery, 120),
      metadata: event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
    })),
  };
}

export function validateRecommendationInput(data: { token?: string; cartProductIds?: string[]; limit?: number }) {
  return {
    token: cleanString(data?.token, 800),
    cartProductIds: (Array.isArray(data?.cartProductIds) ? data.cartProductIds : [])
      .map((id) => cleanString(id, 64)).filter(Boolean).slice(0, 20),
    limit: Number(data?.limit ?? 8),
  };
}

export function validateProductIdsInput(data: { productIds?: string[]; limit?: number }) {
  return {
    productIds: (Array.isArray(data?.productIds) ? data.productIds : [])
      .map((id) => cleanString(id, 64)).filter(Boolean).slice(0, 20),
    limit: Number(data?.limit ?? 4),
  };
}

export function validateIngestInput(data: { token?: string; orderId: string; recommendationProductIds?: string[] }) {
  return {
    token: cleanString(data?.token, 800),
    orderId: cleanString(data?.orderId, 64),
    recommendationProductIds: (Array.isArray(data?.recommendationProductIds) ? data.recommendationProductIds : [])
      .map((id) => cleanString(id, 64)).filter(Boolean).slice(0, 50),
  };
}

export function validateAdminInput(data: { adminToken?: string; days?: number }) {
  return {
    adminToken: cleanString(data?.adminToken, 800),
    days: Math.max(1, Math.min(120, Number(data?.days ?? 30))),
  };
}

export function validateSettingsInput(data: { adminToken?: string; settings: Record<string, number> }) {
  return {
    adminToken: cleanString(data?.adminToken, 800),
    settings: (data?.settings ?? {}) as Record<string, number>,
  };
}