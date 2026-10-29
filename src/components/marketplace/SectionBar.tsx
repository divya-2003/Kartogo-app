import { Button } from "@/components/ui/button";

export type SectionId = "shop" | "food" | "health" | "rides" | "beauty" | "home" | "events";

type Sub = { label: string; icon: string; to: string; params?: Record<string, string>; search?: Record<string, string> };
const ex = (label: string, icon: string, slug: string): Sub => ({ label, icon, to: "/explore/$slug", params: { slug } });

export const SECTIONS: { id: SectionId; label: string; icon: string; subs: Sub[] }[] = [
  { id: "shop", label: "Shop", icon: "🛒", subs: [
    ex("Grocery", "🥬", "grocery"), ex("FMCG", "🧴", "fmcg"), ex("Household", "🧹", "household"),
    ex("Electronics", "📱", "electronics"), ex("Furniture", "🛋️", "furniture"), ex("Beauty Products", "💄", "beauty-products"),
    ex("Clothes", "👕", "clothes"), ex("Pharmacy", "💊", "pharmacy"), ex("Combos", "🎁", "combos"),
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

const CARD: Record<SectionId, { title: string; cls: string }> = {
  shop: { title: "Shop", cls: "bg-sec-shop text-sec-dark-fg hover:bg-sec-shop hover:text-sec-dark-fg" },
  food: { title: "Food", cls: "bg-sec-food text-sec-light-fg hover:bg-sec-food hover:text-sec-light-fg" },
  health: { title: "Health", cls: "bg-sec-health text-sec-dark-fg hover:bg-sec-health hover:text-sec-dark-fg" },
  rides: { title: "Rides", cls: "bg-sec-rides text-sec-dark-fg hover:bg-sec-rides hover:text-sec-dark-fg" },
  beauty: { title: "Beauty", cls: "bg-sec-beauty text-sec-dark-fg hover:bg-sec-beauty hover:text-sec-dark-fg" },
  home: { title: "Services", cls: "bg-sec-home text-sec-dark-fg hover:bg-sec-home hover:text-sec-dark-fg" },
  events: { title: "Events", cls: "bg-sec-events text-sec-dark-fg hover:bg-sec-events hover:text-sec-dark-fg" },
};

/**
 * Seven rounded, coloured pills in ONE line that never scrolls sideways.
 * Each pill grows with its label so longer names ("Services") get more room.
 * Phones stack the icon above the label inside the pill so everything fits;
 * from tablet width up the icon sits beside the label.
 */
export function SectionBar({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  return (
    <div className="mt-3">
      <div className="flex w-full gap-1 pb-2 pt-1 sm:gap-2 lg:gap-3" role="tablist">
        {SECTIONS.map(s => {
          const c = CARD[s.id];
          const active = value === s.id;
          return (
            <Button variant="ghost" size="natural" key={s.id} type="button" role="tab" aria-selected={active} aria-label={s.label} onClick={() => onChange(s.id)}
              className={`flex h-10 min-w-0 flex-auto basis-0 flex-col items-center justify-center gap-px rounded-xl px-1 shadow-pop transition-colors sm:h-12 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 lg:h-14 lg:gap-2 ${c.cls} ${active ? "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100"}`}
              style={{ flexGrow: c.title.length + 3 }}>
              <span className="shrink-0 text-sm leading-none sm:text-lg lg:text-2xl">{s.icon}</span>
              <span className="max-w-full truncate font-display text-[10px] font-extrabold leading-tight sm:text-sm lg:text-base">{c.title}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
