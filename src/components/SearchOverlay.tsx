import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "@tanstack/react-router";
import { Search, X, ArrowRight } from "lucide-react";
import { useCatalog } from "@/lib/store";
import { rankProducts } from "@/lib/search-rank";
import { useTypewriterPlaceholder } from "@/hooks/use-typewriter";

const SUGGESTIONS = ["avakaya", "maggi", "agarbatti", "batter", "coffee", "tea"];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products } = useCatalog();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const typed = useTypewriterPlaceholder(SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return [];
    return rankProducts(products, query).slice(0, 12);
  }, [products, query]);

  const submit = (term?: string) => {
    const value = (term ?? q).trim();
    if (!value) return;
    nav({ to: "/search", search: { q: value } });
    onClose();
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Search bar header */}
      <div className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 md:px-6">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 shadow-pop"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={typed ? `Search "${typed}"` : "Search for products, categories…"}
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {!query ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Popular searches</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map(term => (
                <button
                  key={term}
                  onClick={() => submit(term)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            Nothing matched “{q}”. Try a different word.
          </div>
        ) : (
          <ul className="space-y-2">
            {results.map(p => (
              <li key={p.id}>
                <Link
                  to="/product/$id"
                  params={{ id: p.id }}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 hover:bg-secondary"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-xl">
                    {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : p.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.unit} · ₹{p.price}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
