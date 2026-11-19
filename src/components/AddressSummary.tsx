import { MapPin } from "lucide-react";

/**
 * One saved-address line, shared by the location sheet and checkout so both
 * show addresses the same way: label chip, area, Quick / Standard badge and
 * the full address underneath.
 */
export function AddressSummary({ label, area, address, zone }: {
  label?: string | null;
  area: string;
  address: string;
  /** "quick" / "standard" badge; omit when the area isn't known. */
  zone?: "quick" | "standard" | null;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {label && (
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">{label}</span>
          )}
          <span className="truncate text-sm font-semibold">{area}</span>
          {zone && (
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${zone === "quick" ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}`}>
              {zone === "quick" ? "Quick available" : "Standard only"}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{address}</span>
      </span>
    </span>
  );
}
