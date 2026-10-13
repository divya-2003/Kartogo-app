import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { backMustReturnHome } from "@/lib/customer-navigation";

/** Bottom-level customer sections return home, regardless of earlier login history. */
export function BottomSectionBack() {
  const router = useRouter();
  useEffect(() => {
    let previousPath = router.history.location.pathname;
    return router.history.subscribe(({ location, action }) => {
      const returnHome = backMustReturnHome(previousPath, location.pathname, action.type);
      previousPath = location.pathname;
      if (returnHome) void router.navigate({ to: "/", replace: true });
    });
  }, [router]);
  return null;
}