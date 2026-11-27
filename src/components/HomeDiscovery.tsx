import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, ArrowRight } from "lucide-react";
import type { MpCategory } from "@/lib/marketplace";
import { listFoodMenusFn } from "@/lib/food-menu.functions";
import type { Kitchen } from "@/lib/food";

export function HomeCategoryStrip({ categories }: { categories: MpCategory[] }) {
  return <nav aria-label="Marketplace categories" className="flex gap-3 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5">
    {categories.map(c => <Link key={c.slug} to="/explore/$slug" params={{ slug: c.slug }} onClick={() => { sessionStorage.setItem(`qk_explore_origin:${c.slug}`, "/"); }} className="flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-card text-2xl sm:h-14 sm:w-14">{c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : c.icon}</span>
      <span className="w-full text-xs font-semibold leading-tight">{c.name}</span>
    </Link>)}
    <Link to="/food" className="flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24"><span className="grid h-12 w-12 place-items-center rounded-xl bg-card text-2xl sm:h-14 sm:w-14">🍽️</span><span className="text-xs font-semibold">Food</span></Link>
    <Link to="/rides" className="flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24"><span className="grid h-12 w-12 place-items-center rounded-xl bg-card text-2xl sm:h-14 sm:w-14">🛺</span><span className="text-xs font-semibold">Rides</span></Link>
  </nav>;
}

export function HomeRestaurants() {
  const menus = useQuery({ queryKey: ["food-menus"], queryFn: async () => (await listFoodMenusFn()).kitchens as Kitchen[], staleTime: 60_000 });
  const kitchens = menus.data ?? [];
  if (!kitchens.length) return null;
  return <section className="mt-7">
    <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">Restaurants</h2><Link to="/food" className="flex items-center gap-1 text-xs font-bold text-primary">View all <ArrowRight className="h-4 w-4" /></Link></div>
    <div className="home-rail">{kitchens.map(k => <Link key={k.id} to="/food" search={{ kitchen: k.id }} className="overflow-hidden rounded-lg border border-border bg-card">
      <img src={k.image} alt={k.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      <div className="p-3"><h3 className="line-clamp-2 text-sm font-bold">{k.name}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{k.cuisine}</p><span className="mt-2 flex items-center gap-1 text-xs font-semibold"><Clock className="h-3 w-3" />{k.eta} min</span></div>
    </Link>)}</div>
  </section>;
}
