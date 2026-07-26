import { createServerFn } from "@tanstack/react-start";

export type DriverAvailabilityRow = { id: string; name: string; phone: string; active: boolean };

// Admin: full roster with the persisted availability flag applied.
export const listDriverAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<DriverAvailabilityRow[]> => {
    const { verifyAdminToken, DELIVERY_ROSTER } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin.from("driver_availability").select("driver_id, active");
    const overrides = new Map((rows ?? []).map((r) => [r.driver_id, r.active !== false]));
    return DELIVERY_ROSTER.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      active: overrides.has(d.id) ? !!overrides.get(d.id) : d.active,
    }));
  });

// Admin: block / unblock a delivery partner. Blocking only removes portal
// access — all of the rider's past orders and earnings stay intact.
export const setDriverAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; driverId: string; active: boolean }) => ({
    adminToken: String(data?.adminToken ?? ""),
    driverId: String(data?.driverId ?? ""),
    active: !!data?.active,
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken, DELIVERY_ROSTER } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    if (!DELIVERY_ROSTER.some((d) => d.id === data.driverId)) throw new Error("Unknown delivery partner");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("driver_availability")
      .upsert({ driver_id: data.driverId, active: data.active, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not update availability. Please try again.");
    return { ok: true as const, driverId: data.driverId, active: data.active };
  });
