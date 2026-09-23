// Shared, browser-safe marketplace types and configuration.
// Category behaviour drives which transaction experience a listing uses.

export type ListingType = "PRODUCT" | "SERVICE" | "BOOKING" | "PACKAGE" | "REQUEST_QUOTE";
export type TransactionType = "PRODUCT_ORDER" | "SERVICE_BOOKING" | "HOME_SERVICE_BOOKING" | "EVENT_BOOKING" | "QUOTE_REQUEST";
export type PartnerType = "RETAILER" | "SERVICE_PROVIDER" | "PROFESSIONAL" | "EVENT_PROVIDER" | "FURNITURE_SELLER" | "HOME_SERVICE_PROVIDER";
export type ServiceMode = "AT_SALON" | "HOME_SERVICE";
export type CategoryBehavior = "PRODUCT" | "FURNITURE" | "SALON" | "HOME_SERVICE" | "EVENT" | "QUOTE";
export type CategoryGroup = "shop" | "beauty" | "home_services" | "events";

export type BookingStatus =
  | "BOOKING_REQUESTED" | "PROVIDER_CONFIRMED" | "PROFESSIONAL_ASSIGNED" | "PROFESSIONAL_TRAVELLING"
  | "ARRIVED" | "SERVICE_STARTED" | "SERVICE_COMPLETED" | "QUOTE_SENT" | "CANCELLED";

export type MpCategory = {
  slug: string; name: string; group_key: CategoryGroup; icon: string; image_url: string | null;
  behavior: CategoryBehavior; legacy_categories: string[]; sort: number; is_popular: boolean;
};

export type MpPartner = {
  id: string; slug: string; name: string; partner_type: PartnerType; description: string | null;
  category_slugs: string[]; rating: number; review_count: number; distance_km: number | null;
  opens_at: string | null; closes_at: string | null; address: string | null; service_area: string | null;
  service_modes: ServiceMode[]; photos: string[]; icon: string; created_at: string;
};

export type EventPackage = { name: string; price: number | null; items: string[] };

export type MpListing = {
  id: string; partner_id: string; category_slug: string; listing_type: ListingType; transaction_type: TransactionType;
  name: string; description: string | null; images: string[]; icon: string; price: number | null; mrp: number | null;
  starting_price: number | null; duration_min: number | null; includes: string[];
  attributes: { material?: string; dimensions?: string; variants?: string[]; installation?: boolean; delivery?: string };
  packages: EventPackage[]; service_modes: ServiceMode[]; home_service_fee: number; rating: number;
  review_count: number; service_area: string | null; created_at: string;
  partner?: Pick<MpPartner, "id" | "name" | "slug" | "icon" | "rating" | "distance_km" | "partner_type"> | null;
};

export type Service = MpListing;

export type MpStaff = { id: string; partner_id: string; name: string; title: string | null; photo_url: string | null; rating: number };

export type ProviderAvailability = { time: string; staffIds: string[] };

export type Booking = {
  id: string; booking_code: string; partner_id: string; listing_id: string | null; transaction_type: TransactionType;
  service_mode: ServiceMode | null; staff_id: string | null; booking_date: string | null; start_time: string | null;
  end_time: string | null; address: { line?: string; landmark?: string } | null; details: Record<string, unknown>;
  amount: number; fee: number; status: BookingStatus; quote_amount: number | null; quote_note: string | null;
  created_at: string; customer_name?: string | null;
  partner?: { name: string; icon: string; address: string | null } | null;
  listing?: { name: string; icon: string } | null;
  staff?: { name: string; rating: number; title: string | null } | null;
  history?: { status: string; note: string | null; created_at: string }[];
};

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  shop: "Shop",
  beauty: "Beauty & Wellness",
  home_services: "Home Services",
  events: "Events",
};

export const STATUS_LABELS: Record<string, string> = {
  BOOKING_REQUESTED: "Requested",
  PROVIDER_CONFIRMED: "Confirmed",
  PROFESSIONAL_ASSIGNED: "Professional assigned",
  PROFESSIONAL_TRAVELLING: "Professional on the way",
  ARRIVED: "Arrived",
  SERVICE_STARTED: "Service started",
  SERVICE_COMPLETED: "Completed",
  QUOTE_SENT: "Quote received",
  CANCELLED: "Cancelled",
};

export const TX_LABELS: Record<TransactionType, string> = {
  PRODUCT_ORDER: "Scheduled order",
  SERVICE_BOOKING: "Appointment",
  HOME_SERVICE_BOOKING: "Home service",
  EVENT_BOOKING: "Event booking",
  QUOTE_REQUEST: "Quote request",
};

/** Timeline shown on the booking detail page, per transaction type. */
export function timelineFor(tx: TransactionType, mode?: ServiceMode | null): BookingStatus[] {
  if (tx === "QUOTE_REQUEST") return ["BOOKING_REQUESTED", "QUOTE_SENT", "PROVIDER_CONFIRMED", "SERVICE_COMPLETED"];
  if (tx === "EVENT_BOOKING") return ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "SERVICE_STARTED", "SERVICE_COMPLETED"];
  if (tx === "PRODUCT_ORDER") return ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "PROFESSIONAL_TRAVELLING", "SERVICE_COMPLETED"];
  if (tx === "HOME_SERVICE_BOOKING" || mode === "HOME_SERVICE")
    return ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "PROFESSIONAL_ASSIGNED", "PROFESSIONAL_TRAVELLING", "ARRIVED", "SERVICE_STARTED", "SERVICE_COMPLETED"];
  return ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "SERVICE_STARTED", "SERVICE_COMPLETED"];
}

/** Customers can cancel until the service has started (existing refund rules apply to paid orders). */
export function canCustomerCancel(status: BookingStatus): boolean {
  return ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "PROFESSIONAL_ASSIGNED", "QUOTE_SENT"].includes(status);
}

export function listingPrice(l: Pick<MpListing, "price" | "starting_price" | "packages">): { amount: number | null; from: boolean } {
  if (l.price != null) return { amount: Number(l.price), from: false };
  if (l.starting_price != null) return { amount: Number(l.starting_price), from: true };
  return { amount: null, from: false };
}

/** Which detail route a listing opens, based on its transaction type. */
export function listingRoute(l: Pick<MpListing, "transaction_type" | "category_slug">): "/service/$id" | "/event/$id" | "/item/$id" {
  if (l.transaction_type === "EVENT_BOOKING" || l.transaction_type === "QUOTE_REQUEST") return "/event/$id";
  if (l.transaction_type === "PRODUCT_ORDER") return "/item/$id";
  return "/service/$id";
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
}

export function isOpenNow(p: Pick<MpPartner, "opens_at" | "closes_at">): boolean | null {
  if (!p.opens_at || !p.closes_at) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return cur >= toMin(p.opens_at) && cur < toMin(p.closes_at);
}
