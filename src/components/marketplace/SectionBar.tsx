import { Link } from "@tanstack/react-router";

export type SectionId = "shop" | "food" | "rides" | "beauty" | "home" | "events";

type Sub = { label: string; icon: string; to: string; params?: Record<string, string>; search?: Record<string, string> };
const ex = (label: string, icon: string, slug: string): Sub => ({ label, icon, to: "/explore/$slug", params: { slug } });

export const SECTIONS: { id: SectionId; label: string; icon: string; subs: Sub[] }[] = [
  { id: "shop", label: "Shop", icon: "🛒", subs: [
    ex("Grocery", "🥬", "grocery"), ex("FMCG", "🧴", "fmcg"), ex("Household", "🧹", "household"),
    ex("Electronics", "📱", "electronics"), ex("Furniture", "🛋️", "furniture"), ex("Beauty Products", "💄", "beauty-products"),
  ] },
  { id: "food", label: "Food", icon: "🍛", subs: [
    { label: "Restaurants", icon: "🍽️", to: "/food" }, { label: "Meals", icon: "🍱", to: "/food", search: { q: "meals" } },
    { label: "Snacks", icon: "🥟", to: "/food", search: { q: "snack" } }, { label: "Bakery", icon: "🥐", to: "/food", search: { q: "bakery" } },
    { label: "Beverages", icon: "🥤", to: "/food", search: { q: "beverage" } },
  ] },
  { id: "rides", label: "Rides", icon: "🛺", subs: [
    { label: "Auto", icon: "🛺", to: "/rides", search: { type: "auto" } }, { label: "Cab", icon: "🚕", to: "/rides", search: { type: "cab" } },
    { label: "Scheduled Ride", icon: "🗓️", to: "/rides", search: { type: "scheduled" } },
    { label: "Airport / Railway Station", icon: "🚉", to: "/rides", search: { type: "station" } },
    { label: "Rental / Hourly", icon: "⏱️", to: "/rides", search: { type: "rental" } },
    { label: "Bike Ride", icon: "🏍️", to: "/rides", search: { type: "bike" } },
  ] },
  { id: "beauty", label: "Beauty & Wellness", icon: "💇", subs: [
    ex("Salon", "💇", "salon"), ex("Beauty Parlor", "💅", "beauty-parlour"), ex("Spa", "🧖", "spa"), ex("Home Salon", "🏠", "home-salon"), ex("Makeup", "💄", "makeup"),
  ] },
  { id: "home", label: "Home Services", icon: "🛠️", subs: [
    ex("Cleaning", "🧽", "cleaning"), ex("Plumbing", "🚰", "plumbing"), ex("Electrical", "💡", "electrical"), ex("AC Service", "❄️", "ac-service"), ex("Appliance Repair", "🔧", "appliance-repair"),
  ] },
  { id: "events", label: "Events", icon: "🎉", subs: [
    ex("Event Venues", "🏛️", "event-venues"), ex("Decorations", "🎈", "decorations"), ex("Photography", "📸", "photography"), ex("Catering", "🍲", "catering"),
    ex("Makeup Artists", "💋", "makeup-artists"), ex("DJs", "🎧", "djs"), ex("Event Equipment", "🔊", "event-equipment"),
  ] },
];

/** Top section tabs (Shop, Food, Rides…) with the categories of the chosen section. */
export function SectionBar({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  const current = SECTIONS.find(s => s.id === value)!;
  return (
    <div className="mt-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {SECTIONS.map(s => (
          <button key={s.id} role="tab" aria-selected={value === s.id} onClick={() => onChange(s.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition ${value === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {current.subs.map(sub => (
          <Link key={sub.label} to={sub.to as never} params={sub.params as never} search={sub.search as never} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-2xl shadow-pop">{sub.icon}</span>
            <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight">{sub.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
