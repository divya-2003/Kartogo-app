import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Admin usage analytics. Every admin session event (login, logout, page view)
// is written to the audit trail with the admin's permanent staff id, so the
// dashboard can show who used the admin area, when, and where.

const ENTITY = "admin_session";
const tokenSchema = z.string().min(1).max(800);

/** Records one session event for the admin holding `token`. Best-effort. */
async function recordAdminSessionEvent(token: string, action: "login" | "logout" | "page_view", path?: string) {
  const { recordAdminSessionEvent: record } = await import("./admin-session.server");
  await record(token, action, path);
}

export const logAdminActivityFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tokenSchema,
    event: z.enum(["login", "logout", "page_view"]),
    path: z.string().max(160).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await recordAdminSessionEvent(data.token, data.event, data.path);
    return { ok: true as const };
  });

export type AdminUsageRow = {
  id: string;
  name: string;
  phone: string;
  isSuperAdmin: boolean;
  status: "active" | "inactive";
  logins: number;
  logouts: number;
  pageViews: number;
  activeDays: number;
  lastLogin: string | null;
  lastLogout: string | null;
  lastSeen: string | null;
  topPages: { path: string; views: number }[];
};

export type AdminUsage = {
  days: number;
  rows: AdminUsageRow[];
  recent: { id: string; name: string; action: "login" | "logout"; at: string }[];
};

/** Usage per admin for the last `days` days. Main admin sees everyone; a sub-admin sees only themselves. */
export const adminUsageAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema, days: z.number().int().min(1).max(90).default(30) }).parse(d))
  .handler(async ({ data }): Promise<AdminUsage> => {
    const { resolveAccess } = await import("./admin-session.server");
    const access = await resolveAccess(data.token);
    if (!access.valid) throw new Error("Admin authorization required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    let q = supabaseAdmin
      .from("admin_audit_log")
      .select("id, actor, action, details, created_at")
      .eq("entity_type", ENTITY)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!access.isSuperAdmin) q = q.eq("actor", access.userId ?? "-");
    const { data: events, error } = await q;
    if (error) throw new Error("Could not load usage analytics");

    // Every admin account (so admins with zero activity still show up).
    const { data: accessRows } = await supabaseAdmin.from("admin_access").select("user_id, is_super_admin");
    const ids = (accessRows ?? []).map(r => r.user_id).filter(id => access.isSuperAdmin || id === access.userId);
    const { data: staff } = ids.length
      ? await supabaseAdmin.from("staff_accounts").select("user_id, full_name, mobile_number, status").in("user_id", ids)
      : { data: [] as { user_id: string; full_name: string; mobile_number: string; status: string }[] };
    const superIds = new Set((accessRows ?? []).filter(r => r.is_super_admin).map(r => r.user_id));

    const rows = new Map<string, AdminUsageRow & { days: Set<string>; pages: Map<string, number> }>();
    const blank = (id: string, name: string, phone: string, isSuper: boolean, status: "active" | "inactive") => ({
      id, name, phone, isSuperAdmin: isSuper, status, logins: 0, logouts: 0, pageViews: 0, activeDays: 0,
      lastLogin: null, lastLogout: null, lastSeen: null, topPages: [], days: new Set<string>(), pages: new Map<string, number>(),
    });
    for (const s of staff ?? []) {
      rows.set(s.user_id, blank(s.user_id, s.full_name, s.mobile_number, superIds.has(s.user_id), s.status === "inactive" ? "inactive" : "active"));
    }
    if (access.isSuperAdmin && !rows.has("main-admin")) rows.set("main-admin", blank("main-admin", "Main admin (passcode)", "—", true, "active"));

    const recent: AdminUsage["recent"] = [];
    for (const e of events ?? []) {
      const r = rows.get(e.actor) ?? (() => { const n = blank(e.actor, "Removed admin", "—", false, "inactive"); rows.set(e.actor, n); return n; })();
      const at = e.created_at as string;
      if (!r.lastSeen || at > r.lastSeen) r.lastSeen = at;
      r.days.add(at.slice(0, 10));
      if (e.action === "admin.login") { r.logins++; if (!r.lastLogin || at > r.lastLogin) r.lastLogin = at; }
      else if (e.action === "admin.logout") { r.logouts++; if (!r.lastLogout || at > r.lastLogout) r.lastLogout = at; }
      else if (e.action === "admin.page_view") {
        r.pageViews++;
        const path = String((e.details as { path?: string } | null)?.path ?? "/admin");
        r.pages.set(path, (r.pages.get(path) ?? 0) + 1);
      }
      if ((e.action === "admin.login" || e.action === "admin.logout") && recent.length < 30) {
        recent.push({ id: e.id as string, name: r.name, action: e.action === "admin.login" ? "login" : "logout", at });
      }
    }

    const out = [...rows.values()].map(({ days, pages, ...r }) => ({
      ...r,
      activeDays: days.size,
      topPages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([path, views]) => ({ path, views })),
    }));
    out.sort((a, b) => Number(a.isSuperAdmin) - Number(b.isSuperAdmin) || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
    return { days: data.days, rows: out, recent };
  });
