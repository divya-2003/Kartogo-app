import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Self-service for marketplace partners (salons, home services, event providers…).
// A partner is owned by the supplier phone saved on mp_partners.supplier_phone.
// Every write re-checks ownership server-side from the signed supplier token.
// Bookings stay with the Kartogo admin for now.

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}
async function session(token: string) {
  const { verifySupplierToken } = await import("./auth-tokens.server");
  return verifySupplierToken(token);
}
async function ownedPartner(token: string, partnerId: string) {
  const s = await session(token);
  if (!s) return null;
  const d = await db();
  const { data } = await d.from("mp_partners").select("id").eq("id", partnerId).eq("supplier_phone", s.phone).maybeSingle();
  return data ? d : null;
}

const tok = z.string().min(10);
const dateArr = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(120);
const dayArr = z.array(z.number().int().min(0).max(6)).max(7);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

export const myPartnersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return [];
    const d = await db();
    const { data: partners } = await d.from("mp_partners").select("*").eq("supplier_phone", s.phone).order("name");
    if (!partners?.length) return [];
    const ids = partners.map((p: any) => p.id);
    const [{ data: listings }, { data: staff }] = await Promise.all([
      d.from("mp_listings").select("*").in("partner_id", ids).order("created_at"),
      d.from("mp_staff").select("*").in("partner_id", ids).order("name"),
    ]);
    return partners.map((p: any) => ({
      ...p,
      listings: (listings ?? []).filter((l: any) => l.partner_id === p.id),
      staff: (staff ?? []).filter((x: any) => x.partner_id === p.id),
    }));
  });

export const updatePartnerAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: z.string().uuid(), opensAt: time, closesAt: time,
    weeklyOff: dayArr, closedDates: dateArr, isActive: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const d = await ownedPartner(data.token, data.partnerId);
    if (!d) return { ok: false, error: "Not allowed" };
    const { error } = await d.from("mp_partners").update({
      opens_at: data.opensAt, closes_at: data.closesAt, weekly_off: data.weeklyOff,
      closed_dates: data.closedDates, is_active: data.isActive,
    }).eq("id", data.partnerId);
    return error ? { ok: false, error: "Could not save" } : { ok: true };
  });

const listingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).default(""),
  price: z.number().min(0).max(10_000_000),
  duration_min: z.number().int().min(15).max(24 * 60).nullable(),
  is_active: z.boolean(),
});

export const saveListingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: z.string().uuid(), id: z.string().uuid().optional(), listing: listingSchema,
  }).parse(d))
  .handler(async ({ data }) => {
    const d = await ownedPartner(data.token, data.partnerId);
    if (!d) return { ok: false, error: "Not allowed" };
    const row = { ...data.listing, starting_price: data.listing.price };
    if (data.id) {
      const { error } = await d.from("mp_listings").update(row).eq("id", data.id).eq("partner_id", data.partnerId);
      return error ? { ok: false, error: "Could not save" } : { ok: true };
    }
    const { data: p } = await d.from("mp_partners").select("category_slugs,partner_type").eq("id", data.partnerId).maybeSingle();
    const { error } = await d.from("mp_listings").insert({
      ...row, partner_id: data.partnerId,
      category_slug: p?.category_slugs?.[0] ?? "services",
      listing_type: p?.partner_type === "EVENT_PROVIDER" ? "EVENT" : "SERVICE",
      transaction_type: p?.partner_type === "EVENT_PROVIDER" ? "QUOTE" : "BOOKING",
    });
    return error ? { ok: false, error: "Could not add" } : { ok: true };
  });

export const saveStaffFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, partnerId: z.string().uuid(), id: z.string().uuid().optional(),
    staff: z.object({
      name: z.string().trim().min(2).max(80), title: z.string().max(80).default(""),
      is_active: z.boolean(), off_weekdays: dayArr, off_dates: dateArr,
    }),
  }).parse(d))
  .handler(async ({ data }) => {
    const d = await ownedPartner(data.token, data.partnerId);
    if (!d) return { ok: false, error: "Not allowed" };
    const q = data.id
      ? d.from("mp_staff").update(data.staff).eq("id", data.id).eq("partner_id", data.partnerId)
      : d.from("mp_staff").insert({ ...data.staff, partner_id: data.partnerId });
    const { error } = await q;
    return error ? { ok: false, error: "Could not save" } : { ok: true };
  });

// Admin: link a partner to the supplier phone that manages it.
export const adminLinkPartnerPhoneFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string(), partnerId: z.string().uuid(), phone: z.string().regex(/^\d{10}$/).nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return { ok: false };
    const d = await db();
    await d.from("mp_partners").update({ supplier_phone: data.phone }).eq("id", data.partnerId);
    return { ok: true };
  });

export const adminListMpPartnersFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.token)) return [];
    const d = await db();
    const { data: rows } = await d.from("mp_partners").select("id,name,partner_type,supplier_phone").order("name");
    return (rows ?? []) as { id: string; name: string; partner_type: string; supplier_phone: string | null }[];
  });

