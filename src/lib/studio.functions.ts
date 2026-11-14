import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Partner Studio server functions. Each one re-resolves the seller's business
// from the signed seller token and checks category access on the server
// (requireStudio), so hiding a menu item is never the only protection.

const tok = z.string().min(10);
const pid = z.string().uuid().nullable().optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const img = z.string().max(600_000);

async function S() { return import("./studio.server"); }
async function L() { return import("./studio"); }
const mask = (p?: string | null) => (p ? `••••••${String(p).slice(-4)}` : null);
async function customerKey(partnerId: string, phone: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`${partnerId}:${phone}`).digest("hex").slice(0, 16);
}

// ---------------- session / overview ----------------
export const studioMeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, bookingModeFor, appointmentTypesFor } = await S();
    return studioResult(async () => {
      const { partner, partners, d, session } = await requireStudio(data.token, { partnerId: data.partnerId });
      const [mode, types, unread] = await Promise.all([
        bookingModeFor(d, partner), appointmentTypesFor(d, partner),
        d.from("notifications").select("id", { count: "exact", head: true }).eq("user_phone", session.phone).is("read_at", null),
      ]);
      const { data: cats } = await d.from("mp_categories").select("slug,name").in("slug", partner.category_slugs ?? []);
      return {
        partners: partners.map(p => ({ id: p.id, name: p.name, kind: p.kind, icon: p.icon })),
        partner: {
          id: partner.id, slug: partner.slug, name: partner.name, kind: partner.kind, icon: partner.icon, partner_type: partner.partner_type,
          description: partner.description, address: partner.address, service_area: partner.service_area, photos: partner.photos ?? [],
          logo_url: partner.logo_url, business_phone: partner.business_phone, lat: partner.lat, lng: partner.lng,
          opens_at: partner.opens_at, closes_at: partner.closes_at, weekly_off: partner.weekly_off ?? [], closed_dates: partner.closed_dates ?? [],
          verification_status: partner.verification_status, account_status: partner.account_status, is_active: partner.is_active,
          category_slugs: partner.category_slugs ?? [], categories: (cats ?? []) as { slug: string; name: string }[],
        },
        bookingMode: mode, appointmentTypes: types, unread: unread.count ?? 0, phone: mask(session.phone),
      };
    });
  });

export const studioOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, todayIst } = await S();
    const { stockState } = await L();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "overview" });
      const today = todayIst();
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const monthStart = `${today.slice(0, 8)}01`;
      const [{ data: listings }, { data: bookings }, { data: enquiries }, { data: history }, { data: moves }] = await Promise.all([
        d.from("mp_listings").select("id,name,is_active,stock_qty,low_stock_threshold,price,images,icon").eq("partner_id", partner.id),
        d.from("mp_bookings").select("id,booking_code,customer_name,booking_date,start_time,appointment_status,appointment_type,amount,fee,created_at,listing:mp_listings(name),staff:mp_staff(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
        partner.kind === "furniture" ? d.from("mp_enquiries").select("id,customer_name,message,status,created_at,listing:mp_listings(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        d.from("mp_booking_status_history").select("status,note,created_at,booking:mp_bookings!inner(partner_id,booking_code)").eq("booking.partner_id", partner.id).order("created_at", { ascending: false }).limit(8),
        partner.kind === "furniture" ? d.from("mp_inventory_movements").select("change,qty_after,reason,created_at,listing:mp_listings(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
      ]);
      const L2 = (listings ?? []) as any[];
      const B = (bookings ?? []) as any[];
      const E = (enquiries ?? []) as any[];
      const states = L2.map(l => stockState(l.stock_qty, l.low_stock_threshold));
      const todays = B.filter(b => b.booking_date === today && ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(b.appointment_status));
      const recent30 = B.filter(b => b.created_at >= since);
      const earningsMonth = B.filter(b => b.appointment_status === "COMPLETED" && (b.booking_date ?? "") >= monthStart).reduce((s, b) => s + Number(b.amount ?? 0) + Number(b.fee ?? 0), 0);
      const upcoming = B.filter(b => (b.booking_date ?? "") >= today && ["CONFIRMED", "RESCHEDULED", "PENDING"].includes(b.appointment_status))
        .sort((a, b) => `${a.booking_date}${a.start_time}`.localeCompare(`${b.booking_date}${b.start_time}`)).slice(0, 8);
      const activity = [
        ...((history ?? []) as any[]).map(h => ({ at: h.created_at, text: `${h.booking?.booking_code ?? "Booking"}: ${h.note ?? h.status}` })),
        ...((moves ?? []) as any[]).map(m => ({ at: m.created_at, text: `${m.listing?.name ?? "Product"}: stock ${m.change > 0 ? "+" : ""}${m.change} → ${m.qty_after} (${String(m.reason).toLowerCase().replace("_", " ")})` })),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
      return {
        kind: partner.kind,
        kpis: partner.kind === "furniture" ? {
          totalProducts: L2.length, activeProducts: L2.filter(l => l.is_active).length,
          outOfStock: states.filter(s => s === "out").length, lowStock: states.filter(s => s === "low").length,
          todaysAppointments: todays.length, pendingAppointments: B.filter(b => b.appointment_status === "PENDING").length,
          newEnquiries: E.filter(e => e.status === "NEW").length,
        } : {
          todaysAppointments: todays.length,
          upcomingAppointments: B.filter(b => (b.booking_date ?? "") > today && ["CONFIRMED", "RESCHEDULED"].includes(b.appointment_status)).length,
          pendingRequests: B.filter(b => b.appointment_status === "PENDING").length,
          completedAppointments: B.filter(b => b.appointment_status === "COMPLETED").length,
          cancelledAppointments: B.filter(b => ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.appointment_status)).length,
          monthlyEarnings: earningsMonth,
        },
        todaysSchedule: todays.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
        upcoming,
        recentAppointments: B.slice(0, 6),
        recentEnquiries: E.slice(0, 6),
        inventoryAlerts: L2.map((l, i) => ({ ...l, state: states[i] })).filter(l => l.state === "out" || l.state === "low").slice(0, 8),
        activity,
        performance: {
          bookings30: recent30.length,
          completed30: recent30.filter(b => b.appointment_status === "COMPLETED").length,
          cancelled30: recent30.filter(b => ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.appointment_status)).length,
          revenue30: recent30.filter(b => b.appointment_status === "COMPLETED").reduce((s, b) => s + Number(b.amount ?? 0) + Number(b.fee ?? 0), 0),
          enquiries30: E.filter(e => e.created_at >= since).length,
        },
      };
    });
  });

