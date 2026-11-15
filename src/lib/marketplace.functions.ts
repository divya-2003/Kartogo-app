import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Marketplace (services, bookings, events, quotes, scheduled product orders).
// Public catalog reads go through the service client but only return active rows.
// Customer-owned data (bookings, favourites) is scoped by the signed customer token.

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // New tables are not yet in the generated types.
  return supabaseAdmin as unknown as { from: (t: string) => any };
}
async function customer(token?: string) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  return verifyCustomerToken(token);
}

const PARTNER_LITE = "id,name,slug,icon,rating,distance_km,partner_type";
/** Seller login numbers and admin-only fields never leave the server on public reads. */
function pub<T extends Record<string, any> | null | undefined>(p: T): T {
  if (!p) return p;
  const { supplier_phone: _a, account_status: _b, booking_mode: _c, ...rest } = p as Record<string, any>;
  return rest as T;
}
const pubAll = (rows: any[] | null | undefined) => (rows ?? []).map(r => pub(r));

export const listMpCategoriesFn = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: cats }, { data: sections }] = await Promise.all([
    s.from("mp_categories").select("*").eq("is_active", true).order("sort"),
    s.from("mp_home_sections").select("*").order("sort"),
  ]);
  return { categories: cats ?? [], sections: sections ?? [] };
});

export const listCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: category } = await s.from("mp_categories").select("*").eq("slug", data.slug).eq("is_active", true).maybeSingle();
    if (!category) return { category: null, listings: [], partners: [] };
    const [{ data: listings }, { data: partners }] = await Promise.all([
      s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("category_slug", data.slug).eq("is_active", true),
      s.from("mp_partners").select("*").contains("category_slugs", [data.slug]).eq("is_active", true),
    ]);
    return { category, listings: listings ?? [], partners: pubAll(partners) };
  });

export const homeMarketplaceFn = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: trending }, { data: fresh }, { data: stores }] = await Promise.all([
    s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).neq("transaction_type", "PRODUCT_ORDER").order("review_count", { ascending: false }).limit(8),
    s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).order("created_at", { ascending: false }).limit(8),
    s.from("mp_partners").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(8),
  ]);
  return { trending: trending ?? [], fresh: fresh ?? [], stores: pubAll(stores) };
});

export const getPartnerFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const col = /^[0-9a-f-]{36}$/.test(data.id) ? "id" : "slug";
    const { data: partner } = await s.from("mp_partners").select("*").eq(col, data.id).eq("is_active", true).maybeSingle();
    if (!partner) return null;
    const [{ data: listings }, { data: reviews }, { data: staff }] = await Promise.all([
      s.from("mp_listings").select("*").eq("partner_id", partner.id).eq("is_active", true),
      s.from("mp_reviews").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(20),
      s.from("mp_staff").select("id,name,title,photo_url,rating").eq("partner_id", partner.id).eq("is_active", true),
    ]);
    return { partner: pub(partner), listings: listings ?? [], reviews: reviews ?? [], staff: staff ?? [] };
  });

export const getListingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const { data: listing } = await s.from("mp_listings").select("*, partner:mp_partners(*)").eq("id", data.id).eq("is_active", true).maybeSingle();
    if (!listing) return null;
    const [{ data: siblings }, { data: reviews }] = await Promise.all([
      s.from("mp_listings").select("*").eq("partner_id", listing.partner_id).eq("is_active", true).neq("id", listing.id).limit(10),
      s.from("mp_reviews").select("*").or(`listing_id.eq.${listing.id},partner_id.eq.${listing.partner_id}`).limit(10),
    ]);
    return { listing: { ...listing, partner: pub(listing.partner) }, siblings: siblings ?? [], reviews: reviews ?? [] };
  });

