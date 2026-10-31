import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeliveryZone } from "./delivery-zones";

// Admin control of Quick delivery and delivery time per area / map point.

async function requireDeliveryAdmin(token: string) {
  const { resolveAccess } = await import("./admin-session.server");
  const access = await resolveAccess(token);
  if (!access.valid || (!access.isSuperAdmin && !access.permissions.includes("delivery"))) {
    throw new Error("You don't have access to delivery settings");
  }
}

export const listDeliveryZonesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ adminToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<DeliveryZone[]> => {
    await requireDeliveryAdmin(data.adminToken);
    const { loadDeliveryZones } = await import("./delivery-zones.server");
    return loadDeliveryZones(true);
  });

const zoneSchema = z.object({
  adminToken: z.string().min(1),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  keyword: z.string().trim().max(80).nullable().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  radiusKm: z.number().min(0.1).max(50).default(1),
  quickEnabled: z.boolean(),
  etaMinutes: z.number().int().min(5).max(24 * 60),
  isActive: z.boolean().default(true),
});

export const saveDeliveryZoneFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => zoneSchema.parse(d))
  .handler(async ({ data }) => {
    await requireDeliveryAdmin(data.adminToken);
    const hasPoint = data.lat != null && data.lng != null;
    if ((data.lat == null) !== (data.lng == null)) throw new Error("Enter both latitude and longitude, or leave both empty");
    const row = {
      name: data.name,
      keyword: data.keyword ? data.keyword.toLowerCase() : null,
      pincode: data.pincode || null,
      lat: hasPoint ? data.lat! : null,
      lng: hasPoint ? data.lng! : null,
      radius_km: data.radiusKm,
      quick_enabled: data.quickEnabled,
      eta_minutes: data.etaMinutes,
      is_active: data.isActive,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = data.id
      ? await supabaseAdmin.from("delivery_zones").update(row).eq("id", data.id)
      : await supabaseAdmin.from("delivery_zones").insert(row);
    if (error) {
      console.error("saveDeliveryZone", error.message);
      throw new Error("Couldn't save this area. Please try again.");
    }
    const { recordAudit } = await import("./audit.server");
    await recordAudit({
      actor: "admin",
      action: data.id ? "delivery_zone.update" : "delivery_zone.create",
      entityType: "delivery_zones",
      entityId: data.id ?? data.name,
      details: { quick: data.quickEnabled, eta: data.etaMinutes, lat: row.lat, lng: row.lng, radius: data.radiusKm },
    }).catch(() => {});
    return { ok: true as const };
  });

export const deleteDeliveryZoneFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ adminToken: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireDeliveryAdmin(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("delivery_zones").delete().eq("id", data.id);
    if (error) throw new Error("Couldn't remove this area.");
    return { ok: true as const };
  });
