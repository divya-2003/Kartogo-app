import { useEffect, useState } from "react";
import kartogoWordmark from "@/assets/kartogo-reference-wordmark.png";

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
      className={`fixed inset-0 z-[100] grid place-items-center bg-brand-navy transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <img src={kartogoWordmark} alt="Kartogo" className="h-auto w-full max-w-[320px] animate-splash-pop object-contain brightness-0 invert sm:max-w-[390px]" />
        <div className="mt-3 animate-splash-rise text-sm font-semibold text-brand-on-navy/80 [animation-delay:120ms]">
          Everything You Need, Delivered Fast
        </div>
      </div>
    </div>
  );
}