// ---------- availability ----------
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function computeSlots(listingId: string, date: string) {
  const s = await db();
  const { data: l } = await s.from("mp_listings").select("id,partner_id,duration_min,attributes, partner:mp_partners(account_status)").eq("id", listingId).maybeSingle();
  if (!l || l.partner?.account_status === "SUSPENDED") return { slots: [], staff: [] };
  const dur = l.duration_min || 60;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const days = (l.attributes as any)?.available_days;
  if (Array.isArray(days) && days.length && !days.includes(weekday)) return { slots: [], staff: [], duration: dur };
  const { data: staffAll } = await s.from("mp_staff").select("id,name,title,rating,photo_url,off_weekdays,off_dates,service_ids,work_start,work_end").eq("partner_id", l.partner_id).eq("is_active", true);
  // Professionals on leave, or not assigned to this service, aren't offered.
  const staff = ((staffAll ?? []) as any[]).filter(st => !(st.off_weekdays ?? []).includes(weekday) && !(st.off_dates ?? []).includes(date)
    && (!(st.service_ids ?? []).length || (st.service_ids ?? []).includes(l.id)));
  if (!staff.length) return { slots: [], staff: [], duration: dur };
  // Shared appointment engine: business hours, breaks, holidays, buffer, capacity and professional overlap.
  const { appointmentSlots } = await import("./studio.server");
  const r = await appointmentSlots(l.partner_id, date, { durationMin: dur, staffIds: staff.map(st => st.id) });
  const within = (st: any, t: number) => (!st.work_start || toMin(st.work_start) <= t) && (!st.work_end || t + dur <= toMin(st.work_end));
  const slots = r.slots.map(x => ({ time: x.time, staffIds: x.staffIds.filter(id => within(staff.find(st => st.id === id), toMin(x.time))) })).filter(x => x.staffIds.length);
  const publicStaff = staff.map(({ service_ids: _a, work_start: _b, work_end: _c, ...rest }) => rest);
  return { slots, staff: publicStaff, duration: dur };
}

export const getAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => computeSlots(data.listingId, data.date));

// ---------- bookings ----------
const bookingSchema = z.object({
  token: z.string().min(10),
  listingId: z.string().uuid(),
  serviceMode: z.enum(["AT_SALON", "HOME_SERVICE"]).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  address: z.object({ line: z.string().max(300), landmark: z.string().max(200).optional() }).nullable().optional(),
  packageName: z.string().max(60).nullable().optional(),
  details: z.record(z.string(), z.union([z.string().max(1000), z.number(), z.boolean()])).optional(),
  /** Furniture/electronics: book a showroom appointment instead of a delivery. */
  storeVisit: z.boolean().optional(),
  customerName: z.string().max(80).optional(),
  /** Partner Studio appointment engine. */
  appointmentType: z.string().max(60).optional(),
  customerNotes: z.string().max(500).optional(),
  atCustomer: z.boolean().optional(),

});

function code() { return "KB" + Math.random().toString(36).slice(2, 8).toUpperCase(); }

