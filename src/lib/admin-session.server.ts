// Server-only admin session helpers shared by several server functions.
// They live in a .server file (not a .functions file) so the browser bundle
// never pulls in the token signing code.
import { ADMIN_FEATURES, type AdminPermission } from "./admin-access.shared";

const permissionValues = ADMIN_FEATURES.map((feature) => feature.key) as AdminPermission[];

type AccessRow = { user_id: string; is_super_admin: boolean; permissions: string[] };

export type AdminSessionAccess = {
  valid: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
};

/** Server-verified admin identity + permissions for a signed admin token. */
export async function resolveAccess(token: string): Promise<AdminSessionAccess> {
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

/** Records one admin session event (login, logout, page view). Best-effort. */
export async function recordAdminSessionEvent(token: string, action: "login" | "logout" | "page_view", path?: string) {
  const { readAdminToken } = await import("./auth-tokens.server");
  const session = readAdminToken(token);
  if (!session) return;
  const { recordAudit } = await import("./audit.server");
  await recordAudit({
    actor: session.userId ?? "main-admin",
    actorRole: "admin",
    action: `admin.${action}`,
    entityType: "admin_session",
    entityId: session.userId ?? "main-admin",
    details: path ? { path: path.slice(0, 160) } : {},
  });
}
