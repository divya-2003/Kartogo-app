import { createFileRoute, redirect } from "@tanstack/react-router";

// Live logistics now lives inside the merged Delivery page.
export const Route = createFileRoute("/admin/logistics")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/delivery", search: { tab: "live" } });
  },
});
