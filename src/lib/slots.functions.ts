import { createServerFn } from "@tanstack/react-start";

// Admin-managed delivery time slots used by Standard (non-Quick) orders.

export type DeliverySlot = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: number;
};

// ---------------- Public: the slots a customer can choose ----------------
export const listDeliverySlotsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { includeInactive?: boolean; adminToken?: string }) => ({
    includeInactive: Boolean(data?.includeInactive),
    adminToken: data?.adminToken ? String(data.adminToken) : undefined,
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    const isAdmin = Boolean(data.adminToken && verifyAdminToken(data.adminToken));

    let q = supabaseAdmin
      .from("delivery_slots")
      .select("id, label, start_time, end_time, is_active, sort_order")
      .order("sort_order", { ascending: true });
    if (!(isAdmin && data.includeInactive)) q = q.eq("is_active", true);

    const { data: rows, error } = await q;
    if (error) {
      console.error("Failed to load delivery slots", error);
      return [] as DeliverySlot[];
    }
    return (rows ?? []) as DeliverySlot[];
  });

const time = (v: unknown, fallback: string): string => {
  const s = String(v ?? "").trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s) ? (s.length === 5 ? `${s}:00` : s) : fallback;
};

// ---------------- Admin: create or update a slot ----------------
export const saveDeliverySlotFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    adminToken?: string;
    id?: string;
    label?: string;
    startTime?: string;
    endTime?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: data?.id ? String(data.id) : undefined,
    label: String(data?.label ?? "").trim().slice(0, 60),
    startTime: time(data?.startTime, "08:00:00"),
    endTime: time(data?.endTime, "11:00:00"),
    isActive: data?.isActive !== false,
    sortOrder: Math.max(0, Math.min(99, Math.floor(Number(data?.sortOrder) || 0))),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin access required");
    if (!data.label) throw new Error("Give the slot a name customers will understand");

    const row = {
      label: data.label,
      start_time: data.startTime,
      end_time: data.endTime,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };

    const { error } = data.id
      ? await supabaseAdmin.from("delivery_slots").update(row).eq("id", data.id)
      : await supabaseAdmin.from("delivery_slots").insert(row);

    if (error) {
      console.error("Failed to save delivery slot", error);
      throw new Error("Could not save this time slot. Please try again.");
    }
    return { ok: true };
  });

// ---------------- Admin: remove a slot ----------------
export const deleteDeliverySlotFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string; id?: string }) => ({
    adminToken: String(data?.adminToken ?? ""),
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin access required");
    if (!data.id) throw new Error("Missing slot");
    const { error } = await supabaseAdmin.from("delivery_slots").delete().eq("id", data.id);
    if (error) {
      console.error("Failed to delete delivery slot", error);
      throw new Error("Could not remove this time slot. Please try again.");
    }
    return { ok: true };
  });
