import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

/** Two side-by-side buttons: phone calendar (.ics with reminders) and Google Calendar. */
export function AddToCalendar({ event, filename, className = "" }: { event: CalendarEvent; filename?: string; className?: string }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => { downloadIcs(event, filename); toast.success("Opening your calendar — reminders are set for 1 day and 1 hour before"); }}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
      >
        <CalendarPlus className="h-4 w-4" /> Phone calendar
      </button>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold"
      >
        <CalendarPlus className="h-4 w-4" /> Google Calendar
      </a>
    </div>
  );
}
