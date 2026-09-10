import { useEffect, useState } from "react";
import kartogoLogo from "@/assets/kartogo-logo.png";
import wordmark from "@/assets/kartogo-wordmark-cropped.png";


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
      <div className="flex -translate-y-3 flex-col items-center px-6 text-center sm:-translate-y-5">
        <img src={kartogoLogo} alt="" width={104} height={104} className="h-24 w-24 animate-splash-pop rounded-3xl object-cover sm:h-26 sm:w-26" />
        <img src={wordmark} alt="Kartogo" className="mt-5 w-48 max-w-[72vw] animate-splash-rise object-contain sm:w-56" />
        <div className="mt-1.5 animate-splash-rise font-sans text-sm font-semibold text-brand-white/80 [animation-delay:120ms] sm:text-base">
          Everything You Need, Delivered Fast
        </div>
      </div>
    </div>
  );
}
