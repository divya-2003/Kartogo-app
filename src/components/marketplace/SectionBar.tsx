import { Button } from "@/components/ui/button";
import { ShoppingBag, UtensilsCrossed, HeartPulse, Car, Sparkles, Wrench, PartyPopper } from "lucide-react";

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

const CARD = {
  shop: { sub: "Groceries & essentials", icon: ShoppingBag },
  food: { sub: "Meals, tiffins & bakery", icon: UtensilsCrossed },
  health: { sub: "Clinics, doctors & labs", icon: HeartPulse },
  rides: { sub: "Auto, cab & scheduled", icon: Car },
  beauty: { sub: "Salon, parlour & spa", icon: Sparkles },
  home: { sub: "Cleaning, AC & repairs", icon: Wrench },
  events: { sub: "Venues, decor & photos", icon: PartyPopper },
};

/** Native mobile snapping; the top area stays in normal document flow. */
export function SectionBar({ value, onChange }: { value: SectionId; onChange: (v: SectionId) => void }) {
  return (
    <div className="mt-3">
      <div className="section-strip flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-3 lg:grid lg:grid-cols-7 lg:gap-2.5" role="tablist" aria-label="Shopping and services">
        {SECTIONS.map(s => {
          const c = CARD[s.id];
          const Icon = c.icon;
          const active = value === s.id;
          return (
            <Button variant="ghost" size="natural" key={s.id} type="button" role="tab" aria-selected={active} aria-label={s.label} onClick={() => onChange(s.id)}
              data-section={s.id}
              className="section-card relative flex min-h-40 w-36 shrink-0 snap-start flex-col items-start justify-start gap-2 rounded-lg border p-3 text-left lg:w-auto lg:min-w-0">
              <span className="section-icon grid h-10 w-10 shrink-0 place-items-center rounded-lg"><Icon className="size-5" /></span>
              <span className="w-full whitespace-normal font-display text-sm font-extrabold leading-5">{s.label}</span>
              <span className="section-subtitle mt-auto w-full whitespace-normal text-[11px] font-medium leading-4">{c.sub}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
