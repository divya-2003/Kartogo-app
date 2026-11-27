import { ShoppingBasket, Shirt, Smartphone, Utensils, HeartPulse, Sparkles, Wrench, Car, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLIDES = [
  { title: "Everyday essentials & more", description: "Groceries, fashion and electronics", icons: [ShoppingBasket, Shirt, Smartphone] },
  { title: "A little care, every day", description: "Restaurants, health and beauty", icons: [Utensils, HeartPulse, Sparkles] },
  { title: "Your neighbourhood, together", description: "Home services, rides and celebrations", icons: [Wrench, Car, CalendarDays] },
];

export function ServiceIntro({ slide, onSkip }: { slide: number; onSkip: () => void }) {
  const content = SLIDES[slide] ?? SLIDES[0];
  if (!content) return null;
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-card px-6 text-center text-foreground">
      <div className="absolute top-8 font-display text-xl font-extrabold text-brand-navy">Kartogo</div>
      <div key={slide} className="animate-service-intro" role="status">
        <div className="mb-9 flex items-center justify-center gap-5 sm:gap-8">
          {content.icons.map((Icon, i) => <span key={i} className={`grid h-16 w-16 place-items-center rounded-2xl sm:h-20 sm:w-20 ${i === 0 ? "bg-leaf/10 text-leaf" : i === 1 ? "bg-sec-food/15 text-sec-beauty" : "bg-sec-home/10 text-sec-home"}`}><Icon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.5} /></span>)}
        </div>
        <h2 className="font-display text-xl font-bold sm:text-2xl">{content.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{content.description}</p>
      </div>
      <div className="absolute bottom-20 flex gap-2" aria-hidden="true">{SLIDES.map((_, i) => <span key={i} className={`h-1.5 w-6 rounded-full ${slide === i ? "bg-brand-navy" : "bg-border"}`} />)}</div>
      <Button variant="ghost" onClick={onSkip} className="absolute bottom-6 text-muted-foreground">Continue to Kartogo</Button>
    </div>
  );
}