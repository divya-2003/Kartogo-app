import { createFileRoute } from "@tanstack/react-router";

// Scheduled daily AI analysis. Called by the database scheduler (pg_cron) with
// the project's anon key in the `apikey` header. It only writes forecasts,
// insights and notifications — it never changes inventory.
export const Route = createFileRoute("/api/public/ai-daily-forecast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runAnalysis } = await import("@/lib/ai-ops.server");
          const result = await runAnalysis();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("Daily AI analysis failed", e);
          return Response.json({ ok: false, error: "analysis_failed" }, { status: 500 });
        }
      },
    },
  },
});
