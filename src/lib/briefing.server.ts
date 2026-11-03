// Server-only: the morning business briefing written by Lovable AI from
// yesterday's sales, bookings and the tasks still open this morning.
import { z } from "zod";

const IST_OFFSET_MS = 330 * 60_000;

/** Yesterday's date in India (YYYY-MM-DD) and its UTC time window. */
export function yesterdayWindowIST(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - 1));
  const date = y.toISOString().slice(0, 10);
  const from = new Date(y.getTime() - IST_OFFSET_MS).toISOString();
  const to = new Date(y.getTime() + 86_400_000 - IST_OFFSET_MS).toISOString();
  return { date, from, to };
}

export type BriefingStats = {
  date: string;
  orders: { placed: number; delivered: number; cancelled: number; revenue: number; avgOrder: number };
  bookings: { placed: number; confirmed: number; completed: number; cancelled: number; value: number };
  foodRides: { food: number; rides: number; cancelled: number; value: number };
  openTasks: { ordersToFulfil: number; bookingsToConfirm: number; refundRequests: number; restockRequests: number; inventoryAlerts: number; areaRequests: number; partnerApplications: number };
};

type Db = { from: (t: string) => any };

async function count(db: Db, table: string, apply: (q: any) => any): Promise<number> {
  const { count: c } = await apply(db.from(table).select("id", { count: "exact", head: true }));
  return c ?? 0;
}

export async function collectBriefingStats(db: Db, date: string, from: string, to: string): Promise<BriefingStats> {
  const [{ data: orders }, { data: bookings }, { data: service }] = await Promise.all([
    db.from("app_orders").select("status,total").gte("created_at", from).lt("created_at", to).limit(5000),
    db.from("mp_bookings").select("status,amount").gte("created_at", from).lt("created_at", to).limit(5000),
    db.from("service_orders").select("kind,status,amount").gte("created_at", from).lt("created_at", to).limit(5000),
  ]);
  const o = (orders ?? []) as { status: string; total: number }[];
  const earned = o.filter(x => x.status !== "cancelled");
  const revenue = Math.round(earned.reduce((s, x) => s + Number(x.total || 0), 0));
  const b = (bookings ?? []) as { status: string; amount: number }[];
  const sv = (service ?? []) as { kind: string; status: string; amount: number }[];

  const [ordersToFulfil, bookingsToConfirm, refundRequests, restockRequests, inventoryAlerts, areaRequests, partnerApplications] = await Promise.all([
    count(db, "app_orders", q => q.in("status", ["placed", "packed", "out_for_delivery"])),
    count(db, "mp_bookings", q => q.eq("status", "BOOKING_REQUESTED")),
    count(db, "app_orders", q => q.eq("refund_request_status", "pending")),
    count(db, "stock_alerts", q => q.in("status", ["open", "pending", "new"])),
    count(db, "inventory_alerts", q => q.in("status", ["open", "active", "new"])),
    count(db, "unserviceable_requests", q => q.in("status", ["open", "pending", "new"])),
    count(db, "partner_applications", q => q.in("status", ["pending", "new", "submitted"])),
  ]);

  return {
    date,
    orders: {
      placed: o.length,
      delivered: o.filter(x => x.status === "delivered").length,
      cancelled: o.filter(x => x.status === "cancelled").length,
      revenue,
      avgOrder: earned.length ? Math.round(revenue / earned.length) : 0,
    },
    bookings: {
      placed: b.length,
      confirmed: b.filter(x => x.status === "PROVIDER_CONFIRMED").length,
      completed: b.filter(x => x.status === "SERVICE_COMPLETED").length,
      cancelled: b.filter(x => x.status === "CANCELLED").length,
      value: Math.round(b.filter(x => x.status !== "CANCELLED").reduce((s, x) => s + Number(x.amount || 0), 0)),
    },
    foodRides: {
      food: sv.filter(x => x.kind === "FOOD").length,
      rides: sv.filter(x => x.kind === "RIDE").length,
      cancelled: sv.filter(x => x.status === "CANCELLED").length,
      value: Math.round(sv.filter(x => x.status !== "CANCELLED").reduce((s, x) => s + Number(x.amount || 0), 0)),
    },
    openTasks: { ordersToFulfil, bookingsToConfirm, refundRequests, restockRequests, inventoryAlerts, areaRequests, partnerApplications },
  };
}

/**
 * Writes (or rewrites with `force`) the briefing for yesterday. The unique
 * date row doubles as a lock, so two runs never both call the AI.
 */
export async function runDailyBriefing(opts: { force?: boolean } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Db;
  const { date, from, to } = yesterdayWindowIST();

  const { data: existing } = await db.from("daily_briefings").select("id,status,updated_at").eq("briefing_date", date).maybeSingle();
  if (existing) {
    const stale = existing.status === "running" && Date.now() - new Date(existing.updated_at).getTime() > 10 * 60_000;
    if (!opts.force && !stale && existing.status !== "failed") return { date, skipped: true as const };
    // Paused for credits/access: only an admin "Generate now" may try again.
    if (!opts.force && existing.status === "failed") return { date, skipped: true as const };
    await db.from("daily_briefings").update({ status: "running", error: null }).eq("id", existing.id);
  } else {
    const { error } = await db.from("daily_briefings").insert({ briefing_date: date, status: "running" });
    if (error) return { date, skipped: true as const }; // another run holds the lock
  }

  const stats = await collectBriefingStats(db, date, from, to);
  try {
    const { aiObject } = await import("./ai-responses.server");
    const out = await aiObject({
      instructions:
        "You are the operations analyst for Kartogo, a quick-delivery store, restaurant, rides and services marketplace in Ongole, India. " +
        "Write the owner's short morning briefing from yesterday's numbers. Plain, friendly English, Indian rupees (₹), no jargon. " +
        "Do not invent numbers that are not in the data.",
      prompt: `Yesterday (${date}) data:\n${JSON.stringify(stats, null, 2)}\n\n` +
        "Return: a one-line headline; a summary of 3–5 short sentences covering sales, bookings, food & rides and anything unusual; " +
        "and up to 5 concrete actions for today based on the open tasks (skip tasks that are zero).",
      schema: z.object({ headline: z.string(), summary: z.string(), actions: z.array(z.string()) }),
      effort: "low",
    });
    const summary = `${out.headline.trim()}\n\n${out.summary.trim()}${out.actions.length ? `\n\nToday:\n${out.actions.slice(0, 5).map(a => `• ${a.trim()}`).join("\n")}` : ""}`;
    await db.from("daily_briefings").update({ status: "ready", summary, stats, error: null }).eq("briefing_date", date);
    return { date, skipped: false as const, ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Briefing failed";
    await db.from("daily_briefings").update({ status: "failed", stats, error: msg }).eq("briefing_date", date);
    return { date, skipped: false as const, ok: false as const, error: msg };
  }
}
