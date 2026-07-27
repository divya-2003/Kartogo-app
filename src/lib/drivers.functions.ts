import { createServerFn } from "@tanstack/react-start";

export type DriverAvailabilityRow = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  shiftType: "full_time" | "part_time";
  shiftStart: string | null;
  shiftEnd: string | null;
  accessRequestedAt: string | null;
};

// Admin: full roster (founding riders + partners the admin added) with the
// persisted availability flag, duty type and shift timings applied.
export const listDriverAvailabilityFn = createServerFn({ method: "POST" })
  .inputValidator((data: { adminToken?: string }) => ({ adminToken: String(data?.adminToken ?? "") }))
  .handler(async ({ data }): Promise<DriverAvailabilityRow[]> => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { listRoster } = await import("./driver-roster.server");
    return listRoster();
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
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { findRosterDriverById } = await import("./driver-roster.server");
    const driver = await findRosterDriverById(data.driverId);
    if (!driver) throw new Error("Unknown delivery partner");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("driver_availability").upsert(
      {
        driver_id: data.driverId,
        active: data.active,
        name: driver.name,
        phone: driver.phone,
        shift_type: driver.shiftType,
        shift_start: driver.shiftStart,
        shift_end: driver.shiftEnd,
        // Granting access clears the pending request.
        access_requested_at: data.active ? null : driver.accessRequestedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) throw new Error("Could not update availability. Please try again.");
    return { ok: true as const, driverId: data.driverId, active: data.active };
  });

// Admin: register a brand new delivery partner. The rider can sign in to the
// delivery portal with this mobile number as soon as they're marked available.
export const addDeliveryPartnerFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    adminToken?: string; name: string; phone: string;
    shiftType: "full_time" | "part_time"; shiftStart?: string; shiftEnd?: string; active?: boolean;
  }) => {
    const name = String(data?.name ?? "").trim().slice(0, 80);
    const phone = String(data?.phone ?? "").replace(/\D/g, "");
    const shiftType = data?.shiftType === "part_time" ? "part_time" : "full_time";
    if (name.length < 2) throw new Error("Enter the delivery partner's name");
    if (!/^\d{10}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
    const shiftStart = String(data?.shiftStart ?? "").slice(0, 10);
    const shiftEnd = String(data?.shiftEnd ?? "").slice(0, 10);
    if (shiftType === "part_time" && (!shiftStart || !shiftEnd)) {
      throw new Error("Add the standard duty timings for a part-time partner");
    }
    return { adminToken: String(data?.adminToken ?? ""), name, phone, shiftType, shiftStart, shiftEnd, active: data?.active !== false };
  })
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { listRoster, driverIdForPhone } = await import("./driver-roster.server");

    const roster = await listRoster();
    if (roster.some((d) => d.phone === data.phone)) {
      throw new Error("A delivery partner with this mobile number already exists");
    }
    const { findSupplierByPhone } = await import("./suppliers");
    if (findSupplierByPhone(data.phone)) throw new Error("This number is already used by a supplier");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("driver_availability").upsert(
      {
        driver_id: driverIdForPhone(data.phone),
        name: data.name,
        phone: data.phone,
        active: data.active,
        shift_type: data.shiftType,
        shift_start: data.shiftType === "part_time" ? data.shiftStart : null,
        shift_end: data.shiftType === "part_time" ? data.shiftEnd : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) throw new Error("Could not add this delivery partner. Please try again.");
    return { ok: true as const, id: driverIdForPhone(data.phone) };
  });

// Admin: edit an existing partner's name / duty type / timings.
export const updateDeliveryPartnerFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    adminToken?: string; driverId: string; name?: string;
    shiftType?: "full_time" | "part_time"; shiftStart?: string; shiftEnd?: string;
  }) => ({
    adminToken: String(data?.adminToken ?? ""),
    driverId: String(data?.driverId ?? ""),
    name: String(data?.name ?? "").trim().slice(0, 80),
    shiftType: data?.shiftType === "part_time" ? ("part_time" as const) : ("full_time" as const),
    shiftStart: String(data?.shiftStart ?? "").slice(0, 10),
    shiftEnd: String(data?.shiftEnd ?? "").slice(0, 10),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("./auth-tokens.server");
    if (!verifyAdminToken(data.adminToken)) throw new Error("Admin authorization required");
    const { findRosterDriverById } = await import("./driver-roster.server");
    const driver = await findRosterDriverById(data.driverId);
    if (!driver) throw new Error("Unknown delivery partner");
    if (data.shiftType === "part_time" && (!data.shiftStart || !data.shiftEnd)) {
      throw new Error("Add the standard duty timings for a part-time partner");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("driver_availability").upsert(
      {
        driver_id: driver.id,
        name: data.name || driver.name,
        phone: driver.phone,
        active: driver.active,
        shift_type: data.shiftType,
        shift_start: data.shiftType === "part_time" ? data.shiftStart : null,
        shift_end: data.shiftType === "part_time" ? data.shiftEnd : null,
        access_requested_at: driver.accessRequestedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) throw new Error("Could not save these details. Please try again.");
    return { ok: true as const };
  });

// Rider: "Request delivery page access". Available to a registered partner whose
// portal access is currently paused — it just raises a flag for the admin.
export const requestDriverAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => ({ phone: String(data?.phone ?? "").replace(/\D/g, "") }))
  .handler(async ({ data }) => {
    const { findRosterDriverByPhone } = await import("./driver-roster.server");
    const driver = await findRosterDriverByPhone(data.phone);
    if (!driver) throw new Error("This number isn't registered as a delivery partner");
    if (driver.active) return { ok: true as const, alreadyActive: true, name: driver.name };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("driver_availability").upsert(
      {
        driver_id: driver.id,
        name: driver.name,
        phone: driver.phone,
        active: false,
        shift_type: driver.shiftType,
        shift_start: driver.shiftStart,
        shift_end: driver.shiftEnd,
        access_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) throw new Error("Could not send your request. Please try again.");
    return { ok: true as const, alreadyActive: false, name: driver.name };
  });

// Public: look up a registered partner by phone (name + access state only).
export const getDriverStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => ({ phone: String(data?.phone ?? "").replace(/\D/g, "") }))
  .handler(async ({ data }) => {
    const { findRosterDriverByPhone } = await import("./driver-roster.server");
    const driver = await findRosterDriverByPhone(data.phone);
    if (!driver) return { found: false as const };
    return {
      found: true as const,
      name: driver.name,
      active: driver.active,
      shiftType: driver.shiftType,
      shiftStart: driver.shiftStart,
      shiftEnd: driver.shiftEnd,
      requested: !!driver.accessRequestedAt,
    };
  });
