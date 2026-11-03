import { createFileRoute } from "@tanstack/react-router";

// Morning business briefing, called by the database scheduler every day at
// 7:00 AM India time. Requires the server-only cron secret.
export const Route = createFileRoute("/api/public/daily-briefing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;
        try {
          const { runDailyBriefing } = await import("@/lib/briefing.server");
          return Response.json(await runDailyBriefing());
        } catch (e) {
          console.error("Daily briefing failed", e);
          return Response.json({ ok: false, error: "briefing_failed" }, { status: 500 });
        }
      },
    },
  },
});
