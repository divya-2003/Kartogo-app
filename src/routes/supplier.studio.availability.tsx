import { createFileRoute } from "@tanstack/react-router";
import { AvailabilityEditor } from "@/components/studio/AvailabilityEditor";
import { PageHeader } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/availability")({
  component: () => (
    <div>
      <PageHeader title="Availability" crumb="Availability" sub="When customers can book you. Slots, breaks and holidays apply to every service." />
      <AvailabilityEditor />
    </div>
  ),
  head: () => ({ meta: [{ title: "Availability — Partner Studio" }, { name: "description", content: "Set working hours, slots, breaks, holidays and capacity." }] }),
});
