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
