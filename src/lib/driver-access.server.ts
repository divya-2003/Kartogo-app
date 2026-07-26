// Server-side source of truth for whether a delivery partner may use the
// delivery portal. Admins toggle this from the Delivery team screen; the value
// lives in `driver_availability` so blocking a rider is enforced on every
// request (and never deletes their past orders / earnings history).

export async function isDriverActive(driverId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { DELIVERY_ROSTER } = await import("./auth-tokens.server");

  const { data } = await supabaseAdmin
    .from("driver_availability")
    .select("active")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (data) return data.active !== false;
  // No override row yet → fall back to the roster default.
  return DELIVERY_ROSTER.find((d) => d.id === driverId)?.active ?? false;
}

export const DRIVER_BLOCKED_MESSAGE =
  "Your delivery access is currently turned off by the admin. Please contact the store.";

export async function assertDriverActive(driverId: string): Promise<void> {
  if (!(await isDriverActive(driverId))) throw new Error(DRIVER_BLOCKED_MESSAGE);
}
