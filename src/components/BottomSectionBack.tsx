import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { backMustReturnHome } from "@/lib/customer-navigation";

/** Bottom-level customer sections return home, regardless of earlier login history. */
export function BottomSectionBack() {
  const router = useRouter();
  useEffect(() => {
    let returnHome = false;
    const unblock = router.history.block({
      enableBeforeUnload: false,
      blockerFn: ({ currentLocation, nextLocation, action }) => {
        if (backMustReturnHome(currentLocation.pathname, "/login", action) ||
            (nextLocation.pathname === "/" && backMustReturnHome(currentLocation.pathname, "/login", "BACK"))) {
          try { sessionStorage.setItem("qk_customer_home", "1"); } catch { /* storage unavailable */ }
        }
        if (!backMustReturnHome(currentLocation.pathname, nextLocation.pathname, action)) return false;
        returnHome = true;
        return true;
      },
    });
    const unsubscribe = router.history.subscribe(() => {
      if (!returnHome) return;
      returnHome = false;
      // Blocking a POP restores its original entry asynchronously. Wait for that
      // restoration before replacing it, rather than racing history.go().
      const onRestored = () => {
        window.removeEventListener("popstate", onRestored);
        void router.navigate({ to: "/", replace: true, ignoreBlocker: true });
      };
      window.addEventListener("popstate", onRestored, { once: true });
    });
    return () => { unblock(); unsubscribe(); };
  }, [router]);
  return null;
}