// Server-only audit trail. Every privileged mutation (status changes, refunds,
// catalogue edits, access changes) should leave a row here.
//
// Writes are best-effort: an audit failure must never break the operation the
// staff member was performing, but it is always logged to the server console.

export type AuditEntry = {
  actor: string;
  actorRole?: "admin" | "supplier" | "driver" | "printer" | "system";
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_audit_log").insert({
      actor: entry.actor.slice(0, 120),
      actor_role: entry.actorRole ?? "admin",
      action: entry.action.slice(0, 80),
      entity_type: entry.entityType.slice(0, 60),
      entity_id: entry.entityId ? String(entry.entityId).slice(0, 120) : null,
      details: entry.details ?? {},
    });
    if (error) console.error("audit write failed", error);
  } catch (e) {
    console.error("audit write failed", e);
  }
}

/** Reads the most recent audit rows. Caller MUST have verified admin access. */
export async function readAudit(limit = 100, entityId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (entityId) q = q.eq("entity_id", entityId);
  const { data, error } = await q;
  if (error) {
    console.error("audit read failed", error);
    return [];
  }
  return data ?? [];
}
