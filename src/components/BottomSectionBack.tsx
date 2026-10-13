import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { backMustReturnHome } from "@/lib/customer-navigation";

/** Bottom-level customer sections return home, regardless of earlier login history. */
export function BottomSectionBack() {
  const router = useRouter();
  const path = useRouterState({ select: state => state.location.pathname });
  const currentPath = useRef(path);
  const currentIndex = useRef(0);
  currentPath.current = path;
  useEffect(() => {
    currentIndex.current = router.history.location.state.__TSR_index;
  }, [path, router]);
  useEffect(() => {
    const onBack = (event: PopStateEvent) => {
      const previousIndex = currentIndex.current;
      const nextIndex = typeof event.state?.__TSR_index === "number" ? event.state.__TSR_index : previousIndex - 1;
      if (nextIndex >= previousIndex || !backMustReturnHome(currentPath.current, window.location.pathname, "BACK")) return;
      event.stopImmediatePropagation();
      currentPath.current = "/";
      void router.navigate({ to: "/", replace: true });
    };
    window.addEventListener("popstate", onBack, { capture: true });
    return () => window.removeEventListener("popstate", onBack, { capture: true });
  }, [router]);
  return null;
}