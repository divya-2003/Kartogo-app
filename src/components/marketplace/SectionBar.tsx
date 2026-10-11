import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export type SectionId = "shop" | "food" | "health" | "rides" | "beauty" | "home" | "events";

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
  { id: "health", label: "Hospitals & Healthcare", icon: "🏥", subs: [
    ex("Hospitals & Clinics", "🏥", "hospitals-clinics"), ex("Doctor Appointments", "🩺", "doctor-appointments"), ex("Lab Tests & Diagnostics", "🧪", "lab-tests"),
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
  shop: { title: "Shop", sub: "Groceries & daily essentials", cls: "bg-sec-shop text-sec-dark-fg hover:bg-sec-shop hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  food: { title: "Food", sub: "Biryani, tiffins & meal combos", cls: "bg-sec-food text-sec-light-fg hover:bg-sec-food hover:text-sec-light-fg", muted: "text-sec-light-fg/75" },
  health: { title: "Health", sub: "Clinics, doctors & lab tests", cls: "bg-sec-health text-sec-dark-fg hover:bg-sec-health hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  rides: { title: "Rides", sub: "Bike, auto & car · upfront fares", cls: "bg-sec-rides text-sec-dark-fg hover:bg-sec-rides hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  beauty: { title: "Beauty", sub: "Salon, parlour & spa", cls: "bg-sec-beauty text-sec-dark-fg hover:bg-sec-beauty hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  home: { title: "Services", sub: "Cleaning, AC & repairs", cls: "bg-sec-home text-sec-dark-fg hover:bg-sec-home hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
  events: { title: "Events", sub: "Venues, decor & photos", cls: "bg-sec-events text-sec-dark-fg hover:bg-sec-events hover:text-sec-dark-fg", muted: "text-sec-dark-fg/80" },
};

/** Coloured service cards that always fit the screen width (no sideways scrolling). */
export function SectionBar({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  const current = SECTIONS.find(s => s.id === value) ?? SECTIONS[0];
  return (
    <div className="mt-3">
      <div className="grid grid-cols-7 gap-1 pb-2 pt-1 sm:gap-2.5" role="tablist">
        {SECTIONS.map(s => {
          const c = CARD[s.id];
          const active = value === s.id;
          return (
            <Button variant="ghost" key={s.id} type="button" role="tab" aria-selected={active} aria-label={s.label} onClick={() => onChange(s.id)}
              className={`flex h-auto min-w-0 flex-col items-center whitespace-normal rounded-2xl px-0.5 py-2 text-center shadow-pop transition duration-200 sm:h-[7.5rem] sm:items-start sm:rounded-3xl sm:px-3.5 sm:py-3 sm:text-left ${c.cls} ${active ? "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background" : "opacity-75 hover:opacity-100"}`}>
              <span className="text-xl leading-none sm:text-2xl">{s.icon}</span>
              <span className="mt-1 w-full truncate font-display text-[10px] font-extrabold leading-tight sm:mt-2 sm:text-base">{c.title}</span>
              <span className={`mt-0.5 hidden line-clamp-2 min-h-8 text-[11px] font-medium sm:block ${c.muted}`}>{c.sub}</span>
            </Button>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2 sm:flex sm:gap-3" style={{ gridTemplateColumns: `repeat(${current.subs.length}, minmax(0, 1fr))` }}>
        {current.subs.map(sub => (
          <Link key={sub.label} to={sub.to as never} params={sub.params as never} search={sub.search as never} className="flex min-w-0 flex-col items-center gap-1 sm:w-[4.5rem]">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card text-xl shadow-pop sm:h-12 sm:w-12 sm:text-2xl">{sub.icon}</span>
            <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight sm:text-[11px]">{sub.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
