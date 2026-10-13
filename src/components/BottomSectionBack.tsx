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
    const originKey = "qk_back_origin";
    const saveOrigin = () => {
      try { sessionStorage.setItem(originKey, window.location.pathname); } catch { /* storage unavailable */ }
    };
    const savedOrigin = () => {
      try { return sessionStorage.getItem(originKey) ?? ""; } catch { return ""; }
    };
    const goHome = () => {
      try { sessionStorage.removeItem(originKey); } catch { /* storage unavailable */ }
      currentPath.current = "/";
      void router.navigate({ to: "/", replace: true });
    };
    const onBack = (event: PopStateEvent) => {
      const previousIndex = currentIndex.current;
      const nextIndex = typeof event.state?.__TSR_index === "number" ? event.state.__TSR_index : previousIndex - 1;
      const sameDocumentBack = nextIndex < previousIndex && backMustReturnHome(currentPath.current, window.location.pathname, "BACK");
      const restoredDocumentBack = backMustReturnHome(savedOrigin(), window.location.pathname, "BACK");
      if (!sameDocumentBack && !restoredDocumentBack) return;
      event.stopImmediatePropagation();
      goHome();
    };
    const onRestore = (event: PageTransitionEvent) => {
      if (event.persisted && backMustReturnHome(savedOrigin(), window.location.pathname, "BACK")) goHome();
    };
    window.addEventListener("pagehide", saveOrigin);
    window.addEventListener("pageshow", onRestore);
    window.addEventListener("popstate", onBack, { capture: true });
    return () => {
      window.removeEventListener("pagehide", saveOrigin);
      window.removeEventListener("pageshow", onRestore);
      window.removeEventListener("popstate", onBack, { capture: true });
    };
  }, [router]);
  return null;
}