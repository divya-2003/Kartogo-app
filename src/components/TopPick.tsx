import type { ReactNode } from "react";

/**
 * Admin-chosen category picks are only applied as ordering on customer views;
 * customers never see "1st/2nd/3rd pick" labels.
 */
export function TopPick({ children }: { rank?: number; children: ReactNode }) {
  return <>{children}</>;
}
