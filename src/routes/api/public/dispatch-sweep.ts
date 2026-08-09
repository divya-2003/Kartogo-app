import { createFileRoute } from "@tanstack/react-router";

// Phase 4 — scheduled safety net for the 20-second offer clock.
// Expires stale offers and rolls each order to the next nearest rider even if
// no driver or admin screen is open to trigger the in-request sweep.
export const Route = createFileRoute("/api/public/dispatch-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;
        try {
          const { sweepExpiredOffers } = await import("@/lib/logistics/dispatch.server");
          const swept = await sweepExpiredOffers();
          return Response.json({ ok: true, swept });
        } catch (e) {
          console.error("Dispatch sweep failed", e);
          return Response.json({ ok: false, error: "sweep_failed" }, { status: 500 });
        }
      },
    },
  },
});