// ---------------- furniture inventory ----------------
const variantSchema = z.object({ name: z.string().trim().min(1).max(60), sku: z.string().trim().max(60).optional().default(""), stock: z.number().int().min(0).max(100000).nullable().optional(), price: z.number().min(0).max(10_000_000).nullable().optional() });
const productSchema = z.object({
  token: tok, partnerId: pid, id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120), sku: z.string().trim().max(60).optional().default(""),
  category: z.string().trim().min(1).max(60), subcategory: z.string().trim().max(60).optional().default(""),
  description: z.string().trim().min(10, "Add a short description (10+ characters)").max(3000),
  images: z.array(img).min(1, "Add at least one photo").max(8),
  price: z.number().positive().max(10_000_000), mrp: z.number().positive().max(10_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(100000), lowStockThreshold: z.number().int().min(0).max(10000).default(3),
  brand: z.string().trim().max(80).optional().default(""), material: z.string().trim().max(80).optional().default(""),
  colour: z.string().trim().max(60).optional().default(""), dimensions: z.string().trim().max(120).optional().default(""),
  weight: z.string().trim().max(40).optional().default(""),
  deliveryAvailable: z.boolean(), assemblyAvailable: z.boolean(), installationAvailable: z.boolean(),
  variants: z.array(variantSchema).max(30).default([]), isActive: z.boolean().default(true),
});

async function lowStockCheck(d: any, partner: any, listingId: string, after: number | null) {
  if (after == null) return;
  const { data: l } = await d.from("mp_listings").select("name,low_stock_threshold").eq("id", listingId).maybeSingle();
  if (!l || after > Number(l.low_stock_threshold ?? 3)) return;
  const { notifySeller } = await S();
  await notifySeller(partner.supplier_phone, { type: "PARTNER_LOW_STOCK", refId: listingId, body: after <= 0 ? `${l.name} is out of stock.` : `${l.name} is low on stock (${after} left).` });
}

export const listInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "inventory" });
      const { data: rows } = await d.from("mp_listings").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false });
      const { data: cats } = await d.from("mp_categories").select("slug,name").in("slug", partner.category_slugs ?? []);
      return { products: (rows ?? []) as any[], categories: (cats ?? []) as { slug: string; name: string }[] };
    });
  });

export const saveProductFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "inventory", write: true });
      if (!(partner.category_slugs ?? []).includes(data.category)) throw new StudioError("Pick one of your business categories.");
      if (data.mrp != null && data.mrp < data.price) throw new StudioError("MRP can't be lower than the selling price.");
      const attributes = {
        brand: data.brand || undefined, material: data.material || undefined, colour: data.colour || undefined,
        dimensions: data.dimensions || undefined, weight: data.weight || undefined,
        delivery: data.deliveryAvailable ? "Home delivery available" : undefined,
        delivery_available: data.deliveryAvailable, assembly: data.assemblyAvailable, installation: data.installationAvailable,
        variants: data.variants.map(v => v.name),
      };
      const row = {
        name: data.name, sku: data.sku || null, category_slug: data.category, subcategory: data.subcategory || null,
        description: data.description, images: data.images, price: data.price, mrp: data.mrp ?? null,
        low_stock_threshold: data.lowStockThreshold, attributes, variants: data.variants, is_active: data.isActive, updated_at: new Date().toISOString(),
      };
      let id = data.id ?? null;
      if (id) {
        const { data: own } = await d.from("mp_listings").select("id").eq("id", id).eq("partner_id", partner.id).maybeSingle();
        if (!own) throw new StudioError("You can only edit your own products.");
        const { error } = await d.from("mp_listings").update(row).eq("id", id);
        if (error) throw new StudioError(String(error.code) === "23505" ? "Another product already uses this SKU." : "Could not save the product.");
        await d.rpc("mp_set_stock", { p_listing: id, p_qty: data.stock, p_reason: "MANUAL" });
      } else {
        const { data: ins, error } = await d.from("mp_listings").insert({
          ...row, partner_id: partner.id, listing_type: "PRODUCT", transaction_type: "PRODUCT_ORDER", icon: "🛋️", rating: 0, review_count: 0,
        }).select("id").single();
        if (error) throw new StudioError(String(error.code) === "23505" ? "Another product already uses this SKU." : "Could not add the product.");
        id = ins.id as string;
        await d.rpc("mp_set_stock", { p_listing: id, p_qty: data.stock, p_reason: "CREATED" });
      }
      await lowStockCheck(d, partner, id!, data.stock);
      return { id };
    });
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "inventory", write: true });
      const { data: open } = await d.from("mp_bookings").select("id").eq("listing_id", data.id).in("appointment_status", ["PENDING", "CONFIRMED", "RESCHEDULED"]).limit(1);
      if (open?.length) throw new StudioError("This product has open orders or appointments. Deactivate it instead.");
      const { error, count } = await d.from("mp_listings").delete({ count: "exact" }).eq("id", data.id).eq("partner_id", partner.id);
      if (error) throw new StudioError("This product has past orders, so it can't be deleted. Deactivate it instead.");
      if (!count) throw new StudioError("Product not found.");
      return true;
    });
  });

export const setListingActiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, ids: z.array(z.string().uuid()).min(1).max(200), active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, write: true });
      await d.from("mp_listings").update({ is_active: data.active, updated_at: new Date().toISOString() }).in("id", data.ids).eq("partner_id", partner.id);
      return true;
    });
  });

