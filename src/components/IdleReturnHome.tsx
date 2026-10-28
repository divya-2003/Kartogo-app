import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { isPortalPath, leaveCustomerMode, portalHomeTarget } from "@/lib/portal-mode";

const KEY = "qk_last_active";
const IDLE_MS = 10 * 60_000;

/**
 * Customers who leave the app for 10 minutes start fresh on the home page;
 * partners/admins who were browsing customer pages go back to their own portal.
 * Otherwise back navigation retraces the exact steps they took.
 */
export function IdleReturnHome() {
  const router = useRouter();
  useEffect(() => {
    const touch = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
    const check = () => {
      const last = Number(localStorage.getItem(KEY) || 0);
      const path = window.location.pathname;
      if (last && Date.now() - last > IDLE_MS && !isPortalPath(path)) {
        const portal = portalHomeTarget();
        if (portal) {
          leaveCustomerMode();
          void router.navigate({ to: portal, replace: true });
        } else if (path !== "/") {
          void router.navigate({ to: "/", replace: true });
        }
      }
      touch();
    };
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); else touch(); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    let t = 0;
    const throttled = () => { const n = Date.now(); if (n - t > 15_000) { t = n; touch(); } };
    document.addEventListener("visibilitychange", onVis);
    events.forEach(e => window.addEventListener(e, throttled, { passive: true }));
    const iv = setInterval(check, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); events.forEach(e => window.removeEventListener(e, throttled)); clearInterval(iv); };
  }, [router]);
  return null;
}
