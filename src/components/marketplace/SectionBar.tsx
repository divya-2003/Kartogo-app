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

const CARD: Record<SectionId, { title: string; sub: string; cls: string; muted: string }> = {
  shop: { title: "Shop", sub: "Groceries & daily essentials", cls: "bg-sec-shop text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  food: { title: "Food", sub: "Biryani, tiffins & meal combos", cls: "bg-sec-food text-sec-light-fg", muted: "text-sec-light-fg/75" },
  rides: { title: "Rides", sub: "Bike, auto & car · upfront fares", cls: "bg-sec-rides text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  beauty: { title: "Beauty", sub: "Salon, parlour & spa", cls: "bg-sec-beauty text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  home: { title: "Services", sub: "Cleaning, AC & repairs", cls: "bg-sec-home text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  events: { title: "Events", sub: "Venues, decor & photos", cls: "bg-sec-events text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
};

/** Coloured service cards (Shop, Food, Rides…) with the categories of the chosen section. */
export function SectionBar({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  const current = SECTIONS.find(s => s.id === value)!;
  return (
    <div className="mt-3">
      <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 [overscroll-behavior-x:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {SECTIONS.map(s => {
          const c = CARD[s.id];
          const active = value === s.id;
          return (
            <button key={s.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(s.id)}
              className={`flex w-[9.5rem] shrink-0 flex-col items-start rounded-3xl px-3.5 py-3 text-left shadow-pop transition duration-200 ${c.cls} ${active ? "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background" : "opacity-75 hover:opacity-100"}`}>
              <span className="text-2xl leading-none">{s.icon}</span>
              <span className="mt-2 font-display text-base font-extrabold leading-tight">{c.title}</span>
              <span className={`mt-0.5 line-clamp-1 text-[11px] font-medium ${c.muted}`}>{c.sub}</span>
            </button>
          );
        })}
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