export const updateStockFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: pid, bulk: z.boolean().default(false),
    items: z.array(z.object({ id: z.string().uuid().optional(), sku: z.string().max(60).optional(), qty: z.number().int().min(0).max(100000), price: z.number().positive().max(10_000_000).optional() })).min(1).max(500),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "inventory", write: true });
      const { data: own } = await d.from("mp_listings").select("id,sku").eq("partner_id", partner.id);
      const byId = new Map(((own ?? []) as any[]).map(r => [r.id, r.id]));
      const bySku = new Map(((own ?? []) as any[]).filter(r => r.sku).map(r => [String(r.sku).toLowerCase(), r.id]));
      let updated = 0; const missing: string[] = [];
      for (const it of data.items) {
        const id = (it.id && byId.get(it.id)) || (it.sku && bySku.get(it.sku.trim().toLowerCase()));
        if (!id) { missing.push(it.sku || it.id || "?"); continue; }
        await d.rpc("mp_set_stock", { p_listing: id, p_qty: it.qty, p_reason: data.bulk ? "BULK" : "MANUAL" });
        if (it.price) await d.from("mp_listings").update({ price: it.price, updated_at: new Date().toISOString() }).eq("id", id);
        await lowStockCheck(d, partner, id, it.qty);
        updated++;
      }
      return { updated, missing };
    });
  });

// ---------------- services (service providers only) ----------------
const serviceSchema = z.object({
  token: tok, partnerId: pid, id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120), category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(10, "Add a short description (10+ characters)").max(3000),
  images: z.array(img).min(1, "Add at least one photo").max(8),
  price: z.number().min(0).max(10_000_000), durationMin: z.number().int().min(10).max(600),
  modes: z.array(z.enum(["AT_SALON", "HOME_SERVICE"])).min(1, "Choose where the service happens"),
  homeFee: z.number().min(0).max(100000).default(0),
  availableDays: z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  isActive: z.boolean().default(true),
});

export const listServicesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "services" });
      const { data: rows } = await d.from("mp_listings").select("id,name,category_slug,description,images,icon,price,starting_price,duration_min,service_modes,home_service_fee,attributes,is_active,created_at").eq("partner_id", partner.id).order("created_at", { ascending: false });
      const { data: cats } = await d.from("mp_categories").select("slug,name").in("slug", partner.category_slugs ?? []);
      return { services: (rows ?? []) as any[], categories: (cats ?? []) as { slug: string; name: string }[] };
    });
  });

export const saveServiceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => serviceSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "services", write: true });
      if (!(partner.category_slugs ?? []).includes(data.category)) throw new StudioError("Pick one of your business categories.");
      const onlyHome = data.modes.length === 1 && data.modes[0] === "HOME_SERVICE";
      const row = {
        name: data.name, category_slug: data.category, description: data.description, images: data.images,
        price: data.price, duration_min: data.durationMin, service_modes: data.modes,
        home_service_fee: data.modes.includes("HOME_SERVICE") ? data.homeFee : 0,
        attributes: { available_days: data.availableDays }, is_active: data.isActive,
        listing_type: "SERVICE", transaction_type: onlyHome ? "HOME_SERVICE_BOOKING" : "SERVICE_BOOKING", updated_at: new Date().toISOString(),
      };
      if (data.id) {
        const { error, count } = await d.from("mp_listings").update(row, { count: "exact" }).eq("id", data.id).eq("partner_id", partner.id);
        if (error || !count) throw new StudioError("Could not save the service.");
        return { id: data.id };
      }
      const { data: ins, error } = await d.from("mp_listings").insert({ ...row, partner_id: partner.id, icon: "✨", rating: 0, review_count: 0 }).select("id").single();
      if (error) throw new StudioError("Could not add the service.");
      return { id: ins.id as string };
    });
  });

export const deleteServiceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "services", write: true });
      const { data: open } = await d.from("mp_bookings").select("id").eq("listing_id", data.id).in("appointment_status", ["PENDING", "CONFIRMED", "RESCHEDULED"]).limit(1);
      if (open?.length) throw new StudioError("This service has upcoming appointments. Deactivate it instead.");
      const { error, count } = await d.from("mp_listings").delete({ count: "exact" }).eq("id", data.id).eq("partner_id", partner.id);
      if (error) throw new StudioError("This service has past bookings, so it can't be deleted. Deactivate it instead.");
      if (!count) throw new StudioError("Service not found.");
      return true;
    });
  });

// ---------------- appointments ----------------
const APPT_SELECT = "id,booking_code,customer_name,customer_phone,listing_id,staff_id,booking_date,start_time,end_time,status,appointment_status,appointment_type,location_type,service_mode,address,details,amount,fee,payment_status,customer_notes,seller_notes,transaction_type,reschedule_count,enquiry_id,created_at,listing:mp_listings(name,icon,duration_min),staff:mp_staff(name)";
const shapeAppt = (b: any) => ({ ...b, customer_phone: mask(b.customer_phone) });

export const listAppointmentsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, from: isoDate.optional(), to: isoDate.optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "appointments" });
      let q = d.from("mp_bookings").select(APPT_SELECT).eq("partner_id", partner.id).neq("transaction_type", "PRODUCT_ORDER_DELIVERY");
      if (data.from) q = q.gte("booking_date", data.from);
      if (data.to) q = q.lte("booking_date", data.to);
      const { data: rows } = await q.order("booking_date", { ascending: true }).order("start_time", { ascending: true }).limit(1000);
      const { data: staff } = await d.from("mp_staff").select("id,name,is_active,service_ids").eq("partner_id", partner.id).order("name");
      // Furniture product deliveries are orders, not appointments.
      const appts = ((rows ?? []) as any[]).filter(b => !(b.transaction_type === "PRODUCT_ORDER" && !(b.details?.store_visit || b.appointment_type)));
      return { appointments: appts.map(shapeAppt), staff: (staff ?? []) as any[] };
    });
  });

export const studioSlotsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, date: isoDate, durationMin: z.number().int().min(10).max(600).optional(), staffId: z.string().uuid().nullable().optional(), ignoreBookingId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, appointmentSlots } = await S();
    return studioResult(async () => {
      const { partner } = await requireStudio(data.token, { partnerId: data.partnerId, page: "appointments" });
      const r = await appointmentSlots(partner.id, data.date, { durationMin: data.durationMin, staffIds: data.staffId ? [data.staffId] : undefined, ignoreBookingId: data.ignoreBookingId });
      return r.slots;
    });
  });

