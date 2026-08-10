import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { ChevronDown, Phone, Search } from "lucide-react";
import { getCountry, getCountryList } from "@/lib/phone";

type Props = {
  country: CountryCode;
  onCountryChange: (iso: CountryCode) => void;
  value: string;
  onValueChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

/** International phone input: flag + dial code selector, then the number. */
export function PhoneNumberInput({
  country,
  onCountryChange,
  value,
  onValueChange,
  autoFocus,
  placeholder = "Enter mobile number",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = getCountry(country);

  const results = useMemo(() => {
    const list = getCountryList();
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dialCode.replace("+", "").startsWith(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setQuery(""); }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country: ${selected.name} (${selected.dialCode})`}
          className="flex shrink-0 items-center gap-1 rounded-lg px-1 py-1 text-sm hover:bg-muted"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-medium text-muted-foreground">{selected.dialCode}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <input
          autoFocus={autoFocus}
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={18}
          value={value}
          onChange={e => onValueChange(e.target.value.replace(/[^\d\s]/g, ""))}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-base outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-pop">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {results.map(c => (
              <li key={c.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso === country}
                  onClick={() => { onCountryChange(c.iso); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${c.iso === country ? "bg-muted font-semibold" : ""}`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">{c.dialCode}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No countries found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
