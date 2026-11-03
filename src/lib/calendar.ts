// Booking reminders for the customer's own phone/computer calendar.
// An .ics file opens straight in the device calendar app (iPhone, Android,
// Outlook, Mac) with two reminders; Google Calendar gets a one-tap link.

export type CalendarEvent = {
  uid: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h, India time). Defaults to 10:00. */
  start?: string | null;
  end?: string | null;
  /** Minutes when no end time is known. */
  durationMin?: number;
  location?: string | null;
  description?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parts(e: CalendarEvent) {
  const [y, m, d] = e.date.split("-").map(Number);
  const [sh, sm] = (e.start || "10:00").slice(0, 5).split(":").map(Number);
  let eh: number, em: number;
  if (e.end) [eh, em] = e.end.slice(0, 5).split(":").map(Number);
  else {
    const total = sh * 60 + sm + (e.durationMin ?? 60);
    eh = Math.floor(total / 60) % 24; em = total % 60;
  }
  const stamp = (h: number, mi: number) => `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(mi)}00`;
  return { start: stamp(sh, sm), end: stamp(eh, em) };
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** iCalendar text with India time and reminders 1 day and 1 hour before. */
export function buildIcs(e: CalendarEvent): string {
  const { start, end } = parts(e);
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const alarm = (trigger: string, text: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kartogo//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:Asia/Kolkata", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0530", "TZOFFSETTO:+0530", "TZNAME:IST", "END:STANDARD", "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${e.uid}@kartogo`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...alarm("-P1D", `Tomorrow: ${e.title}`),
    ...alarm("-PT1H", `In 1 hour: ${e.title}`),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** Google Calendar "add event" link (opens the app on Android phones). */
export function googleCalendarUrl(e: CalendarEvent): string {
  const { start, end } = parts(e);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${start}/${end}`,
    ctz: "Asia/Kolkata",
    ...(e.location ? { location: e.location } : {}),
    ...(e.description ? { details: e.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Saves the .ics so the phone opens it in its calendar app. */
export function downloadIcs(e: CalendarEvent, filename = "kartogo-booking.ics") {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