// Partner-side bookings: owners see their own bookings and can confirm, cancel or complete them.
export const myPartnerBookingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return [];
    const d = await db();
    const { data: partners } = await d.from("mp_partners").select("id,name").eq("supplier_phone", s.phone);
    if (!partners?.length) return [];
    const ids = partners.map((p: any) => p.id);
    const { data: rows } = await d.from("mp_bookings")
      .select("*, listing:mp_listings(name,icon), staff:mp_staff(name)")
      .in("partner_id", ids).order("booking_date", { ascending: true }).order("start_time", { ascending: true }).limit(300);
    const names = Object.fromEntries(partners.map((p: any) => [p.id, p.name]));
    return (rows ?? []).map((r: any) => ({ ...r, partner_name: names[r.partner_id], customer_phone: r.customer_phone ? `••••••${String(r.customer_phone).slice(-4)}` : null })) as any[];
  });

export const partnerUpdateBookingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tok, id: z.string().uuid(),
    status: z.enum(["PROVIDER_CONFIRMED", "SERVICE_STARTED", "SERVICE_COMPLETED", "CANCELLED"]),
  }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return { ok: false, error: "Not allowed" };
    const d = await db();
    const { data: b } = await d.from("mp_bookings").select("id,partner_id,status").eq("id", data.id).maybeSingle();
    if (!b) return { ok: false, error: "Booking not found" };
    const { data: owner } = await d.from("mp_partners").select("id").eq("id", b.partner_id).eq("supplier_phone", s.phone).maybeSingle();
    if (!owner) return { ok: false, error: "Not allowed" };
    if (b.status === "CANCELLED" || b.status === "SERVICE_COMPLETED") return { ok: false, error: "This booking is already closed" };
    const { error } = await d.from("mp_bookings").update({ status: data.status }).eq("id", data.id);
    if (error) return { ok: false, error: "Could not update" };
    await d.from("mp_booking_status_history").insert({ booking_id: data.id, status: data.status, note: "Updated by partner" });
    return { ok: true };
  });

// AI insights for service/booking businesses, built from the partner's own bookings and listings.
export const partnerServiceInsightsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tok }).parse(d))
  .handler(async ({ data }) => {
    const s = await session(data.token);
    if (!s) return null;
    const d = await db();
    const { data: partners } = await d.from("mp_partners").select("id,name,partner_type").eq("supplier_phone", s.phone);
    if (!partners?.length) return null;
    const ids = partners.map((p: any) => p.id);
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const [{ data: bookings }, { data: listings }] = await Promise.all([
      d.from("mp_bookings").select("status,booking_date,start_time,amount,fee,listing_id,transaction_type,created_at").in("partner_id", ids).gte("created_at", since).limit(2000),
      d.from("mp_listings").select("id,name,price,starting_price,is_active").in("partner_id", ids),
    ]);
    const b = (bookings ?? []) as any[];
    const names: Record<string, string> = Object.fromEntries((listings ?? []).map((l: any) => [l.id, l.name]));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byHour: Record<string, number> = {}, byDay: Record<string, number> = {}, byListing: Record<string, { n: number; rev: number }> = {};
    let revenue = 0, cancelled = 0, completed = 0;
    for (const x of b) {
      if (x.status === "CANCELLED") { cancelled++; continue; }
      if (x.status === "SERVICE_COMPLETED") completed++;
      const amt = Number(x.amount) + Number(x.fee ?? 0); revenue += amt;
      if (x.start_time) { const h = x.start_time.slice(0, 2); byHour[h] = (byHour[h] ?? 0) + 1; }
      if (x.booking_date) { const dd = days[new Date(x.booking_date + "T00:00:00").getDay()]; byDay[dd] = (byDay[dd] ?? 0) + 1; }
      const n = names[x.listing_id] ?? "Other"; byListing[n] = { n: (byListing[n]?.n ?? 0) + 1, rev: (byListing[n]?.rev ?? 0) + amt };
    }
    const top = Object.entries(byListing).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([name, v]) => ({ name, bookings: v.n, revenue: v.rev }));
    const peakHours = Object.entries(byHour).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, n]) => ({ hour: `${h}:00`, bookings: n }));
    const busyDays = Object.entries(byDay).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([day, n]) => ({ day, bookings: n }));
    const unused = (listings ?? []).filter((l: any) => l.is_active && !byListing[l.name]).map((l: any) => l.name).slice(0, 5);
    const stats = { total: b.length, revenue, cancelled, completed, cancelRate: b.length ? Math.round((cancelled / b.length) * 100) : 0, top, peakHours, busyDays, unused };

    let tips: string[] = [];
    if (b.length) {
      try {
        const { createLovableAiGatewayProvider, requireAiKey } = await import("./ai-gateway.server");
        const { generateText } = await import("ai");
        const gateway = createLovableAiGatewayProvider(requireAiKey());
        const r = await generateText({
          model: gateway("google/gemini-3.5-flash"),
          system: "You advise a small Indian service business (salon, home services, events or furniture showroom) on Kartogo. Use only the given numbers. Reply with exactly 4 short, practical tips, one per line, no numbering, no markdown.",
          prompt: `Business: ${partners.map((p: any) => `${p.name} (${p.partner_type})`).join(", ")}\nLast 90 days: ${JSON.stringify(stats)}`,
        });
        tips = r.text.split("\n").map(t => t.replace(/^[-*•\d.\s]+/, "").trim()).filter(Boolean).slice(0, 4);
      } catch (e) { console.error("partner insights ai", e); }
    }
    return { stats, tips };
  });
