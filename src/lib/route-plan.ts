// Browser-safe stop sequencing for a rider carrying several food orders.
// Rule: collect from each kitchen before any drop; kitchens visited in the
// order their food becomes ready; drops follow pickup order (first collected,
// first delivered) so the oldest food reaches customers first.

export const KITCHEN_NEXT: Record<string, string> = { NEW: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "READY" };
export const MAX_FOOD_STOPS = 3;

export type PlanJob = {
  id: string; order_code: string; status: string; title: string; accepted_at?: string | null;
  details?: { kitchen_id?: string; kitchen_status?: string; address?: { line?: string; landmark?: string } };
};
export type Stop = { jobId: string; code: string; type: "PICKUP" | "DROP"; label: string; query: string; ready: boolean };

export function planStops(jobs: PlanJob[], town = "Ongole"): Stop[] {
  const sorted = [...jobs].sort((a, b) => String(a.accepted_at ?? "").localeCompare(String(b.accepted_at ?? "")));
  const pickups: Stop[] = [];
  const seenKitchen = new Set<string>();
  for (const j of sorted) {
    if (j.status !== "ACCEPTED") continue;
    const k = j.details?.kitchen_id ?? j.title;
    const ready = j.details?.kitchen_status === "READY";
    if (seenKitchen.has(k)) continue;
    seenKitchen.add(k);
    pickups.push({ jobId: j.id, code: j.order_code, type: "PICKUP", label: `Collect at ${j.title}`, query: `${j.title}, ${town}`, ready });
  }
  pickups.sort((a, b) => Number(b.ready) - Number(a.ready));
  const drops: Stop[] = sorted.filter(j => j.status === "ACCEPTED" || j.status === "PICKED_UP").map(j => {
    const a = j.details?.address;
    return { jobId: j.id, code: j.order_code, type: "DROP" as const, label: `Deliver #${j.order_code}`, query: `${a?.line ?? ""}${a?.landmark ? `, ${a.landmark}` : ""}, ${town}`, ready: j.status === "PICKED_UP" };
  });
  return [...pickups, ...drops];
}

/** Google Maps turn-by-turn link through every stop in order. */
export function directionsUrl(stops: Stop[]): string | null {
  if (!stops.length) return null;
  const last = stops[stops.length - 1];
  const mid = stops.slice(0, -1).map(s => s.query).join("|");
  const p = new URLSearchParams({ api: "1", destination: last.query, travelmode: "two-wheeler" });
  if (mid) p.set("waypoints", mid);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}