export const createBookingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false as const, error: "Please login to book." };
    const s = await db();
    const { data: l } = await s.from("mp_listings").select("*").eq("id", data.listingId).eq("is_active", true).maybeSingle();
    if (!l) return { ok: false as const, error: "This listing is no longer available." };
    const { data: owner } = await s.from("mp_partners").select("id,name,partner_type,category_slugs,booking_mode,account_status,opens_at,closes_at,weekly_off").eq("id", l.partner_id).maybeSingle();
    if (!owner || owner.account_status === "SUSPENDED") return { ok: false as const, error: "This business isn't taking bookings right now." };
    const studio = await import("./studio.server");
    const { initialStatusFor, CUSTOMER_LOCATION_TYPES } = await import("./studio");
    const tx = l.transaction_type as string;
    let staffId: string | null = null, start: string | null = null, end: string | null = null, amount = 0, fee = 0;
    const mode = tx === "HOME_SERVICE_BOOKING" ? "HOME_SERVICE" : (data.serviceMode ?? null);
    if (mode && l.service_modes?.length && !l.service_modes.includes(mode)) return { ok: false as const, error: "This service mode isn't offered." };
    const storeVisit = tx === "PRODUCT_ORDER" && data.storeVisit === true;
    const atCustomer = storeVisit && data.atCustomer === true;
    if (atCustomer && !data.address?.line?.trim()) return { ok: false as const, error: "Please add the address for the home visit." };
    if (!storeVisit && (mode === "HOME_SERVICE" || tx === "EVENT_BOOKING" || tx === "QUOTE_REQUEST" || tx === "PRODUCT_ORDER") && !data.address?.line?.trim())
      return { ok: false as const, error: "Please add an address." };



    if (tx === "SERVICE_BOOKING" || tx === "HOME_SERVICE_BOOKING") {
      if (!data.date || !data.time) return { ok: false as const, error: "Choose a date and time." };
      const { slots } = await computeSlots(l.id, data.date);
      const slot = slots.find(x => x.time === data.time);
      if (!slot) return { ok: false as const, error: "That time was just taken. Please pick another slot." };
      staffId = data.staffId ? (slot.staffIds.includes(data.staffId) ? data.staffId : null) : slot.staffIds[0];
      if (!staffId) return { ok: false as const, error: "That professional is no longer free at this time." };
      start = data.time;
      end = toTime(toMin(data.time) + (l.duration_min || 60));
      amount = Number(l.price ?? l.starting_price ?? 0);
      fee = mode === "HOME_SERVICE" ? Number(l.home_service_fee || 0) : 0;
    } else if (tx === "EVENT_BOOKING") {
      if (!data.date) return { ok: false as const, error: "Choose the event date." };
      const pkg = (l.packages ?? []).find((p: any) => p.name === data.packageName);
      amount = Number(pkg?.price ?? l.starting_price ?? 0);
      start = data.time ?? null;
    } else if (tx === "QUOTE_REQUEST") {
      if (!data.date) return { ok: false as const, error: "Choose the event date." };
    } else if (tx === "PRODUCT_ORDER") {
      if (!data.date) return { ok: false as const, error: storeVisit ? "Choose a visit date." : "Choose a delivery date." };
      if (storeVisit) {
        if (!data.time) return { ok: false as const, error: "Choose a visit time." };
        const { slots: free, settings: st } = await studio.appointmentSlots(l.partner_id, data.date, {});
        if (!free.some(x => x.time === data.time)) return { ok: false as const, error: "That time was just taken. Please pick another slot." };
        if (st && atCustomer && !st.allow_customer_location) return { ok: false as const, error: "This store doesn't visit homes. Please book a showroom visit." };
        start = data.time;
        end = studio.endTimeFor(data.time, st?.slot_minutes ?? 30);
      } else {
        const qty = Math.max(1, Math.min(5, Number(data.details?.quantity ?? 1)));
        if (l.stock_qty != null && Number(l.stock_qty) < qty) return { ok: false as const, error: Number(l.stock_qty) <= 0 ? "This product is out of stock." : `Only ${l.stock_qty} left in stock.` };
        amount = Number(l.price ?? 0) * qty;
      }
    }


    const { data: cust } = await s.from("customers").select("name").eq("phone", session.phone).maybeSingle();
    // Appointment engine: business booking mode decides whether it's confirmed straight away.
    const isAppointment = storeVisit || tx === "SERVICE_BOOKING" || tx === "HOME_SERVICE_BOOKING";
    const bookingMode = isAppointment ? await studio.bookingModeFor(s as any, owner) : "SELLER_APPROVAL";
    const types = isAppointment ? await studio.appointmentTypesFor(s as any, owner) : [];
    let apptType: string | null = null;
    if (isAppointment) {
      apptType = data.appointmentType && types.includes(data.appointmentType) ? data.appointmentType
        : storeVisit ? (types.find(t => t === "Showroom Visit") ?? types[0] ?? "Showroom Visit")
        : (mode === "HOME_SERVICE" ? types.find(t => t === "Home Service") : null) ?? types[0] ?? null;
      if (storeVisit && apptType && CUSTOMER_LOCATION_TYPES.includes(apptType) !== atCustomer)
        return { ok: false as const, error: atCustomer ? "Choose Home Measurement for a visit at your place." : "Add your address for a home visit." };
    }
    const engineStatus = isAppointment ? initialStatusFor(bookingMode) : "PENDING";
    const legacyStatus = engineStatus === "CONFIRMED" ? "PROVIDER_CONFIRMED" : "BOOKING_REQUESTED";
    const row = {
      booking_code: code(), customer_phone: session.phone, customer_name: cust?.name ?? data.customerName ?? null,
      partner_id: l.partner_id, listing_id: l.id, transaction_type: tx, service_mode: mode, staff_id: staffId,
      booking_date: data.date ?? null, start_time: start, end_time: end, address: storeVisit ? null : (data.address ?? null),
      details: { ...(data.details ?? {}), package: storeVisit ? (apptType ?? "Showroom visit") : (data.packageName ?? null), store_visit: storeVisit && !atCustomer, booking_mode: bookingMode }, amount, fee,
      status: legacyStatus, appointment_status: engineStatus, appointment_type: apptType,
      location_type: mode === "HOME_SERVICE" || atCustomer || (tx === "PRODUCT_ORDER" && !storeVisit) || tx === "EVENT_BOOKING" ? "CUSTOMER" : "BUSINESS",
      customer_notes: data.customerNotes?.trim() || null,
    };
    if (atCustomer) row.address = data.address ?? null;
    const { data: ins, error } = await s.from("mp_bookings").insert(row).select("id,booking_code").single();
    if (error) {
      if (String(error.code) === "23505") return { ok: false as const, error: "That slot was just booked. Please pick another time." };
      console.error("createBooking", error);
      return { ok: false as const, error: "Couldn't place the booking. Please try again." };
    }
    // Furniture stock is taken atomically; a sold-out race cancels the order cleanly.
    if (tx === "PRODUCT_ORDER" && !storeVisit && l.stock_qty != null) {
      const qty = Math.max(1, Math.min(5, Number(data.details?.quantity ?? 1)));
      const { data: after, error: stockErr } = await (s as any).rpc("mp_take_stock", { p_listing: l.id, p_qty: qty, p_booking: ins.id });
      if (stockErr) {
        await s.from("mp_bookings").update({ status: "CANCELLED", seller_notes: "Sold out before the order completed" }).eq("id", ins.id);
        return { ok: false as const, error: "Sorry, this product just sold out." };
      }
      await s.from("mp_bookings").update({ details: { ...row.details, stock_taken: qty } }).eq("id", ins.id);
      if (after != null && Number(after) <= Number(l.low_stock_threshold ?? 3)) {
        const { data: pp } = await s.from("mp_partners").select("supplier_phone").eq("id", l.partner_id).maybeSingle();
        await studio.notifySeller(pp?.supplier_phone, { type: "PARTNER_LOW_STOCK", refId: l.id, body: Number(after) <= 0 ? `${l.name} is now out of stock.` : `${l.name} is low on stock (${after} left).` });
      }
    }
    await s.from("mp_booking_status_history").insert({ booking_id: ins.id, status: legacyStatus, note: engineStatus === "CONFIRMED" ? "Booked and confirmed instantly" : "Booking placed by customer" });
    const push = (await import("./booking-push.server")).pushBookingEvent;
    await push(ins.id as string, "placed", { phone: session.phone, partnerId: l.partner_id as string, listingName: l.name as string, code: ins.booking_code as string });
    if (engineStatus === "CONFIRMED") await push(ins.id as string, "confirmed", { phone: session.phone, partnerId: l.partner_id as string, listingName: l.name as string, code: ins.booking_code as string });
    return { ok: true as const, id: ins.id as string, code: ins.booking_code as string };
  });

