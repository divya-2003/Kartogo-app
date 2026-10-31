// Server-only loader for admin delivery areas.
import type { DeliveryZone } from "./delivery-zones";

export async function loadDeliveryZones(includeInactive = false): Promise<DeliveryZone[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("delivery_zones")
    .select("id, name, keyword, pincode, lat, lng, radius_km, quick_enabled, eta_minutes, is_active")
    .order("name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) {
    console.error("Failed to load delivery zones", error.message);
    return [];
  }
  return (data ?? []).map(r => ({ ...r, radius_km: Number(r.radius_km) })) as DeliveryZone[];
}
