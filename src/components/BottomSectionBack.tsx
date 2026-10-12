import { useEffect } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { backMustReturnHome } from "@/lib/customer-navigation";

/** Bottom-level customer sections return home, regardless of earlier login history. */
export function BottomSectionBack() {
  const router = useRouter();
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next, action }) => backMustReturnHome(current.pathname, next.pathname, action),
    enableBeforeUnload: false,
    withResolver: true,
  });

  useEffect(() => {
    if (blocker.status !== "blocked") return;
    blocker.reset();
    // Let the history adapter cancel the original pop before replacing this section.
    window.setTimeout(() => { void router.navigate({ to: "/", replace: true }); }, 0);
  }, [blocker, router]);
  return null;
}