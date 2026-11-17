import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { AvailabilityEditor } from "@/components/studio/AvailabilityEditor";
import { LanguageRow } from "@/components/LanguagePicker";
import { useStudio } from "@/components/studio/StudioContext";
import { BOOKING_MODE_LABEL } from "@/lib/studio";
import { useSignOut } from "@/hooks/use-sign-out";
import { Card, PageHeader, btnOutline } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/settings")({
  component: Settings,
  head: () => ({ meta: [{ title: "Settings — Partner Studio" }, { name: "description", content: "Appointment settings, booking mode, language and account." }] }),
});

function Settings() {
  const { me } = useStudio();
  const signOut = useSignOut();
  const furniture = me?.partner.kind === "furniture";
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" crumb="Settings" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Booking mode">
          <p className="text-sm font-semibold">{me ? BOOKING_MODE_LABEL[me.bookingMode] : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">{me?.bookingMode === "INSTANT" ? "Customers' bookings are confirmed straight away." : me?.bookingMode === "BOOKING_REQUEST" ? "Customers send a request with a preferred time; you confirm or suggest a new time." : "New bookings wait for you to accept or reject them."} Kartogo sets this for your category.</p>
        </Card>
        <Card title="Appointment types">
          <div className="flex flex-wrap gap-1.5">{me?.appointmentTypes.map(t => <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{t}</span>)}</div>
        </Card>
        <Card title="Account">
          <p className="text-sm">Signed in as {me?.phone}</p>
          <div className="mt-2"><LanguageRow /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!furniture && <Link to="/supplier/studio/availability" className={btnOutline}>Availability</Link>}
            <button onClick={signOut} className={btnOutline}><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </Card>
      </div>
      {furniture && (
        <>
          <h2 className="pt-2 text-lg font-semibold">Appointment availability</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Working days, slots, breaks, holidays and how many appointments you take at once — for showroom and home visits.</p>
          <AvailabilityEditor showBuffer />
        </>
      )}
    </div>
  );
}
