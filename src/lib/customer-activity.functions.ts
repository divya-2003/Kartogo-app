import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { groupCustomerActivity, type ActivityEvent, type CustomerActivity } from "./customer-activity";

// Admin "Customers" section: every tracked customer action (clicks, views,
// cart adds, checkouts) grouped per shopper, plus deletion from customer_events.

const MAX_EVENTS = 10000;

export const customerActivityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ adminToken: z.string().min(10).max(800), days: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data }): Promise<{ customers: CustomerActivity[]; productNames: Record<string, string>; totalEvents: number; truncated: boolean }> => {
    const { requireAdminPermission } = await import("./admin-session.server");
    await requireAdminPermission(data.adminToken, "customers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin.from("customer_events")
      .select("id, phone, session_id, event_type, product_id, category, order_id, search_query, metadata, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_EVENTS);
    if (error) throw new Error("Customer activity could not be loaded");
    const events = (rows ?? []) as unknown as ActivityEvent[];
    const phones = [...new Set(events.map(e => e.phone).filter((p): p is string => !!p))];
    const names: Record<string, string> = {};
    for (let i = 0; i < phones.length; i += 200) {
      const { data: people } = await supabaseAdmin.from("customers").select("phone, name").in("phone", phones.slice(i, i + 200));
      for (const p of people ?? []) if (p.phone && p.name) names[p.phone] = p.name;
    }
    // Names for local-store products (mp:<listingId>); catalog names are resolved in the browser.
    const productNames: Record<string, string> = {};
    const listingIds = [...new Set(events.map(e => e.product_id ?? "").filter(id => /^mp:[0-9a-f-]{36}$/.test(id)).map(id => id.slice(3)))];
    for (let i = 0; i < listingIds.length; i += 200) {
      const { data: rows } = await supabaseAdmin.from("mp_listings").select("id, name").in("id", listingIds.slice(i, i + 200));
      for (const r of rows ?? []) productNames[`mp:${r.id}`] = r.name;
    }
    return { customers: groupCustomerActivity(events, names), productNames, totalEvents: events.length, truncated: events.length >= MAX_EVENTS };
  });

const deleteSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("events"), adminToken: z.string().min(10).max(800), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ mode: z.literal("customer"), adminToken: z.string().min(10).max(800), phone: z.string().max(20).nullable(), sessionIds: z.array(z.string().max(80)).max(200) }),
  z.object({ mode: z.literal("all"), adminToken: z.string().min(10).max(800) }),
]);

export const deleteCustomerEventsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAdminPermission } = await import("./admin-session.server");
    const actor = await requireAdminPermission(data.adminToken, "customers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = () => supabaseAdmin.from("customer_events");
    let deleted = 0;
    if (data.mode === "events") {
      const { count, error } = await table().delete({ count: "exact" }).in("id", data.ids);
      if (error) throw new Error("Could not delete these actions");
      deleted = count ?? 0;
    } else if (data.mode === "customer") {
      if (!data.phone && !data.sessionIds.length) throw new Error("Nothing to delete");
      if (data.phone) {
        const { count, error } = await table().delete({ count: "exact" }).eq("phone", data.phone);
        if (error) throw new Error("Could not delete this customer's activity");
        deleted += count ?? 0;
      }
      if (data.sessionIds.length) {
        const { count, error } = await table().delete({ count: "exact" }).is("phone", null).in("session_id", data.sessionIds);
        if (error) throw new Error("Could not delete this customer's activity");
        deleted += count ?? 0;
      }
    } else {
      const { count, error } = await table().delete({ count: "exact" }).not("id", "is", null);
      if (error) throw new Error("Could not delete customer activity");
      deleted = count ?? 0;
    }
    try {
      const { recordAudit } = await import("./audit.server");
      await recordAudit({ actor, actorRole: "admin", action: `customer_events.delete_${data.mode}`, entityType: "customer_events", entityId: data.mode === "customer" ? (data.phone ?? "guest") : data.mode, details: { deleted } });
    } catch { /* audit is best-effort */ }
    return { deleted };
  });
