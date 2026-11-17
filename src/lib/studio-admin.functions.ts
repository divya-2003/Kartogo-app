import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Kartogo admin view of Partner Studio businesses. Every call checks the
// "partners" admin permission on the server and writes an audit row.

async function admin(token: string) {
  const { requireAdminPermission } = await import("./admin-session.server");
  return requireAdminPermission(token, "partners");
}

export const adminStudioOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    await admin(data.token);
    const { db } = await import("./studio.server");
    const { studioKindOf } = await import("./studio");
    const d = await db();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [{ data: partners }, { data: cats }, { data: bookings }, { data: enquiries }] = await Promise.all([
      d.from("mp_partners").select("id,name,slug,icon,partner_type,category_slugs,supplier_phone,verification_status,account_status,booking_mode,is_active,created_at").order("name"),
      d.from("mp_categories").select("slug,name,group_key,behavior,booking_mode,appointment_types,is_active").order("sort"),
      d.from("mp_bookings").select("partner_id,appointment_status,created_at").gte("created_at", since).limit(10000),
      d.from("mp_enquiries").select("partner_id,status,created_at").gte("created_at", since).limit(10000),
    ]);
    const B = (bookings ?? []) as any[]; const E = (enquiries ?? []) as any[];
    const rows = ((partners ?? []) as any[]).map(p => ({ ...p, kind: studioKindOf(p) })).filter(p => p.kind).map(p => {
      const mine = B.filter(b => b.partner_id === p.id);
      return {
        ...p, supplier_phone: p.supplier_phone ? `••••••${String(p.supplier_phone).slice(-4)}` : null, linked: !!p.supplier_phone,
        stats: {
          total: mine.length, pending: mine.filter(b => b.appointment_status === "PENDING").length,
          completed: mine.filter(b => b.appointment_status === "COMPLETED").length,
          cancelled: mine.filter(b => ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.appointment_status)).length,
          enquiries: E.filter(e => e.partner_id === p.id).length,
        },
      };
    });
    const used = new Set(rows.flatMap(p => p.category_slugs ?? []));
    return { partners: rows, categories: ((cats ?? []) as any[]).filter(c => used.has(c.slug) || c.behavior !== "PRODUCT") };
  });

export const adminUpdateStudioPartnerFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(10), id: z.string().uuid(),
    verification: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    account: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    bookingMode: z.enum(["INSTANT", "SELLER_APPROVAL", "BOOKING_REQUEST"]).nullable().optional(),
    phone: z.string().regex(/^\d{10}$/).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const actor = await admin(data.token);
    const { db } = await import("./studio.server");
    const d = await db();
    const { data: before } = await d.from("mp_partners").select("id,name,verification_status,account_status,booking_mode,is_active,supplier_phone").eq("id", data.id).maybeSingle();
    if (!before) return { ok: false as const, error: "Business not found" };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.verification) patch.verification_status = data.verification;
    if (data.account) { patch.account_status = data.account; if (data.account === "SUSPENDED") patch.is_active = false; }
    if (data.bookingMode !== undefined) patch.booking_mode = data.bookingMode;
    if (data.phone) patch.supplier_phone = data.phone;
    const { error } = await d.from("mp_partners").update(patch).eq("id", data.id);
    if (error) return { ok: false as const, error: "Could not update" };
    const { recordAudit } = await import("./audit.server");
    await recordAudit({ actor, actorRole: "admin", action: "studio.partner.update", entityType: "mp_partner", entityId: data.id, details: {
      name: before.name,
      before: { verification: before.verification_status, account: before.account_status, bookingMode: before.booking_mode, phoneSet: !!before.supplier_phone },
      after: { verification: data.verification, account: data.account, bookingMode: data.bookingMode, phoneChanged: !!data.phone },
    } });
    return { ok: true as const };
  });

export const adminUpdateCategoryConfigFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(10), slug: z.string().min(1).max(60),
    bookingMode: z.enum(["INSTANT", "SELLER_APPROVAL", "BOOKING_REQUEST"]),
    appointmentTypes: z.array(z.string().trim().min(2).max(60)).max(12),
  }).parse(d))
  .handler(async ({ data }) => {
    const actor = await admin(data.token);
    const { db } = await import("./studio.server");
    const d = await db();
    const { data: before } = await d.from("mp_categories").select("booking_mode,appointment_types").eq("slug", data.slug).maybeSingle();
    if (!before) return { ok: false as const, error: "Category not found" };
    const types = Array.from(new Set(data.appointmentTypes));
    const { error } = await d.from("mp_categories").update({ booking_mode: data.bookingMode, appointment_types: types }).eq("slug", data.slug);
    if (error) return { ok: false as const, error: "Could not save" };
    const { recordAudit } = await import("./audit.server");
    await recordAudit({ actor, actorRole: "admin", action: "studio.category.update", entityType: "mp_category", entityId: data.slug, details: { before, after: { booking_mode: data.bookingMode, appointment_types: types } } });
    return { ok: true as const };
  });
