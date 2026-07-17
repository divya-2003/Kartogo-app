import { createServerFn } from "@tanstack/react-start";

// ---------------- Dynamic surge pricing ----------------
// Server-authoritative surge configuration. The admin toggles it, customers
// see it in the checkout breakdown, and every placed order snapshots the
// active surge amount + driver share so it can be reported and settled later.

export type SurgeReason = "weather" | "festival" | "high_demand" | "late_night" | "custom";

export type SurgeConfig = {
  enabled: boolean;
  reason: SurgeReason;
  amount: number;              // ₹ added to the delivery fee when enabled
  driverSharePercent: number;  // 0-100 — % of surge paid to the delivery partner
  note: string | null;
  updatedAt: string;
};

type SurgeRow = {
  enabled: boolean;
  reason: string;
  amount: number | string;
  driver_share_percent: number | string;
  note: string | null;
  updated_at: string;
};

const REASONS: SurgeReason[] = ["weather", "festival", "high_demand", "late_night", "custom"];

const DEFAULT_CONFIG: SurgeConfig = {
  enabled: false,
  reason: "high_demand",
  amount: 0,
  driverSharePercent: 50,
  note: null,
  updatedAt: new Date(0).toISOString(),
};

function rowToConfig(r: SurgeRow | null | undefined): SurgeConfig {
  if (!r) return DEFAULT_CONFIG;
  const reason = REASONS.includes(r.reason as SurgeReason) ? (r.reason as SurgeReason) : "custom";
  return {
    enabled: !!r.enabled,
    reason,
    amount: Math.max(0, Number(r.amount) || 0),
    driverSharePercent: Math.min(100, Math.max(0, Number(r.driver_share_percent) || 0)),
    note: r.note ?? null,
    updatedAt: r.updated_at,
  };
}

// Loads the active surge config using the service-role client. Safe to call
// from other server functions (place order, admin dashboard).
export async function loadSurgeConfig(): Promise<SurgeConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("surge_config")
    .select("enabled, reason, amount, driver_share_percent, note, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return DEFAULT_CONFIG;
  return rowToConfig(data as unknown as SurgeRow | null);
}

// Public read: customers need it to render the checkout breakdown. No PII is
// exposed — just the pricing knobs — so this endpoint is intentionally open.
export const getSurgeConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return loadSurgeConfig();
});

// Admin-only write. Verifies the signed admin token before persisting.
export const setSurgeConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    adminToken: string;
    enabled: boolean;
    reason: SurgeReason;
    amount: number;
    driverSharePercent: number;
    note?: string | null;
  }) => {
    if (!REASONS.includes(data?.reason)) throw new Error("Pick a valid surge reason");
    const amount = Math.round(Math.max(0, Number(data?.amount) || 0));
    const share = Math.round(Math.min(100, Math.max(0, Number(data?.driverSharePercent) || 0)));
    if (amount > 500) throw new Error("Surge amount is unusually high — cap it at ₹500");
    return {
      adminToken: String(data?.adminToken ?? ""),
      enabled: !!data?.enabled,
      reason: data.reason,
      amount,
      driverSharePercent: share,
      note: data?.note ? String(data.note).slice(0, 200) : null,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");

    const { data: row, error } = await supabaseAdmin
      .from("surge_config")
      .upsert({
        id: 1,
        enabled: data.enabled,
        reason: data.reason,
        amount: data.amount,
        driver_share_percent: data.driverSharePercent,
        note: data.note,
        updated_at: new Date().toISOString(),
      })
      .select("enabled, reason, amount, driver_share_percent, note, updated_at")
      .maybeSingle();
    if (error || !row) throw new Error("Surge settings could not be saved. Please try again.");
    return rowToConfig(row as unknown as SurgeRow);
  });

export const SURGE_REASON_LABELS: Record<SurgeReason, string> = {
  weather: "Bad weather",
  festival: "Festival demand",
  high_demand: "High demand",
  late_night: "Late night hours",
  custom: "Custom",
};