export const appointmentActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: pid, id: z.string().uuid(),
    action: z.enum(["ACCEPT", "REJECT", "CONFIRM", "RESCHEDULE", "CANCEL", "COMPLETE", "NO_SHOW", "ASSIGN", "NOTE", "PAYMENT"]),
    date: isoDate.optional(), time: hhmm.optional(), staffId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(500).optional(), paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED", "NOT_APPLICABLE"]).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError, appointmentSlots, endTimeFor, notifyCustomer } = await S();
    const { allowedActions, nextStatus, legacyStatusFor, STATUS_LABEL, toMin } = await L();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "appointments", write: true });
      const { data: b } = await d.from("mp_bookings").select("*, listing:mp_listings(name,duration_min)").eq("id", data.id).eq("partner_id", partner.id).maybeSingle();
      if (!b) throw new StudioError("Appointment not found.");
      const label = b.listing?.name ?? "your appointment";
      const ref = b.booking_code ? ` (${b.booking_code})` : "";

      if (data.action === "NOTE") {
        await d.from("mp_bookings").update({ seller_notes: data.note ?? "" }).eq("id", b.id);
        return { status: b.appointment_status };
      }
      if (data.action === "PAYMENT") {
        await d.from("mp_bookings").update({ payment_status: data.paymentStatus ?? "UNPAID" }).eq("id", b.id);
        return { status: b.appointment_status };
      }
      if (data.action === "ASSIGN") {
        if (!["PENDING", "CONFIRMED", "RESCHEDULED"].includes(b.appointment_status)) throw new StudioError("This appointment is closed.");
        if (data.staffId) {
          const { data: st } = await d.from("mp_staff").select("id,name,is_active").eq("id", data.staffId).eq("partner_id", partner.id).maybeSingle();
          if (!st || !st.is_active) throw new StudioError("Choose an active professional from your team.");
        }
        const { error } = await d.from("mp_bookings").update({ staff_id: data.staffId ?? null }).eq("id", b.id);
        if (error) throw new StudioError(String(error.code) === "23505" ? "That professional already has an appointment at this time." : "Could not assign.");
        await d.from("mp_booking_status_history").insert({ booking_id: b.id, status: b.status, note: data.staffId ? "Professional assigned" : "Professional unassigned" });
        return { status: b.appointment_status };
      }

      if (!allowedActions(b.appointment_status).includes(data.action as never)) throw new StudioError(`A ${STATUS_LABEL[b.appointment_status as keyof typeof STATUS_LABEL]?.toLowerCase() ?? "closed"} appointment can't be changed this way.`);
      const status = nextStatus(data.action as never);
      const patch: Record<string, unknown> = { appointment_status: status, status: legacyStatusFor(status, b.status) };
      let note = data.note || `${STATUS_LABEL[status]} by seller`;

      if (data.action === "RESCHEDULE") {
        if (!data.date || !data.time) throw new StudioError("Pick the new date and time.");
        const dur = b.start_time && b.end_time ? toMin(b.end_time) - toMin(b.start_time) : (b.listing?.duration_min ?? null);
        const { slots } = await appointmentSlots(partner.id, data.date, { durationMin: dur, staffIds: b.staff_id ? [b.staff_id] : undefined, ignoreBookingId: b.id });
        if (!slots.some(s => s.time === data.time)) throw new StudioError("That time isn't free. Pick another slot.");
        patch.booking_date = data.date; patch.start_time = data.time;
        patch.end_time = b.end_time ? endTimeFor(data.time, dur || 30) : null;
        patch.reschedule_count = Number(b.reschedule_count ?? 0) + 1;
        note = `Rescheduled to ${data.date} ${data.time}${data.note ? ` — ${data.note}` : ""}`;
      }
      const { error } = await d.from("mp_bookings").update(patch).eq("id", b.id).eq("appointment_status", b.appointment_status);
      if (error) throw new StudioError(String(error.code) === "23505" ? "That time is already booked. Pick another slot." : "Could not update the appointment.");
      await d.from("mp_booking_status_history").insert({ booking_id: b.id, status: patch.status, note });

      const msgs: Partial<Record<string, [string, string]>> = {
        CONFIRMED: ["BOOKING_CONFIRMED", `${label}${ref} is confirmed.`],
        RESCHEDULED: ["BOOKING_RESCHEDULED", `${label}${ref} moved to ${data.date} at ${data.time}.`],
        REJECTED: ["BOOKING_CANCELLED", `${label}${ref} couldn't be accepted by the seller.${data.note ? ` ${data.note}` : ""}`],
        CANCELLED: ["BOOKING_CANCELLED", `${label}${ref} has been cancelled by the seller.${data.note ? ` ${data.note}` : ""}`],
        COMPLETED: ["BOOKING_COMPLETED", `${label}${ref} is complete. Thanks for visiting!`],
      };
      const m = msgs[status];
      if (m) await notifyCustomer(b.customer_phone, { type: m[0] as never, body: m[1], refId: b.id });
      return { status };
    });
  });

