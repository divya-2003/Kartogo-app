import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_FEATURES, permissionForAdminPath, type AdminPermission } from "./admin-access.shared";
import { canonicalPhone, normalizeIncomingPhone } from "./phone";

const permissionValues = ADMIN_FEATURES.map((feature) => feature.key) as [AdminPermission, ...AdminPermission[]];
const permissionSchema = z.enum(permissionValues);
const tokenSchema = z.string().min(1).max(800);

type AccessRow = { user_id: string; is_super_admin: boolean; permissions: string[] };

export type AdminSessionAccess = {
  valid: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
};

export type SubAdmin = {
  userId: string;
  fullName: string;
  mobileNumber: string;
  status: "active" | "inactive";
  permissions: AdminPermission[];
  createdAt: string;
};

async function resolveAccess(token: string): Promise<AdminSessionAccess> {
  const { readAdminToken } = await import("./auth-tokens.server");
  const session = readAdminToken(token);
  if (!session) return { valid: false, userId: null, isSuperAdmin: false, permissions: [] };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!session.userId) {
    return { valid: true, userId: null, isSuperAdmin: true, permissions: [] };
  }
  const { data: staff } = await supabaseAdmin
    .from("staff_accounts")
    .select("user_id, status, role")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!staff || staff.role !== "admin" || staff.status !== "active") {
    return { valid: false, userId: session.userId, isSuperAdmin: false, permissions: [] };
  }
  const { data } = await supabaseAdmin
    .from("admin_access")
    .select("user_id, is_super_admin, permissions")
    .eq("user_id", session.userId)
    .maybeSingle();
  const access = data as AccessRow | null;
  if (!access) return { valid: false, userId: session.userId, isSuperAdmin: false, permissions: [] };
  return {
    valid: true,
    userId: session.userId,
    isSuperAdmin: access.is_super_admin,
    permissions: (access.permissions ?? []).filter((permission): permission is AdminPermission =>
      permissionValues.includes(permission as AdminPermission),
    ),
  };
}

async function requireSuperAdmin(token: string) {
  const access = await resolveAccess(token);
  if (!access.valid || !access.isSuperAdmin) throw new Error("Only the main admin can manage sub-admins");
  return access;
}

export const verifyAdminAccessFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema, path: z.string().max(160) }).parse(input))
  .handler(async ({ data }) => {
    const access = await resolveAccess(data.token);
    const required = permissionForAdminPath(data.path);
    return { ...access, allowed: access.valid && (access.isSuperAdmin || access.permissions.includes(required)) };
  });

export const listSubAdminsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }): Promise<{ admins: SubAdmin[] }> => {
    await requireSuperAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff, error } = await supabaseAdmin
      .from("staff_accounts")
      .select("user_id, full_name, mobile_number, status, created_at, admin_access!inner(is_super_admin, permissions)")
      .eq("role", "admin")
      .eq("admin_access.is_super_admin", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load sub-admins");
    return {
      admins: (staff ?? []).map((row: any) => ({
        userId: row.user_id,
        fullName: row.full_name,
        mobileNumber: row.mobile_number,
        status: row.status === "inactive" ? "inactive" : "active",
        permissions: (row.admin_access?.permissions ?? []) as AdminPermission[],
        createdAt: row.created_at,
      })),
    };
  });

const detailsSchema = z.object({
  token: tokenSchema,
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().min(6).max(30),
  permissions: z.array(permissionSchema).max(ADMIN_FEATURES.length),
});

export const createSubAdminFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => detailsSchema.parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin(data.token);
    const phone = canonicalPhone(data.phone) ?? normalizeIncomingPhone(data.phone);
    if (!/^\d{8,15}$/.test(phone)) throw new Error("Enter a valid mobile number");
    const { findStaffByPhone } = await import("./staff.server");
    if (await findStaffByPhone(phone)) throw new Error("This mobile number is already in use");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff, error } = await supabaseAdmin
      .from("staff_accounts")
      .insert({ full_name: data.fullName, mobile_number: phone, role: "admin", status: "active" })
      .select("user_id")
      .single();
    if (error || !staff) throw new Error("Could not create the sub-admin");
    const { error: accessError } = await supabaseAdmin.from("admin_access").insert({
      user_id: staff.user_id,
      is_super_admin: false,
      permissions: Array.from(new Set(data.permissions)),
    });
    if (accessError) {
      await supabaseAdmin.from("staff_accounts").delete().eq("user_id", staff.user_id);
      throw new Error("Could not save feature access");
    }
    return { ok: true as const };
  });

export const updateSubAdminFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    token: tokenSchema,
    userId: z.string().uuid(),
    status: z.enum(["active", "inactive"]),
    permissions: z.array(permissionSchema).max(ADMIN_FEATURES.length),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireSuperAdmin(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("admin_access")
      .select("is_super_admin")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!target || target.is_super_admin) throw new Error("This account cannot be changed here");
    const { error: staffError } = await supabaseAdmin
      .from("staff_accounts")
      .update({ status: data.status })
      .eq("user_id", data.userId)
      .eq("role", "admin");
    const { error: accessError } = await supabaseAdmin
      .from("admin_access")
      .update({ permissions: Array.from(new Set(data.permissions)) })
      .eq("user_id", data.userId);
    if (staffError || accessError) throw new Error("Could not update the sub-admin");
    return { ok: true as const };
  });