import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Admin view of the AI morning briefings.

async function requireDashboard(token: string) {
  const { resolveAccess } = await import("./admin-session.server");
  const access = await resolveAccess(token);
  if (!access.valid || (!access.isSuperAdmin && !access.permissions.includes("dashboard"))) {
    throw new Error("You don't have access to the dashboard");
  }
}

export type Briefing = { date: string; status: string; summary: string | null; error: string | null; updatedAt: string };

export const latestBriefingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<Briefing[]> => {
    await requireDashboard(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("daily_briefings")
      .select("briefing_date,status,summary,error,updated_at")
      .order("briefing_date", { ascending: false })
      .limit(7);
    return (rows ?? []).map(r => ({ date: r.briefing_date, status: r.status, summary: r.summary, error: r.error, updatedAt: r.updated_at }));
  });

export const generateBriefingNowFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireDashboard(data.token);
    const { runDailyBriefing } = await import("./briefing.server");
    return runDailyBriefing({ force: true });
  });
