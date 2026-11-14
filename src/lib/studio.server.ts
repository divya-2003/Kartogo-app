// Server-only Partner Studio helpers shared by the seller, customer and admin
// server functions. Every seller call resolves the business from the signed
// seller token (mp_partners.supplier_phone), never from client input alone.
import {
  canUse, defaultSettings, generateSlots, studioKindOf, toMin, toTime,
  type AvailabilitySettings, type BookingMode, type StudioKind, type StudioPage,
} from "./studio";

export type Db = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

export async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export class StudioError extends Error {}

export type StudioPartner = Record<string, any> & { id: string; name: string; kind: StudioKind; supplier_phone: string };

/** Signed seller session (same token as the seller portal). */
export async function sellerSession(token: string) {
  const { verifySupplierToken } = await import("./auth-tokens.server");
  const s = verifySupplierToken(token);
  if (!s) throw new StudioError("Your session has expired. Please sign in again.");
  return s;
}

/** Every Studio business this seller owns. */
export async function ownedStudioPartners(phone: string): Promise<StudioPartner[]> {
  const d = await db();
  const { data } = await d.from("mp_partners").select("*").eq("supplier_phone", phone).order("name");
  return ((data ?? []) as any[])
    .map(p => ({ ...p, kind: studioKindOf(p) }))
    .filter((p): p is StudioPartner => p.kind !== null);
}

/**
 * Resolves the seller's business and enforces category-based access:
 * a service provider asking for an inventory page is refused here, on the server.
 */
export async function requireStudio(token: string, opts: { partnerId?: string | null; page?: StudioPage; write?: boolean } = {}) {
  const s = await sellerSession(token);
  const partners = await ownedStudioPartners(s.phone);
  if (!partners.length) throw new StudioError("No Partner Studio business is linked to this number.");
  const partner = opts.partnerId ? partners.find(p => p.id === opts.partnerId) : partners[0];
  if (!partner) throw new StudioError("You can only manage your own business.");
  if (opts.page && !canUse(partner.kind, opts.page)) throw new StudioError("This section isn't available for your business type.");
  if (opts.write && partner.account_status === "SUSPENDED") throw new StudioError("Your account is suspended. Please contact Kartogo support.");
  return { session: s, partner, partners, d: await db() };
}

export async function bookingModeFor(d: Db, partner: { booking_mode?: string | null; category_slugs?: string[] | null }): Promise<BookingMode> {
  if (partner.booking_mode) return partner.booking_mode as BookingMode;
  const slugs = partner.category_slugs ?? [];
  if (slugs.length) {
    const { data } = await d.from("mp_categories").select("booking_mode").in("slug", slugs);
    const modes = ((data ?? []) as any[]).map(r => r.booking_mode as BookingMode);
    // The strictest applicable mode wins so nothing is confirmed automatically by accident.
    if (modes.includes("BOOKING_REQUEST")) return "BOOKING_REQUEST";
    if (modes.includes("SELLER_APPROVAL")) return "SELLER_APPROVAL";
    if (modes.includes("INSTANT")) return "INSTANT";
  }
  return "SELLER_APPROVAL";
}

export async function appointmentTypesFor(d: Db, partner: { category_slugs?: string[] | null; partner_type?: string | null }): Promise<string[]> {
  const { FURNITURE_APPOINTMENT_TYPES, SERVICE_APPOINTMENT_TYPES } = await import("./studio");
  const slugs = partner.category_slugs ?? [];
  if (slugs.length) {
    const { data } = await d.from("mp_categories").select("appointment_types").in("slug", slugs);
    const list = Array.from(new Set(((data ?? []) as any[]).flatMap(r => (r.appointment_types ?? []) as string[])));
    if (list.length) return list;
  }
  return studioKindOf(partner) === "furniture" ? FURNITURE_APPOINTMENT_TYPES : SERVICE_APPOINTMENT_TYPES;
}

/** Saved availability, falling back to the business's opening hours. */
export async function settingsFor(d: Db, partner: { id: string; opens_at?: string | null; closes_at?: string | null; weekly_off?: number[] | null }): Promise<{ settings: AvailabilitySettings; saved: boolean }> {
  const { data } = await d.from("mp_appointment_settings").select("*").eq("partner_id", partner.id).maybeSingle();
  const base = defaultSettings(partner.opens_at ?? "10:00", partner.closes_at ?? "20:00", partner.weekly_off ?? []);
  if (!data) return { settings: base, saved: false };
  return {
    saved: true,
    settings: {
      working_hours: Array.isArray(data.working_hours) && data.working_hours.length === 7 ? data.working_hours : base.working_hours,
      slot_minutes: data.slot_minutes, buffer_minutes: data.buffer_minutes, max_per_slot: data.max_per_slot,
      breaks: Array.isArray(data.breaks) ? data.breaks : [], date_overrides: data.date_overrides ?? {},
      paused_from: data.paused_from, paused_until: data.paused_until,
      allow_business_location: data.allow_business_location, allow_customer_location: data.allow_customer_location,
    },
  };
}

const istNow = () => new Date(Date.now() + 5.5 * 3600_000);
export const todayIst = () => istNow().toISOString().slice(0, 10);

/** Free appointment times for a business on a date (shared by customers and sellers). */
export async function appointmentSlots(partnerId: string, date: string, opts: { durationMin?: number | null; staffIds?: string[]; ignoreBookingId?: string } = {}) {
  const d = await db();
  const { data: partner } = await d.from("mp_partners").select("id,opens_at,closes_at,weekly_off,closed_dates").eq("id", partnerId).maybeSingle();
  if (!partner) return { slots: [], settings: null };
  const { settings } = await settingsFor(d, partner);
  const { data: booked } = await d.from("mp_bookings").select("id,start_time,end_time,staff_id")
    .eq("partner_id", partnerId).eq("booking_date", date).in("appointment_status", ["PENDING", "CONFIRMED", "RESCHEDULED"]).not("start_time", "is", null);
  const now = istNow();
  const notBefore = date === todayIst() ? now.getUTCHours() * 60 + now.getUTCMinutes() + 30 : undefined;
  const slots = generateSlots({
    date, settings, holidays: partner.closed_dates ?? [], durationMin: opts.durationMin,
    booked: ((booked ?? []) as any[]).filter(b => b.id !== opts.ignoreBookingId).map(b => ({ start: b.start_time, end: b.end_time, staffId: b.staff_id })),
    staffIds: opts.staffIds, notBefore,
  });
  return { slots, settings };
}

export const endTimeFor = (start: string, minutes: number) => toTime(toMin(start) + minutes);

/** Best-effort push + history row to the seller (never throws). */
export async function notifySeller(phone: string | null | undefined, input: { type: import("./push.server").NotificationType; body: string; refId?: string | null; path?: string }) {
  if (!phone) return;
  const { safePush } = await import("./push.server");
  await safePush({ phone, type: input.type, orderId: input.refId ?? null, body: input.body, path: input.path });
}
export async function notifyCustomer(phone: string | null | undefined, input: { type: import("./push.server").NotificationType; body: string; refId?: string | null; path?: string }) {
  if (!phone) return;
  const { safePush } = await import("./push.server");
  await safePush({ phone, type: input.type, orderId: input.refId ?? null, body: input.body, path: input.path });
}

/** Turns StudioError into a friendly result and hides anything else. */
export async function studioResult<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof StudioError) return { ok: false, error: e.message };
    console.error("[studio]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
