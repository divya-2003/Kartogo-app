// Browser-safe Partner Studio rules shared by the seller dashboards, the
// customer booking flow and the server. No server-only imports here.

export type StudioKind = "furniture" | "service";
export type BookingMode = "INSTANT" | "SELLER_APPROVAL" | "BOOKING_REQUEST";
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export type AppointmentAction = "ACCEPT" | "REJECT" | "CONFIRM" | "RESCHEDULE" | "CANCEL" | "COMPLETE" | "NO_SHOW";
export type EnquiryStatus = "NEW" | "RESPONDED" | "IN_PROGRESS" | "CONVERTED" | "CLOSED";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "REJECTED", "RESCHEDULED", "CANCELLED", "COMPLETED", "NO_SHOW"];
export const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "RESCHEDULED"];
export const ENQUIRY_STATUSES: EnquiryStatus[] = ["NEW", "RESPONDED", "IN_PROGRESS", "CONVERTED", "CLOSED"];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", REJECTED: "Rejected", RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "No-show",
};
export const ENQUIRY_LABEL: Record<EnquiryStatus, string> = {
  NEW: "New", RESPONDED: "Responded", IN_PROGRESS: "In progress", CONVERTED: "Converted to appointment", CLOSED: "Closed",
};
export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  INSTANT: "Instant booking", SELLER_APPROVAL: "Seller approval", BOOKING_REQUEST: "Booking request",
};

export const FURNITURE_APPOINTMENT_TYPES = ["Showroom Visit", "Product Demonstration", "Product Consultation", "Home Measurement", "Installation Consultation", "Assembly Consultation"];
export const SERVICE_APPOINTMENT_TYPES = ["Salon Booking", "Beauty Appointment", "Makeup Appointment", "Home Service", "Professional Consultation"];
/** Appointment types that happen at the customer's place. */
export const CUSTOMER_LOCATION_TYPES = ["Home Measurement", "Home Service"];

/** Which Studio experience a business gets. Retailers keep the regular seller portal. */
export function studioKindOf(p: { partner_type?: string | null; category_slugs?: string[] | null }): StudioKind | null {
  const t = String(p.partner_type ?? "").toUpperCase();
  if (t === "FURNITURE_SELLER" || (p.category_slugs ?? []).includes("furniture")) return "furniture";
  if (t === "RETAILER") return null;
  return "service";
}

export type StudioPage =
  | "overview" | "inventory" | "services" | "appointments" | "availability" | "enquiries" | "professionals"
  | "customers" | "notifications" | "reviews" | "reports" | "profile" | "settings";

const FURNITURE_PAGES: StudioPage[] = ["overview", "inventory", "appointments", "enquiries", "customers", "notifications", "reviews", "reports", "profile", "settings", "professionals"];
const SERVICE_PAGES: StudioPage[] = ["overview", "services", "appointments", "availability", "professionals", "customers", "notifications", "reviews", "reports", "profile", "settings"];

/** Pages a business kind may open. The server enforces the same rule for every write. */
export function studioPages(kind: StudioKind): StudioPage[] {
  return kind === "furniture" ? FURNITURE_PAGES : SERVICE_PAGES;
}
export function canUse(kind: StudioKind, page: StudioPage): boolean {
  return studioPages(kind).includes(page);
}

/** Which actions a seller may take on an appointment in a given state. */
export function allowedActions(status: AppointmentStatus): AppointmentAction[] {
  switch (status) {
    case "PENDING": return ["ACCEPT", "REJECT", "RESCHEDULE", "CANCEL"];
    case "RESCHEDULED": return ["CONFIRM", "RESCHEDULE", "CANCEL"];
    case "CONFIRMED": return ["RESCHEDULE", "CANCEL", "COMPLETE", "NO_SHOW"];
    default: return [];
  }
}
export function nextStatus(action: AppointmentAction): AppointmentStatus {
  return ({ ACCEPT: "CONFIRMED", CONFIRM: "CONFIRMED", REJECT: "REJECTED", RESCHEDULE: "RESCHEDULED", CANCEL: "CANCELLED", COMPLETE: "COMPLETED", NO_SHOW: "NO_SHOW" } as const)[action];
}
/** Legacy customer-facing booking status kept in step with the engine status. */
export function legacyStatusFor(s: AppointmentStatus, current: string): string {
  if (s === "CONFIRMED") return ["BOOKING_REQUESTED", "QUOTE_SENT"].includes(current) ? "PROVIDER_CONFIRMED" : current;
  if (s === "COMPLETED") return "SERVICE_COMPLETED";
  if (s === "REJECTED" || s === "CANCELLED" || s === "NO_SHOW") return "CANCELLED";
  return current; // PENDING / RESCHEDULED keep the customer's current step
}
/** Status a new booking starts in for the business's booking mode. */
export function initialStatusFor(mode: BookingMode): AppointmentStatus {
  return mode === "INSTANT" ? "CONFIRMED" : "PENDING";
}

