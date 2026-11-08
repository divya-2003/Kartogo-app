import type { ReactNode } from "react";
import { rankLabel } from "@/lib/category-ranks";

/** Wraps a product card with a small "1st pick" ribbon above it. */
export function TopPick({ rank, children }: { rank?: number; children: ReactNode }) {
  if (!rank) return <>{children}</>;
  return (
    <div className="relative flex flex-col pt-2.5">
      <span className="absolute left-3 top-0 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground shadow-pop">{rankLabel(rank)} pick</span>
      {children}
    </div>
  );
}
