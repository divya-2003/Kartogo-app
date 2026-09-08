import { useEffect, useState } from "react";
import kartogoLogo from "@/assets/kartogo-logo.png";
import wordmark from "@/assets/kartogo-wordmark.png.asset.json";


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
      className={`fixed inset-0 z-[100] grid place-items-center bg-[#03103b] transition-opacity duration-500 ${
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <img src={kartogoLogo} alt="" width={96} height={96} className="h-24 w-24 animate-splash-pop rounded-3xl bg-[#03103b] object-cover shadow-pop" />
        <img src={wordmark.url} alt="Kartogo" className="mt-4 h-14 w-auto animate-splash-rise object-contain" />

        <div className="mt-1 animate-splash-rise text-sm font-semibold text-white/80 [animation-delay:120ms]">
          Everything You Need, Delivered Fast
        </div>
      </div>
    </div>
  );
}
