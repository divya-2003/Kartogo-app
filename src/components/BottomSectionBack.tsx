import { useEffect } from "react";
import { backMustReturnHome } from "@/lib/customer-navigation";

/** Bottom-level customer sections return home, regardless of earlier login history. */
export function BottomSectionBack() {
  useEffect(() => {
    let previousPath = window.location.pathname;
    let previousIndex = window.history.state?.__TSR_index ?? 0;
    const sample = () => {
      previousPath = window.location.pathname;
      previousIndex = window.history.state?.__TSR_index ?? previousIndex;
    };
    const onBack = (event: PopStateEvent) => {
      const nextIndex = typeof event.state?.__TSR_index === "number" ? event.state.__TSR_index : previousIndex - 1;
      if (nextIndex >= previousIndex || !backMustReturnHome(previousPath, window.location.pathname, "BACK")) { sample(); return; }
      event.stopImmediatePropagation();
      window.location.replace("/");
    };
    const timer = window.setInterval(sample, 100);
    window.addEventListener("popstate", onBack, { capture: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", onBack, { capture: true });
    };
  }, []);
  return null;
}