// ============================================================================
// Kartogo Logistics — shared contracts (client + server safe)
//
// Everything in the logistics layer speaks these types. Keeping them in one
// dependency-free module means React components, hooks and server functions
// can all import them without dragging server-only code into the browser
// bundle.
// ============================================================================

/** Phase 1 — driver lifecycle. Mirrors the `driver_status` DB enum exactly. */
export const DRIVER_STATUSES = [
  "OFFLINE",
  "ONLINE",
  "AVAILABLE",
  "ASSIGNED",
  "PICKING_ORDER",
  "ARRIVED_AT_STORE",
  "EN_ROUTE",
  "ARRIVED_AT_CUSTOMER",
  "DELIVERED",
  "BREAK",
] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

/** Statuses in which a rider may receive a new offer. */
export const DISPATCHABLE_STATUSES: readonly DriverStatus[] = ["ONLINE", "AVAILABLE"];

/** Statuses that mean the rider is currently working an order. */
export const BUSY_STATUSES: readonly DriverStatus[] = [
  "ASSIGNED",
  "PICKING_ORDER",
  "ARRIVED_AT_STORE",
  "EN_ROUTE",
  "ARRIVED_AT_CUSTOMER",
];

/** Radius inside which a rider counts as "arrived" without tapping anything. */
export const GEOFENCE_RADIUS_METERS = 50;

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  OFFLINE: "Offline",
  ONLINE: "Online",
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
  PICKING_ORDER: "Picking up",
  ARRIVED_AT_STORE: "At the store",
  EN_ROUTE: "On the way",
  ARRIVED_AT_CUSTOMER: "At your door",
  DELIVERED: "Delivered",
  BREAK: "On break",
};

export const VEHICLE_TYPES = ["bike", "scooter", "cycle", "ev_bike", "auto"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  bike: "Bike",
  scooter: "Scooter",
  cycle: "Cycle",
  ev_bike: "EV bike",
  auto: "Auto",
};

/** Phase 3/4 — an offer of one order to one rider. */
export const ASSIGNMENT_STATUSES = [
  "OFFERED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "COMPLETED",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Seconds a rider has to accept an offer before it rolls to the next nearest. */
export const ACCEPT_WINDOW_SECONDS = 20;

/** Phase 2 — GPS cadence and the movement threshold below which pings are dropped. */
export const GPS_INTERVAL_MS = 10_000;
export const GPS_MIN_MOVE_METERS = 10;

/** A rider is treated as stale/offline if we haven't heard from them in this long. */
export const DRIVER_STALE_MS = 90_000;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryPartner {
  id: string;
  driverId: string;
  name: string;
  mobileNumber: string;
  vehicleType: VehicleType;
  location: GeoPoint | null;
  status: DriverStatus;
  online: boolean;
  rating: number;
  ratingCount: number;
  completedOrders: number;
  activeOrderId: string | null;
  lastLocationAt: string | null;
}

/** Rider view of a partner without the phone number (customers never see it). */
export type PublicDriver = Pick<DeliveryPartner, "name" | "vehicleType" | "rating"> & {
  location: GeoPoint | null;
  lastLocationAt: string | null;
};

export interface DeliveryAssignment {
  id: string;
  orderId: string;
  driverId: string;
  status: AssignmentStatus;
  attempt: number;
  distanceMeters: number | null;
  pickup: GeoPoint | null;
  drop: GeoPoint | null;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
  reason: string | null;
}

/** Phase 5 — what the customer sees while their order is in flight. */
export const CUSTOMER_TRACK_STAGES = [
  "preparing",
  "driver_assigned",
  "picked_up",
  "on_the_way",
  "delivered",
] as const;
export type CustomerTrackStage = (typeof CUSTOMER_TRACK_STAGES)[number];

export const CUSTOMER_TRACK_LABEL: Record<CustomerTrackStage, string> = {
  preparing: "Preparing",
  driver_assigned: "Driver assigned",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
};

export interface RouteEstimate {
  /** Metres along the road (or straight-line fallback). */
  distanceMeters: number;
  /** Seconds of travel time. */
  durationSeconds: number;
  /** Encoded Google polyline when the Directions API answered. */
  polyline: string | null;
  source: "google_directions" | "estimate";
}

export interface TrackingSnapshot {
  orderId: string;
  stage: CustomerTrackStage;
  driver: PublicDriver | null;
  pickup: GeoPoint | null;
  drop: GeoPoint | null;
  route: RouteEstimate | null;
  etaMinutes: number | null;
  updatedAt: string;
}

/** Phase 8 — admin control tower numbers. */
export interface LogisticsDashboard {
  onlineDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  ordersWaitingForDriver: number;
  ordersInDelivery: number;
  deliveredToday: number;
  averageDeliveryMinutes: number | null;
  partners: DeliveryPartner[];
}

/** Delivery events written to `delivery_events` — the logistics audit trail. */
export type DeliveryEventType =
  | "order_ready"
  | "driver_offered"
  | "driver_accepted"
  | "driver_rejected"
  | "offer_expired"
  | "picked_up"
  | "en_route"
  | "driver_nearby"
  | "arrived_at_store"
  | "arrived_at_customer"
  | "delivered"
  | "cancelled"
  | "driver_released"
  | "no_driver_available";

// ---------------------------------------------------------------------------
// Phase 11 — future capability seams.
//
// Nothing below is implemented today. They exist so Redis GEO, batching,
// multi-order runs, AI dispatch, surge, heat maps and demand prediction can be
// dropped in behind the same call sites without touching the dispatch flow.
// `dispatch.server.ts` resolves its strategy through `logisticsCapabilities`,
// so a future upgrade is a registration, not a rewrite.
// ---------------------------------------------------------------------------

export interface DriverCandidate {
  driverId: string;
  location: GeoPoint;
  distanceMeters: number;
  activeOrders: number;
  rating: number;
}

/** Nearest-driver lookup. Today: Postgres scan. Later: Redis GEO / PostGIS. */
export interface GeoIndex {
  nearest(origin: GeoPoint, candidates: DriverCandidate[], limit: number): Promise<DriverCandidate[]>;
}

/** Ordering of candidates for an order. Today: pure distance. Later: AI dispatch. */
export interface DispatchStrategy {
  readonly name: string;
  rank(input: {
    orderId: string;
    pickup: GeoPoint;
    candidates: DriverCandidate[];
  }): Promise<DriverCandidate[]>;
}

/** Grouping several orders into one rider run. Not implemented in this phase. */
export interface BatchingStrategy {
  readonly name: string;
  batch(orderIds: string[]): Promise<string[][]>;
}

/** Surge / distance pricing. Kartogo currently uses the flat ₹25 logistics fee. */
export interface PricingEngine {
  readonly name: string;
  quote(input: { distanceMeters: number; at: Date }): Promise<{ amount: number; reason: string | null }>;
}

/** Demand prediction + heat maps. Reserved for the AI ops module. */
export interface DemandForecaster {
  readonly name: string;
  heatmap(at: Date): Promise<{ point: GeoPoint; weight: number }[]>;
}

export interface LogisticsCapabilities {
  geoIndex?: GeoIndex;
  dispatch?: DispatchStrategy;
  batching?: BatchingStrategy;
  pricing?: PricingEngine;
  forecaster?: DemandForecaster;
}

/** Single mutable registry — a later phase registers real implementations. */
export const logisticsCapabilities: LogisticsCapabilities = {};

export function registerLogisticsCapability<K extends keyof LogisticsCapabilities>(
  key: K,
  impl: NonNullable<LogisticsCapabilities[K]>,
) {
  logisticsCapabilities[key] = impl;
}
