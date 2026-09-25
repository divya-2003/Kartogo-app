import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useLocation } from "@/lib/store";

/** Reuses the customer's saved delivery addresses; falls back to typing one. */
export function AddressField({ value, onChange }: { value: { line: string; landmark?: string }; onChange: (v: { line: string; landmark?: string }) => void }) {
  const { deliveryAddresses, location } = useLocation();
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || value.line) return;
    const first = deliveryAddresses[0]?.address ?? location?.query;
    if (first) onChange({ line: first, landmark: location?.landmark });
  }, [deliveryAddresses, location, touched, value.line, onChange]);
  return (
    <div className="space-y-2">
      {deliveryAddresses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deliveryAddresses.map(a => (
            <button key={a.id} type="button" onClick={() => { setTouched(true); onChange({ line: a.address }); }}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${value.line === a.address ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-start gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <textarea rows={2} value={value.line} onChange={e => { setTouched(true); onChange({ ...value, line: e.target.value }); }}
          placeholder="House / flat, street, area" className="w-full resize-none bg-transparent text-sm outline-none" />
      </label>
      <input value={value.landmark ?? ""} onChange={e => { setTouched(true); onChange({ ...value, landmark: e.target.value }); }}
        placeholder="Landmark / instructions (optional)" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none" />
    </div>
  );
}

export function nextDays(n = 14): { iso: string; day: string; date: string }[] {
  const out = [];
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + i));
    out.push({
      iso: d.toISOString().slice(0, 10),
      day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
      date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
    });
  }
  return out;
}

export function DatePicker({ value, onChange, start = 0 }: { value: string; onChange: (v: string) => void; start?: number }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {nextDays(21).slice(start).map(d => (
        <button key={d.iso} type="button" onClick={() => onChange(d.iso)}
          className={`w-16 shrink-0 rounded-xl border px-2 py-2 text-center ${value === d.iso ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
          <div className="text-[11px] font-semibold opacity-80">{d.day}</div>
          <div className="text-sm font-extrabold">{d.date}</div>
        </button>
      ))}
    </div>
  );
}
