import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "./calendar";
import { yesterdayWindowIST } from "./briefing.server";

const booking = { uid: "b1", title: "Haircut — Kartogo (KB123)", date: "2026-11-05", start: "16:30", end: "17:15", location: "Magunta Layout, Ongole" };

describe("booking calendar reminders", () => {
  it("puts the booking at its India time", () => {
    const ics = buildIcs(booking);
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261105T163000");
    expect(ics).toContain("DTEND;TZID=Asia/Kolkata:20261105T171500");
  });
  it("reminds 1 day and 1 hour before", () => {
    const ics = buildIcs(booking);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT1H");
  });
  it("uses a one-hour slot when no end time is known", () => {
    expect(buildIcs({ ...booking, end: null })).toContain("DTEND;TZID=Asia/Kolkata:20261105T173000");
  });
  it("builds a Google Calendar link for the same slot", () => {
    expect(googleCalendarUrl(booking)).toContain("dates=20261105T163000%2F20261105T171500");
  });
});

describe("morning briefing day", () => {
  it("covers yesterday in India time, even just after midnight UTC", () => {
    // 1 Nov 01:30 UTC = 1 Nov 07:00 IST → briefing for 31 Oct IST.
    const w = yesterdayWindowIST(new Date("2026-11-01T01:30:00Z"));
    expect(w.date).toBe("2026-10-31");
    expect(w.from).toBe("2026-10-30T18:30:00.000Z");
    expect(w.to).toBe("2026-10-31T18:30:00.000Z");
  });
});
