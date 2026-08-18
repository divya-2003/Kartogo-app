// Permanent staff identity (admins, vendors/suppliers, delivery partners).
//
// Every staff member has a permanent `user_id` (UUID) in `staff_accounts`.
// Roles are resolved from the DATABASE — never from a hardcoded phone list.
// The mobile number is only a login credential and can be changed without
// touching any other data, because everything else is keyed to `ref_id`
// (supplier id / driver id) which is pinned to the same `user_id` forever.

export type StaffRole = "admin" | "vendor" | "delivery_partner";

export type StaffAccount = {
  userId: string;
  fullName: string;
  mobileNumber: string;
  role: StaffRole;
  refId: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type Row = {
  user_id: string;
  full_name: string;
  mobile_number: string;
  role: string;
  ref_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const COLS = "user_id, full_name, mobile_number, role, ref_id, status, created_at, updated_at";

const toStaff = (r: Row): StaffAccount => ({
  userId: r.user_id,
  fullName: r.full_name,
  mobileNumber: r.mobile_number,
  role: r.role as StaffRole,
  refId: r.ref_id,
  status: r.status === "inactive" ? "inactive" : "active",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function findStaffByPhone(phone: string): Promise<StaffAccount | null> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("staff_accounts")
    .select(COLS)
    .eq("mobile_number", phone)
    .maybeSingle();
  return data ? toStaff(data as Row) : null;
}

export async function findStaffById(userId: string): Promise<StaffAccount | null> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("staff_accounts")
    .select(COLS)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toStaff(data as Row) : null;
}

export async function findStaffByRef(role: StaffRole, refId: string): Promise<StaffAccount | null> {
  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("staff_accounts")
    .select(COLS)
    .eq("role", role)
    .eq("ref_id", refId)
    .maybeSingle();
  return data ? toStaff(data as Row) : null;
}

/**
 * Idempotently guarantee a staff row exists for a role + stable ref id.
 * Used when the admin adds a new delivery partner, and to self-heal legacy
 * records created before staff accounts existed. Never overwrites an existing
 * mobile number (a staff member may have changed it deliberately).
 */
export async function ensureStaffAccount(input: {
  role: StaffRole;
  refId: string;
  fullName: string;
  mobileNumber: string;
}): Promise<StaffAccount | null> {
  const existing = await findStaffByRef(input.role, input.refId);
  if (existing) return existing;
  const takenByPhone = await findStaffByPhone(input.mobileNumber);
  if (takenByPhone) return takenByPhone;

  const supabaseAdmin = await db();
  const { data } = await supabaseAdmin
    .from("staff_accounts")
    .insert({
      role: input.role,
      ref_id: input.refId,
      full_name: input.fullName,
      mobile_number: input.mobileNumber,
    })
    .select(COLS)
    .maybeSingle();
  return data ? toStaff(data as Row) : null;
}

export const MOBILE_IN_USE = "This mobile number is already in use.";

/**
 * Change ONLY the mobile number of an existing staff account.
 * The user_id, role, ref_id and every row that references them are untouched,
 * so order history, earnings, analytics, notifications and settings survive.
 */
export async function changeStaffMobile(userId: string, newMobile: string, actor?: string): Promise<StaffAccount> {
  const account = await findStaffById(userId);
  if (!account) throw new Error("Account not found");
  if (account.mobileNumber === newMobile) return account;

  const clash = await findStaffByPhone(newMobile);
  if (clash) throw new Error(MOBILE_IN_USE);

  const supabaseAdmin = await db();
  const { data, error } = await supabaseAdmin
    .from("staff_accounts")
    .update({ mobile_number: newMobile })
    .eq("user_id", userId)
    .select(COLS)
    .maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") throw new Error(MOBILE_IN_USE);
    throw new Error("Could not update the mobile number. Please try again.");
  }

  // Audit log — who changed, from what, to what, when.
  const { error: auditError } = await supabaseAdmin.from("mobile_number_changes").insert({
    user_id: userId,
    old_mobile_number: account.mobileNumber,
    new_mobile_number: newMobile,
  });
  if (auditError) {
    console.error("[staff] mobile change audit log failed", {
      userId, role: account.role, actor: actor ?? account.role, error: auditError.message,
    });
  }

  // Keep the delivery roster row in sync so assignments keep resolving.
  if (account.role === "delivery_partner" && account.refId) {
    await supabaseAdmin.from("driver_availability").upsert(
      { driver_id: account.refId, name: account.fullName, phone: newMobile, updated_at: new Date().toISOString() },
      { onConflict: "driver_id" },
    );
  }

  return toStaff(data as Row);
}
