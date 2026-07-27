// Server-side delivery-partner roster.
//
// The three founding riders live in DELIVERY_ROSTER (auth-tokens.server.ts).
// Any partner the admin adds later is stored in `driver_availability`, which
// also carries the availability flag, duty type and shift timings for everyone.
// This module is the single place that merges both sources.

export type ShiftType = "full_time" | "part_time";

export type RosterEntry = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  shiftType: ShiftType;
  shiftStart: string | null;
  shiftEnd: string | null;
  accessRequestedAt: string | null;
};

type Row = {
  driver_id: string;
  active: boolean | null;
  name: string | null;
  phone: string | null;
  shift_type: string | null;
  shift_start: string | null;
  shift_end: string | null;
  access_requested_at: string | null;
};

export const ROSTER_COLUMNS =
  "driver_id, active, name, phone, shift_type, shift_start, shift_end, access_requested_at";

export const driverIdForPhone = (phone: string) => `dp${phone}`;

export async function listRoster(): Promise<RosterEntry[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { DELIVERY_ROSTER } = await import("./auth-tokens.server");

  const { data } = await supabaseAdmin.from("driver_availability").select(ROSTER_COLUMNS);
  const rows = (data ?? []) as Row[];
  const byId = new Map(rows.map((r) => [r.driver_id, r]));

  const base: RosterEntry[] = DELIVERY_ROSTER.map((d) => {
    const r = byId.get(d.id);
    return {
      id: d.id,
      name: r?.name || d.name,
      phone: r?.phone || d.phone,
      active: r ? r.active !== false : d.active,
      shiftType: (r?.shift_type === "part_time" ? "part_time" : "full_time") as ShiftType,
      shiftStart: r?.shift_start ?? null,
      shiftEnd: r?.shift_end ?? null,
      accessRequestedAt: r?.access_requested_at ?? null,
    };
  });

  const staticIds = new Set(base.map((d) => d.id));
  const added: RosterEntry[] = rows
    .filter((r) => !staticIds.has(r.driver_id) && !!r.phone && !!r.name)
    .map((r) => ({
      id: r.driver_id,
      name: r.name as string,
      phone: r.phone as string,
      active: r.active !== false,
      shiftType: (r.shift_type === "part_time" ? "part_time" : "full_time") as ShiftType,
      shiftStart: r.shift_start,
      shiftEnd: r.shift_end,
      accessRequestedAt: r.access_requested_at,
    }));

  return [...base, ...added];
}

export async function findRosterDriverByPhone(phone: string): Promise<RosterEntry | null> {
  const roster = await listRoster();
  return roster.find((d) => d.phone === phone) ?? null;
}

export async function findRosterDriverById(id: string): Promise<RosterEntry | null> {
  const roster = await listRoster();
  return roster.find((d) => d.id === id) ?? null;
}