export type StockState = "untracked" | "out" | "low" | "in";
export function stockState(qty: number | null | undefined, threshold = 3): StockState {
  if (qty == null) return "untracked";
  if (qty <= 0) return "out";
  if (qty <= threshold) return "low";
  return "in";
}

// ---------------- slot engine ----------------
export type DayHours = { day: number; enabled: boolean; open: string; close: string };
export type Break = { start: string; end: string };
export type DateOverride = { closed?: boolean; open?: string; close?: string; note?: string };
export type AvailabilitySettings = {
  working_hours: DayHours[];
  slot_minutes: number;
  buffer_minutes: number;
  max_per_slot: number;
  breaks: Break[];
  date_overrides: Record<string, DateOverride>;
  paused_from: string | null;
  paused_until: string | null;
  allow_business_location: boolean;
  allow_customer_location: boolean;
};
export type BookedInterval = { start: string; end?: string | null; staffId?: string | null };
export type Slot = { time: string; remaining: number; staffIds: string[] };

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function defaultSettings(opens = "10:00", closes = "20:00", weeklyOff: number[] = []): AvailabilitySettings {
  return {
    working_hours: Array.from({ length: 7 }, (_, day) => ({ day, enabled: !weeklyOff.includes(day), open: opens.slice(0, 5), close: closes.slice(0, 5) })),
    slot_minutes: 30, buffer_minutes: 0, max_per_slot: 1, breaks: [], date_overrides: {},
    paused_from: null, paused_until: null, allow_business_location: true, allow_customer_location: false,
  };
}

/** Opening window for a date, or null when the business is closed that day. */
export function hoursFor(date: string, s: AvailabilitySettings, holidays: string[] = []): { open: number; close: number } | null {
  if (holidays.includes(date)) return null;
  if (s.paused_from && s.paused_until && date >= s.paused_from && date <= s.paused_until) return null;
  const o = s.date_overrides?.[date];
  if (o?.closed) return null;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const d = s.working_hours.find(h => h.day === weekday);
  if (o?.open && o?.close) return { open: toMin(o.open), close: toMin(o.close) };
  if (!d || !d.enabled) return null;
  return { open: toMin(d.open), close: toMin(d.close) };
}

/**
 * Bookable start times for one date. A slot is offered when it fits inside the
 * opening window, avoids breaks, still has capacity (max per slot) and, when
 * professionals are involved, at least one of them is free (with buffer time).
 */
export function generateSlots(input: {
  date: string;
  settings: AvailabilitySettings;
  holidays?: string[];
  durationMin?: number | null;
  booked: BookedInterval[];
  staffIds?: string[];
  /** Minutes since midnight before which no slot is offered (e.g. "now" for today). */
  notBefore?: number;
}): Slot[] {
  const s = input.settings;
  const hours = hoursFor(input.date, s, input.holidays);
  if (!hours) return [];
  const step = Math.max(10, s.slot_minutes || 30);
  const dur = Math.max(step, input.durationMin || step);
  const buf = Math.max(0, s.buffer_minutes || 0);
  const staff = input.staffIds ?? [];
  const out: Slot[] = [];
  for (let t = hours.open; t + dur <= hours.close; t += step) {
    if (input.notBefore != null && t < input.notBefore) continue;
    const end = t + dur;
    if ((s.breaks ?? []).some(b => toMin(b.start) < end && toMin(b.end) > t)) continue;
    const overlapping = input.booked.filter(b => {
      const bs = toMin(b.start);
      const be = b.end ? toMin(b.end) : bs + step;
      return bs < end && be > t;
    });
    const remaining = Math.max(0, (s.max_per_slot || 1) - overlapping.length);
    if (remaining <= 0) continue;
    let freeStaff: string[] = [];
    if (staff.length) {
      freeStaff = staff.filter(id => !input.booked.some(b => {
        if (b.staffId !== id) return false;
        const bs = toMin(b.start);
        const be = b.end ? toMin(b.end) : bs + step;
        return bs < end + buf && be + buf > t;
      }));
      if (!freeStaff.length) continue;
    }
    out.push({ time: toTime(t), remaining, staffIds: freeStaff });
  }
  return out;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const maskPhone = (p?: string | null) => (p ? `••••••${String(p).slice(-4)}` : "—");
