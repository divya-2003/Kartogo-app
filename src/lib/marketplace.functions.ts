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
    return { category, listings: listings ?? [], partners: partners ?? [] };
  });

export const homeMarketplaceFn = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  const [{ data: trending }, { data: fresh }, { data: stores }] = await Promise.all([
    s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).neq("transaction_type", "PRODUCT_ORDER").order("review_count", { ascending: false }).limit(8),
    s.from("mp_listings").select(`*, partner:mp_partners(${PARTNER_LITE})`).eq("is_active", true).order("created_at", { ascending: false }).limit(8),
    s.from("mp_partners").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(8),
  ]);
  return { trending: trending ?? [], fresh: fresh ?? [], stores: stores ?? [] };
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
    return { partner, listings: listings ?? [], reviews: reviews ?? [], staff: staff ?? [] };
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
    return { listing, siblings: siblings ?? [], reviews: reviews ?? [] };
  });

// ---------- availability ----------
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function computeSlots(listingId: string, date: string) {
  const s = await db();
  const { data: l } = await s.from("mp_listings").select("id,partner_id,duration_min, partner:mp_partners(opens_at,closes_at)").eq("id", listingId).maybeSingle();
  if (!l) return { slots: [], staff: [] };
  const dur = l.duration_min || 60;
  const open = toMin(l.partner?.opens_at ?? "09:00");
  const close = toMin(l.partner?.closes_at ?? "20:00");
  const [{ data: staff }, { data: booked }] = await Promise.all([
    s.from("mp_staff").select("id,name,title,rating,photo_url").eq("partner_id", l.partner_id).eq("is_active", true),
    s.from("mp_bookings").select("staff_id,start_time,end_time").eq("partner_id", l.partner_id).eq("booking_date", date).neq("status", "CANCELLED"),
  ]);
  // Customer timezone is IST; hide past slots for today.
  const nowIst = new Date(Date.now() + 5.5 * 3600_000);
  const todayIst = nowIst.toISOString().slice(0, 10);
  const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes() + 30;
  const slots: { time: string; staffIds: string[] }[] = [];
  for (let t = open; t + dur <= close; t += 30) {
    if (date === todayIst && t < nowMin) continue;
    const free = (staff ?? []).filter((st: any) => !(booked ?? []).some((b: any) =>
      b.staff_id === st.id && toMin(b.start_time) < t + dur && toMin(b.end_time ?? b.start_time) > t));
    if (free.length) slots.push({ time: toTime(t), staffIds: free.map((f: any) => f.id) });
  }
  return { slots, staff: staff ?? [], duration: dur };
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
  customerName: z.string().max(80).optional(),
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
    const tx = l.transaction_type as string;
    let staffId: string | null = null, start: string | null = null, end: string | null = null, amount = 0, fee = 0;
    const mode = tx === "HOME_SERVICE_BOOKING" ? "HOME_SERVICE" : (data.serviceMode ?? null);
    if (mode && l.service_modes?.length && !l.service_modes.includes(mode)) return { ok: false as const, error: "This service mode isn't offered." };
    if ((mode === "HOME_SERVICE" || tx === "EVENT_BOOKING" || tx === "QUOTE_REQUEST" || tx === "PRODUCT_ORDER") && !data.address?.line?.trim())
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
      if (!data.date) return { ok: false as const, error: "Choose a delivery date." };
      const qty = Math.max(1, Math.min(5, Number(data.details?.quantity ?? 1)));
      amount = Number(l.price ?? 0) * qty;
    }

    const { data: cust } = await s.from("customers").select("name").eq("phone", session.phone).maybeSingle();
    const row = {
      booking_code: code(), customer_phone: session.phone, customer_name: cust?.name ?? data.customerName ?? null,
      partner_id: l.partner_id, listing_id: l.id, transaction_type: tx, service_mode: mode, staff_id: staffId,
      booking_date: data.date ?? null, start_time: start, end_time: end, address: data.address ?? null,
      details: { ...(data.details ?? {}), package: data.packageName ?? null }, amount, fee,
      status: "BOOKING_REQUESTED",
    };
    const { data: ins, error } = await s.from("mp_bookings").insert(row).select("id,booking_code").single();
    if (error) {
      if (String(error.code) === "23505") return { ok: false as const, error: "That slot was just booked. Please pick another time." };
      console.error("createBooking", error);
      return { ok: false as const, error: "Couldn't place the booking. Please try again." };
    }
    await s.from("mp_booking_status_history").insert({ booking_id: ins.id, status: "BOOKING_REQUESTED", note: "Booking placed by customer" });
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
    return { listings: listings ?? [], partners: partners ?? [], keys: (favs ?? []).map((f: any) => `${f.entity_type}:${f.entity_id}`) };
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