/** Seller-created appointment (walk-ins, phone requests, converted enquiries). */
export const createSellerAppointmentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: pid, listingId: z.string().uuid().nullable().optional(), enquiryId: z.string().uuid().nullable().optional(),
    customerName: z.string().trim().min(1).max(80), customerPhone: z.string().trim().regex(/^\+?\d{10,15}$/).optional(),
    appointmentType: z.string().trim().min(2).max(60), date: isoDate, time: hhmm, staffId: z.string().uuid().nullable().optional(),
    locationType: z.enum(["BUSINESS", "CUSTOMER"]).default("BUSINESS"), address: z.string().trim().max(300).optional(), notes: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError, appointmentSlots, endTimeFor, notifyCustomer } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "appointments", write: true });
      let phone = data.customerPhone?.replace(/^\+91/, "") ?? null;
      let listingId = data.listingId ?? null;
      if (data.enquiryId) {
        const { data: e } = await d.from("mp_enquiries").select("*").eq("id", data.enquiryId).eq("partner_id", partner.id).maybeSingle();
        if (!e) throw new StudioError("Enquiry not found.");
        if (e.status === "CONVERTED" || e.booking_id) throw new StudioError("This enquiry already has an appointment.");
        phone = e.customer_phone; listingId = listingId ?? e.listing_id;
      }
      if (!phone) throw new StudioError("Add the customer's mobile number.");
      let dur: number | null = null; let tx = "PRODUCT_ORDER";
      if (listingId) {
        const { data: l } = await d.from("mp_listings").select("id,duration_min,transaction_type").eq("id", listingId).eq("partner_id", partner.id).maybeSingle();
        if (!l) throw new StudioError("Pick one of your own products or services.");
        dur = l.duration_min; tx = l.transaction_type;
      } else if (partner.kind === "service") tx = "SERVICE_BOOKING";
      const { slots } = await appointmentSlots(partner.id, data.date, { durationMin: dur, staffIds: data.staffId ? [data.staffId] : undefined });
      if (!slots.some(s => s.time === data.time)) throw new StudioError("That time isn't free. Pick another slot.");
      if (data.locationType === "CUSTOMER" && !data.address) throw new StudioError("Add the customer's address for a visit at their place.");
      const code = "KB" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: ins, error } = await d.from("mp_bookings").insert({
        booking_code: code, customer_phone: phone, customer_name: data.customerName, partner_id: partner.id, listing_id: listingId,
        transaction_type: tx, staff_id: data.staffId ?? null, booking_date: data.date, start_time: data.time,
        end_time: dur ? endTimeFor(data.time, dur) : null, address: data.locationType === "CUSTOMER" ? { line: data.address } : null,
        details: { store_visit: data.locationType === "BUSINESS" && partner.kind === "furniture", package: data.appointmentType, created_by: "seller" },
        status: "PROVIDER_CONFIRMED", appointment_status: "CONFIRMED", appointment_type: data.appointmentType, location_type: data.locationType,
        customer_notes: data.notes ?? null, enquiry_id: data.enquiryId ?? null, service_mode: data.locationType === "CUSTOMER" && partner.kind === "service" ? "HOME_SERVICE" : null,
      }).select("id,booking_code").single();
      if (error) throw new StudioError(String(error.code) === "23505" ? "That time is already booked. Pick another slot." : "Could not create the appointment.");
      await d.from("mp_booking_status_history").insert({ booking_id: ins.id, status: "PROVIDER_CONFIRMED", note: data.enquiryId ? "Created from customer enquiry" : "Created by seller" });
      if (data.enquiryId) {
        await d.from("mp_enquiries").update({ status: "CONVERTED", booking_id: ins.id, updated_at: new Date().toISOString() }).eq("id", data.enquiryId);
        await d.from("mp_enquiry_events").insert({ enquiry_id: data.enquiryId, actor: "SELLER", kind: "CONVERTED", message: `${data.appointmentType} booked for ${data.date} at ${data.time}` });
      }
      await notifyCustomer(phone, { type: "BOOKING_CONFIRMED", refId: ins.id, body: `${data.appointmentType} with ${partner.name} is confirmed for ${data.date} at ${data.time}.` });
      return { id: ins.id as string, code: ins.booking_code as string };
    });
  });

// ---------------- availability ----------------
const settingsSchema = z.object({
  working_hours: z.array(z.object({ day: z.number().int().min(0).max(6), enabled: z.boolean(), open: hhmm, close: hhmm })).length(7),
  slot_minutes: z.number().int().min(10).max(480), buffer_minutes: z.number().int().min(0).max(240), max_per_slot: z.number().int().min(1).max(50),
  breaks: z.array(z.object({ start: hhmm, end: hhmm })).max(6),
  date_overrides: z.record(isoDate, z.object({ closed: z.boolean().optional(), open: hhmm.optional(), close: hhmm.optional(), note: z.string().max(80).optional() })),
  paused_from: isoDate.nullable(), paused_until: isoDate.nullable(),
  allow_business_location: z.boolean(), allow_customer_location: z.boolean(),
});

export const getAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, settingsFor } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId });
      const page = partner.kind === "service" ? "availability" : "settings";
      await requireStudio(data.token, { partnerId: partner.id, page });
      const r = await settingsFor(d, partner);
      return { ...r, holidays: (partner.closed_dates ?? []) as string[] };
    });
  });

export const saveAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, settings: settingsSchema, holidays: z.array(isoDate).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    const { toMin } = await L();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, write: true });
      await requireStudio(data.token, { partnerId: partner.id, page: partner.kind === "service" ? "availability" : "settings" });
      const s = data.settings;
      for (const h of s.working_hours) if (h.enabled && toMin(h.close) <= toMin(h.open)) throw new StudioError(`Closing time must be after opening time (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][h.day]}).`);
      for (const b of s.breaks) if (toMin(b.end) <= toMin(b.start)) throw new StudioError("Each break must end after it starts.");
      if (s.paused_from && s.paused_until && s.paused_until < s.paused_from) throw new StudioError("Temporary pause must end after it starts.");
      if (!s.allow_business_location && !s.allow_customer_location) throw new StudioError("Allow at least one appointment location.");
      const { error } = await d.from("mp_appointment_settings").upsert({ partner_id: partner.id, ...s, updated_at: new Date().toISOString() });
      if (error) throw new StudioError("Could not save availability.");
      // Keep the store page's opening hours in step.
      const open = s.working_hours.filter(h => h.enabled);
      await d.from("mp_partners").update({
        opens_at: open.length ? open.map(h => h.open).sort()[0] : partner.opens_at,
        closes_at: open.length ? open.map(h => h.close).sort().slice(-1)[0] : partner.closes_at,
        weekly_off: s.working_hours.filter(h => !h.enabled).map(h => h.day),
        closed_dates: Array.from(new Set(data.holidays)).sort(), updated_at: new Date().toISOString(),
      }).eq("id", partner.id);
      return true;
    });
  });

// ---------------- enquiries (furniture) ----------------
export const listEnquiriesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "enquiries" });
      const { data: rows } = await d.from("mp_enquiries").select("*, listing:mp_listings(id,name,icon,images), events:mp_enquiry_events(id,actor,kind,message,created_at)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(300);
      return ((rows ?? []) as any[]).map(e => ({ ...e, customer_phone: mask(e.customer_phone), events: (e.events ?? []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)) }));
    });
  });

