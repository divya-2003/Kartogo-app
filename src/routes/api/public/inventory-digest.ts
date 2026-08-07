import { createFileRoute } from "@tanstack/react-router";

// Scheduled inventory alert digest — low stock, out of stock and supplier
// reminders fanned out to in-app and SMS recipients.
// Called by the database scheduler (pg_cron) with the project's anon key.
export const Route = createFileRoute("/api/public/inventory-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = verifyCronRequest(request);
        if (denied) return denied;
        try {
          const { dispatchInventoryDigest } = await import("@/lib/notify.server");
          return Response.json({ ok: true, ...(await dispatchInventoryDigest()) });
        } catch (e) {
          console.error("Inventory digest failed", e);
          return Response.json({ ok: false, error: "digest_failed" }, { status: 500 });
        }
      },
    },
  },
});