const BOOKING_SELECT = "*, partner:mp_partners(name,icon,address), listing:mp_listings(name,icon), staff:mp_staff(name,rating,title)";

export const myBookingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return [];
    const s = await db();
    const { data: rows } = await s.from("mp_bookings").select(BOOKING_SELECT).eq("customer_phone", session.phone).order("created_at", { ascending: false }).limit(100);
    return rows ?? [];
  });

export const getBookingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().optional(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return null;
    const s = await db();
    const { data: b } = await s.from("mp_bookings").select(BOOKING_SELECT).eq("id", data.id).eq("customer_phone", session.phone).maybeSingle();
    if (!b) return null;
    const { data: history } = await s.from("mp_booking_status_history").select("status,note,created_at").eq("booking_id", b.id).order("created_at");
    return { ...b, history: history ?? [] };
  });

export const cancelBookingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false, error: "Please login." };
    const s = await db();
    const { data: b } = await s.from("mp_bookings").select("id,status").eq("id", data.id).eq("customer_phone", session.phone).maybeSingle();
    if (!b) return { ok: false, error: "Booking not found." };
    if (!["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "PROFESSIONAL_ASSIGNED", "QUOTE_SENT"].includes(b.status))
      return { ok: false, error: "This booking can no longer be cancelled." };
    await s.from("mp_bookings").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", b.id);
    await s.from("mp_booking_status_history").insert({ booking_id: b.id, status: "CANCELLED", note: "Cancelled by customer" });
    await (await import("./booking-push.server")).pushBookingEvent(b.id, "cancelled_by_customer");
    return { ok: true };
  });

