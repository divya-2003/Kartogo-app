import { useEffect, useState } from "react";
import { Zap, Bike } from "lucide-react";
import kartogoLogo from "@/assets/kartigo-logo.png.asset.json";

/**
 * Animated launch screen. Shows once per browser session while the app boots
 * (auth restore + role detection happen behind it), then fades away.
 * Role redirection itself lives in the routes — the splash only holds the
 * first paint so users never see the customer home flash before redirecting.
 */
export function SplashScreen({ minDurationMs = 1800 }: { minDurationMs?: number }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("qk_splash_shown")) { setPhase("gone"); return; }
    sessionStorage.setItem("qk_splash_shown", "1");
    const t1 = setTimeout(() => setPhase("out"), minDurationMs);
    const t2 = setTimeout(() => setPhase("gone"), minDurationMs + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minDurationMs]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] grid place-items-center bg-gradient-to-b from-[oklch(0.93_0.08_70)] to-background transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <img src={kartogoLogo.url} alt="" width={96} height={96} className="h-24 w-24 animate-splash-pop rounded-3xl object-contain shadow-pop" />
        <div className="mt-4 animate-splash-rise font-display text-4xl font-extrabold tracking-tight text-foreground">Kartogo</div>
        <div className="mt-1 flex animate-splash-rise items-center gap-1.5 text-sm font-semibold text-muted-foreground [animation-delay:120ms]">
          <Zap className="h-4 w-4 fill-saffron text-saffron" /> Ongole's 15-minute neighbourhood store
        </div>

        {/* delivery scooter zipping across the road */}
        <div className="relative mt-8 h-10 w-64 overflow-hidden">
          <div className="absolute bottom-1 left-0 h-0.5 w-full rounded bg-foreground/15" />
          <Bike className="absolute bottom-1.5 h-8 w-8 animate-splash-ride text-primary" />
        </div>

        <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full w-1/3 animate-splash-loader rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
