import { useEffect, useState } from "react";
import kartogoWordmark from "@/assets/kartogo-wordmark-transparent.png.asset.json";
import { useRouterState } from "@tanstack/react-router";
import { homeRedirectTarget } from "@/lib/portal-mode";
import { ServiceIntro } from "@/components/ServiceIntro";

/**
 * Animated launch screen. Shows once per browser session while the app boots
 * (auth restore + role detection happen behind it), then fades away.
 * Role redirection itself lives in the routes — the splash only holds the
 * first paint so users never see the customer home flash before redirecting.
 */
export function SplashScreen({ minDurationMs = 1800 }: { minDurationMs?: number }) {
  const [phase, setPhase] = useState<"in" | "intro" | "out" | "gone">("in");
  const [slide, setSlide] = useState(0);
  const [introStarted, setIntroStarted] = useState(false);
  const path = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("qk_splash_shown")) { setPhase("gone"); return; }
    const showIntro = path === "/" && !homeRedirectTarget() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = showIntro ? minDurationMs + 3300 : minDurationMs;
    const timers = [
      setTimeout(() => { setIntroStarted(showIntro); setPhase(showIntro ? "intro" : "out"); }, minDurationMs),
      setTimeout(() => setPhase("out"), duration),
      setTimeout(() => { sessionStorage.setItem("qk_splash_shown", "1"); setPhase("gone"); }, duration + 400),
    ];
    if (showIntro) {
      timers.push(setTimeout(() => setSlide(1), minDurationMs + 1100));
      timers.push(setTimeout(() => setSlide(2), minDurationMs + 2200));
    }
    return () => timers.forEach(clearTimeout);
  }, [minDurationMs, path]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] grid place-items-center bg-brand-navy transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {introStarted ? <ServiceIntro slide={slide} onSkip={() => { sessionStorage.setItem("qk_splash_shown", "1"); setPhase("gone"); }} /> : <div className="flex flex-col items-center px-6 text-center">
        <img src={kartogoWordmark.url} alt="Kartogo" className="h-auto w-full max-w-[320px] animate-splash-pop object-contain sm:max-w-[390px]" />
        <div className="mt-3 animate-splash-rise text-sm font-semibold text-brand-on-navy/80 [animation-delay:120ms]">
          Everything You Need, Delivered Fast
        </div>
      </div>}
    </div>
  );
}