export const respondEnquiryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, id: z.string().uuid(), message: z.string().trim().max(1000).optional(), status: z.enum(["NEW", "RESPONDED", "IN_PROGRESS", "CLOSED"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError, notifyCustomer } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "enquiries", write: true });
      const { data: e } = await d.from("mp_enquiries").select("id,customer_phone,status,listing:mp_listings(name)").eq("id", data.id).eq("partner_id", partner.id).maybeSingle();
      if (!e) throw new StudioError("Enquiry not found.");
      if (!data.message && !data.status) throw new StudioError("Write a reply or choose a status.");
      const status = data.status ?? (data.message ? "RESPONDED" : e.status);
      if (data.message) {
        await d.from("mp_enquiry_events").insert({ enquiry_id: e.id, actor: "SELLER", kind: "MESSAGE", message: data.message });
        await notifyCustomer(e.customer_phone, { type: "ENQUIRY_REPLY", refId: `${e.id}:${Date.now()}`.slice(0, 60), body: `${partner.name}: ${data.message}`.slice(0, 280) });
      }
      if (status !== e.status) await d.from("mp_enquiry_events").insert({ enquiry_id: e.id, actor: "SELLER", kind: "STATUS", message: `Status changed to ${status.replace("_", " ").toLowerCase()}` });
      await d.from("mp_enquiries").update({ status, updated_at: new Date().toISOString() }).eq("id", e.id);
      return { status };
    });
  });

// ---------------- professionals ----------------
export const listProfessionalsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, todayIst } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "professionals" });
      const today = todayIst();
      const [{ data: staff }, { data: services }, { data: appts }] = await Promise.all([
        d.from("mp_staff").select("*").eq("partner_id", partner.id).order("name"),
        d.from("mp_listings").select("id,name").eq("partner_id", partner.id).order("name"),
        d.from("mp_bookings").select("id,staff_id,booking_date,start_time,appointment_status,customer_name,listing:mp_listings(name)").eq("partner_id", partner.id).gte("booking_date", today).in("appointment_status", ["PENDING", "CONFIRMED", "RESCHEDULED"]).not("staff_id", "is", null).order("booking_date").order("start_time").limit(300),
      ]);
      return { staff: ((staff ?? []) as any[]).map(s => ({ ...s, schedule: ((appts ?? []) as any[]).filter(a => a.staff_id === s.id).slice(0, 10) })), services: (services ?? []) as any[] };
    });
  });

export const saveProfessionalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: pid, id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2).max(80), title: z.string().trim().max(80).default(""), phone: z.string().trim().regex(/^(\+?\d{10,15})?$/).default(""),
    photoUrl: img.nullable().optional(), serviceIds: z.array(z.string().uuid()).max(100).default([]),
    offWeekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]), offDates: z.array(isoDate).max(120).default([]),
    workStart: hhmm.nullable().optional(), workEnd: hhmm.nullable().optional(), isActive: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "professionals", write: true });
      if (data.workStart && data.workEnd && data.workEnd <= data.workStart) throw new StudioError("Working hours must end after they start.");
      if (data.serviceIds.length) {
        const { data: own } = await d.from("mp_listings").select("id").eq("partner_id", partner.id).in("id", data.serviceIds);
        if ((own ?? []).length !== data.serviceIds.length) throw new StudioError("Assign only your own services.");
      }
      const row = { name: data.name, title: data.title || null, phone: data.phone || null, photo_url: data.photoUrl ?? null, service_ids: data.serviceIds, off_weekdays: data.offWeekdays, off_dates: data.offDates, work_start: data.workStart ?? null, work_end: data.workEnd ?? null, is_active: data.isActive };
      if (data.id) {
        const { error, count } = await d.from("mp_staff").update(row, { count: "exact" }).eq("id", data.id).eq("partner_id", partner.id);
        if (error || !count) throw new StudioError("Could not save.");
        return { id: data.id };
      }
      const { data: ins, error } = await d.from("mp_staff").insert({ ...row, partner_id: partner.id, rating: 0 }).select("id").single();
      if (error) throw new StudioError("Could not add the professional.");
      return { id: ins.id as string };
    });
  });

export const deleteProfessionalFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "professionals", write: true });
      const { data: open } = await d.from("mp_bookings").select("id").eq("staff_id", data.id).in("appointment_status", ["PENDING", "CONFIRMED", "RESCHEDULED"]).limit(1);
      if (open?.length) throw new StudioError("Reassign this professional's upcoming appointments first.");
      const { error } = await d.from("mp_staff").delete().eq("id", data.id).eq("partner_id", partner.id);
      if (error) { await d.from("mp_staff").update({ is_active: false }).eq("id", data.id).eq("partner_id", partner.id); return { deactivated: true }; }
      return { deactivated: false };
    });
  });

// ---------------- customers ----------------
export const listStudioCustomersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "customers" });
      const [{ data: b }, { data: e }, { data: notes }] = await Promise.all([
        d.from("mp_bookings").select("id,booking_code,customer_phone,customer_name,booking_date,start_time,appointment_status,appointment_type,amount,created_at,listing:mp_listings(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(2000),
        d.from("mp_enquiries").select("id,customer_phone,customer_name,message,status,created_at,listing:mp_listings(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(1000),
        d.from("mp_partner_customer_notes").select("customer_phone,note").eq("partner_id", partner.id),
      ]);
      const map = new Map<string, any>();
      const get = (phone: string, name: string | null) => {
        if (!map.has(phone)) map.set(phone, { phone, name: name || "Customer", bookings: [], enquiries: [], note: "" });
        const c = map.get(phone); if (name && c.name === "Customer") c.name = name; return c;
      };
      for (const x of (b ?? []) as any[]) if (x.customer_phone) get(x.customer_phone, x.customer_name).bookings.push({ ...x, customer_phone: undefined });
      for (const x of (e ?? []) as any[]) if (x.customer_phone) get(x.customer_phone, x.customer_name).enquiries.push({ ...x, customer_phone: undefined });
      for (const n of (notes ?? []) as any[]) if (map.has(n.customer_phone)) map.get(n.customer_phone).note = n.note;
      const out = [];
      for (const c of map.values()) {
        const last = [...c.bookings.map((x: any) => x.created_at), ...c.enquiries.map((x: any) => x.created_at)].sort().slice(-1)[0] ?? null;
        out.push({
          key: await customerKey(partner.id, c.phone), name: c.name, phone: mask(c.phone), note: c.note, lastActivity: last,
          completed: c.bookings.filter((x: any) => x.appointment_status === "COMPLETED").length,
          cancelled: c.bookings.filter((x: any) => ["CANCELLED", "REJECTED", "NO_SHOW"].includes(x.appointment_status)).length,
          bookings: c.bookings, enquiries: c.enquiries,
        });
      }
      return out.sort((a, b) => String(b.lastActivity).localeCompare(String(a.lastActivity)));
    });
  });