// ---------- admin ----------
const ADMIN_STATUSES = ["BOOKING_REQUESTED", "PROVIDER_CONFIRMED", "PROFESSIONAL_ASSIGNED", "PROFESSIONAL_TRAVELLING", "ARRIVED", "SERVICE_STARTED", "SERVICE_COMPLETED", "QUOTE_SENT", "CANCELLED"] as const;

export const adminListBookingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return [];
    const s = await db();
    const { data: rows } = await s.from("mp_bookings").select(BOOKING_SELECT).order("created_at", { ascending: false }).limit(200);
    return rows ?? [];
  });

export const adminUpdateBookingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string(), id: z.string().uuid(), status: z.enum(ADMIN_STATUSES),
    quoteAmount: z.number().min(0).max(10_000_000).optional(), quoteNote: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return { ok: false };
    const s = await db();
    const patch: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.quoteAmount != null) { patch.quote_amount = data.quoteAmount; patch.amount = data.quoteAmount; }
    if (data.quoteNote) patch.quote_note = data.quoteNote;
    await s.from("mp_bookings").update(patch).eq("id", data.id);
    await s.from("mp_booking_status_history").insert({ booking_id: data.id, status: data.status, note: data.quoteNote ?? "Updated by Kartogo" });
    if (data.status === "CANCELLED") await (await import("./booking-push.server")).pushBookingEvent(data.id, "cancelled");
    else if (data.status === "PROVIDER_CONFIRMED") await (await import("./booking-push.server")).pushBookingEvent(data.id, "confirmed");
    return { ok: true };
  });

// ---------- favourites ----------
const FAV_TYPES = ["product", "store", "service", "salon", "furniture", "event_provider", "home_service_provider", "listing", "partner"] as const;

export const myFavoritesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { listings: [], partners: [], keys: [] as string[] };
    const s = await db();
    const { data: favs } = await s.from("mp_favorites").select("entity_type,entity_id").eq("customer_phone", session.phone);
    const lIds = (favs ?? []).filter((f: any) => f.entity_type === "listing").map((f: any) => f.entity_id);
    const pIds = (favs ?? []).filter((f: any) => f.entity_type === "partner").map((f: any) => f.entity_id);
    const [{ data: listings }, { data: partners }] = await Promise.all([
      lIds.length ? s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).in("id", lIds) : Promise.resolve({ data: [] }),
      pIds.length ? s.from("mp_partners").select("*").in("id", pIds) : Promise.resolve({ data: [] }),
    ]);
    return { listings: listings ?? [], partners: pubAll(partners), keys: (favs ?? []).map((f: any) => `${f.entity_type}:${f.entity_id}`) };
  });

export const toggleFavoriteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), type: z.enum(FAV_TYPES), id: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const session = await customer(data.token);
    if (!session) return { ok: false, saved: false };
    const s = await db();
    const { data: ex } = await s.from("mp_favorites").select("id").eq("customer_phone", session.phone).eq("entity_type", data.type).eq("entity_id", data.id).maybeSingle();
    if (ex) { await s.from("mp_favorites").delete().eq("id", ex.id); return { ok: true, saved: false }; }
    await s.from("mp_favorites").insert({ customer_phone: session.phone, entity_type: data.type, entity_id: data.id });
    return { ok: true, saved: true };
  });

// ---------- search ----------
export const searchMarketplaceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    const q = data.q.trim().replace(/[%,()]/g, " ");
    if (q.length < 2) return { listings: [], partners: [] };
    const s = await db();
    const like = `%${q}%`;
    const [{ data: listings }, { data: partners }, { data: cats }] = await Promise.all([
      s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).or(`name.ilike.${like},description.ilike.${like},category_slug.ilike.${like}`).limit(20),
      s.from("mp_partners").select("*").eq("is_active", true).or(`name.ilike.${like},description.ilike.${like}`).limit(10),
      s.from("mp_categories").select("slug").eq("is_active", true).ilike("name", like),
    ]);
    let extra: any[] = [];
    const slugs = (cats ?? []).map((c: any) => c.slug);
    if (slugs.length) {
      const { data: byCat } = await s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).in("category_slug", slugs).limit(20);
      extra = byCat ?? [];
    }
    const seen = new Set<string>();
    const merged = [...(listings ?? []), ...extra].filter((l: any) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
    return { listings: merged, partners: partners ?? [] };
  });