export const saveCustomerNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, key: z.string().length(16), note: z.string().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "customers", write: true });
      const [{ data: b }, { data: e }] = await Promise.all([
        d.from("mp_bookings").select("customer_phone").eq("partner_id", partner.id).limit(3000),
        d.from("mp_enquiries").select("customer_phone").eq("partner_id", partner.id).limit(2000),
      ]);
      const phones = Array.from(new Set([...(b ?? []), ...(e ?? [])].map((r: any) => r.customer_phone).filter(Boolean)));
      let phone: string | null = null;
      for (const p of phones) if ((await customerKey(partner.id, p)) === data.key) { phone = p; break; }
      if (!phone) throw new StudioError("Customer not found.");
      await d.from("mp_partner_customer_notes").upsert({ partner_id: partner.id, customer_phone: phone, note: data.note, updated_at: new Date().toISOString() });
      return true;
    });
  });

// ---------------- notifications ----------------
export const studioNotificationsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, markRead: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, todayIst } = await S();
    return studioResult(async () => {
      const { partner, d, session } = await requireStudio(data.token, { partnerId: data.partnerId, page: "notifications" });
      if (data.markRead) await d.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_phone", session.phone).is("read_at", null);
      const today = todayIst();
      const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
      const [{ data: rows }, { data: upcoming }] = await Promise.all([
        d.from("notifications").select("id,title,body,notification_type,order_id,read_at,created_at").eq("user_phone", session.phone).order("created_at", { ascending: false }).limit(100),
        d.from("mp_bookings").select("id,booking_code,customer_name,booking_date,start_time,appointment_type,listing:mp_listings(name)").eq("partner_id", partner.id).in("appointment_status", ["CONFIRMED", "RESCHEDULED"]).gte("booking_date", today).lte("booking_date", tomorrow).order("booking_date").order("start_time").limit(30),
      ]);
      return { notifications: (rows ?? []) as any[], upcoming: (upcoming ?? []) as any[] };
    });
  });

// ---------------- reviews ----------------
export const listStudioReviewsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "reviews" });
      const { data: rows } = await d.from("mp_reviews").select("id,customer_name,rating,comment,created_at,reply,replied_at,listing:mp_listings(name)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(300);
      return (rows ?? []) as any[];
    });
  });

export const replyReviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, id: z.string().uuid(), reply: z.string().trim().min(2).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "reviews", write: true });
      const { error, count } = await d.from("mp_reviews").update({ reply: data.reply, replied_at: new Date().toISOString() }, { count: "exact" }).eq("id", data.id).eq("partner_id", partner.id);
      if (error || !count) throw new StudioError("Could not save your reply.");
      return true;
    });
  });

// ---------------- reports ----------------
export const studioReportsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok, partnerId: pid, from: isoDate, to: isoDate }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult } = await S();
    const { stockState } = await L();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "reports" });
      const fromTs = `${data.from}T00:00:00+05:30`, toTs = `${data.to}T23:59:59+05:30`;
      const [{ data: listings }, { data: bookings }, { data: enquiries }, { data: moves }, { data: staff }] = await Promise.all([
        d.from("mp_listings").select("id,name,sku,stock_qty,low_stock_threshold,price,is_active").eq("partner_id", partner.id),
        d.from("mp_bookings").select("id,listing_id,staff_id,appointment_status,appointment_type,transaction_type,details,amount,fee,booking_date,created_at").eq("partner_id", partner.id).gte("created_at", fromTs).lte("created_at", toTs).limit(5000),
        partner.kind === "furniture" ? d.from("mp_enquiries").select("id,listing_id,status,created_at").eq("partner_id", partner.id).gte("created_at", fromTs).lte("created_at", toTs).limit(5000) : Promise.resolve({ data: [] }),
        partner.kind === "furniture" ? d.from("mp_inventory_movements").select("listing_id,change,qty_after,reason,created_at").eq("partner_id", partner.id).gte("created_at", fromTs).lte("created_at", toTs).order("created_at", { ascending: false }).limit(5000) : Promise.resolve({ data: [] }),
        d.from("mp_staff").select("id,name").eq("partner_id", partner.id),
      ]);
      const B = (bookings ?? []) as any[]; const E = (enquiries ?? []) as any[]; const M = (moves ?? []) as any[]; const LS = (listings ?? []) as any[];
      const names = Object.fromEntries(LS.map(l => [l.id, l.name]));
      const isOrder = (b: any) => b.transaction_type === "PRODUCT_ORDER" && !b.details?.store_visit && !b.appointment_type;
      const appts = B.filter(b => !isOrder(b));
      const byStatus = Object.fromEntries(["PENDING", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].map(s => [s, appts.filter(b => b.appointment_status === s).length]));
      const byType: Record<string, number> = {};
      for (const b of appts) { const t = b.appointment_type ?? (b.details?.store_visit ? "Showroom Visit" : "Booking"); byType[t] = (byType[t] ?? 0) + 1; }
      const closed = appts.filter(b => ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(b.appointment_status)).length;
      const cancelRate = closed ? Math.round(((byStatus.CANCELLED + byStatus.REJECTED + byStatus.NO_SHOW) / closed) * 100) : 0;
      const money = (b: any) => Number(b.amount ?? 0) + Number(b.fee ?? 0);
      const products = LS.map(l => {
        const orders = B.filter(b => b.listing_id === l.id && isOrder(b) && b.appointment_status !== "CANCELLED");
        return {
          name: l.name, sku: l.sku ?? "", unitsSold: orders.reduce((s, b) => s + Number(b.details?.quantity ?? 1), 0), revenue: orders.reduce((s, b) => s + money(b), 0),
          appointments: appts.filter(b => b.listing_id === l.id).length, enquiries: E.filter(e => e.listing_id === l.id).length,
          completed: appts.filter(b => b.listing_id === l.id && b.appointment_status === "COMPLETED").length,
          earnings: appts.filter(b => b.listing_id === l.id && b.appointment_status === "COMPLETED").reduce((s, b) => s + money(b), 0),
          stock: l.stock_qty, state: stockState(l.stock_qty, l.low_stock_threshold), active: l.is_active,
        };
      });
      return {
        kind: partner.kind,
        summary: { appointments: appts.length, completed: byStatus.COMPLETED, cancelRate, earnings: appts.filter(b => b.appointment_status === "COMPLETED").reduce((s, b) => s + money(b), 0) + B.filter(b => isOrder(b) && b.appointment_status !== "CANCELLED").reduce((s, b) => s + money(b), 0), enquiries: E.length, converted: E.filter(e => e.status === "CONVERTED").length },
        byStatus, byType, products,
        lowStock: products.filter(p => p.state === "low" || p.state === "out"),
        movements: M.map(m => ({ ...m, name: names[m.listing_id] ?? "Product" })),
        enquiryStatus: Object.fromEntries(["NEW", "RESPONDED", "IN_PROGRESS", "CONVERTED", "CLOSED"].map(s => [s, E.filter(e => e.status === s).length])),
        professionals: ((staff ?? []) as any[]).map(s => {
          const mine = appts.filter(b => b.staff_id === s.id);
          return { name: s.name, appointments: mine.length, completed: mine.filter(b => b.appointment_status === "COMPLETED").length, noShows: mine.filter(b => b.appointment_status === "NO_SHOW").length, earnings: mine.filter(b => b.appointment_status === "COMPLETED").reduce((t, b) => t + money(b), 0) };
        }),
      };
    });
  });

// ---------------- business profile ----------------
export const saveBusinessProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: pid, name: z.string().trim().min(2).max(100), description: z.string().trim().max(2000).default(""),
    address: z.string().trim().min(5).max(300), serviceArea: z.string().trim().max(200).default(""),
    businessPhone: z.string().trim().regex(/^\+?\d{10,15}$/, "Enter a valid contact number"),
    logoUrl: img.nullable().optional(), photos: z.array(img).max(8).default([]),
    lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional(),
    isActive: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireStudio, studioResult, StudioError } = await S();
    return studioResult(async () => {
      const { partner, d } = await requireStudio(data.token, { partnerId: data.partnerId, page: "profile", write: true });
      // Category, verification and account status are controlled by Kartogo admin only.
      const { error } = await d.from("mp_partners").update({
        name: data.name, description: data.description || null, address: data.address, service_area: data.serviceArea || null,
        business_phone: data.businessPhone, logo_url: data.logoUrl ?? null, photos: data.photos, lat: data.lat ?? null, lng: data.lng ?? null,
        is_active: data.isActive, updated_at: new Date().toISOString(),
      }).eq("id", partner.id);
      if (error) throw new StudioError("Could not save your business profile.");
      return true;
    });
  });

// ---------------- customer side: enquiries + appointment options ----------------
async function customerPhone(token: string) {
  const { verifyCustomerToken } = await import("./auth-tokens.server");
  return verifyCustomerToken(token)?.phone ?? null;
}

export const createEnquiryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), listingId: z.string().uuid(), message: z.string().trim().min(5, "Write a few words about what you need").max(1000), name: z.string().trim().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    const phone = await customerPhone(data.token);
    if (!phone) return { ok: false as const, error: "Please login to send an enquiry." };
    const { db, notifySeller } = await S();
    const d = await db();
    const { data: l } = await d.from("mp_listings").select("id,name,partner_id,partner:mp_partners(name,supplier_phone,account_status)").eq("id", data.listingId).eq("is_active", true).maybeSingle();
    if (!l) return { ok: false as const, error: "This product is no longer available." };
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await d.from("mp_enquiries").select("id", { count: "exact", head: true }).eq("customer_phone", phone).gte("created_at", since);
    if ((count ?? 0) >= 10) return { ok: false as const, error: "You've sent many enquiries. Please try again later." };
    const { data: cust } = await d.from("customers").select("name").eq("phone", phone).maybeSingle();
    const { data: ins, error } = await d.from("mp_enquiries").insert({ partner_id: l.partner_id, listing_id: l.id, customer_phone: phone, customer_name: cust?.name ?? data.name ?? null, message: data.message }).select("id").single();
    if (error) return { ok: false as const, error: "Couldn't send your enquiry. Please try again." };
    await d.from("mp_enquiry_events").insert({ enquiry_id: ins.id, actor: "CUSTOMER", kind: "MESSAGE", message: data.message });
    await notifySeller(l.partner?.supplier_phone, { type: "PARTNER_NEW_ENQUIRY", refId: ins.id, body: `New enquiry about ${l.name}: ${data.message}`.slice(0, 280) });
    return { ok: true as const, id: ins.id as string };
  });

export const myEnquiriesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), listingId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const phone = await customerPhone(data.token);
    if (!phone) return [];
    const { db } = await S();
    const d = await db();
    let q = d.from("mp_enquiries").select("id,message,status,created_at,listing:mp_listings(id,name),partner:mp_partners(name),events:mp_enquiry_events(actor,message,created_at,kind)").eq("customer_phone", phone);
    if (data.listingId) q = q.eq("listing_id", data.listingId);
    const { data: rows } = await q.order("created_at", { ascending: false }).limit(50);
    return ((rows ?? []) as any[]).map(e => ({ ...e, events: (e.events ?? []).filter((x: any) => x.kind === "MESSAGE").sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)) }));
  });

/** Appointment types, locations and free times for a product/service page. */
export const appointmentOptionsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data }) => {
    const { db, appointmentSlots, appointmentTypesFor, bookingModeFor, settingsFor } = await S();
    const d = await db();
    const { data: l } = await d.from("mp_listings").select("id,partner_id,duration_min,partner:mp_partners(id,category_slugs,partner_type,booking_mode,opens_at,closes_at,weekly_off,is_active,account_status)").eq("id", data.listingId).eq("is_active", true).maybeSingle();
    if (!l?.partner || l.partner.account_status === "SUSPENDED") return { types: [], mode: "SELLER_APPROVAL" as const, slots: [], allowBusiness: true, allowCustomer: false };
    const [types, mode, { settings }, { slots }] = await Promise.all([
      appointmentTypesFor(d, l.partner), bookingModeFor(d, l.partner), settingsFor(d, l.partner),
      appointmentSlots(l.partner_id, data.date, { durationMin: l.duration_min }),
    ]);
    return { types, mode, slots: slots.map(s => s.time), allowBusiness: settings.allow_business_location, allowCustomer: settings.allow_customer_location };
  });
