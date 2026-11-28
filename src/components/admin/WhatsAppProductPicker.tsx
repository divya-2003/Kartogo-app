import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PromoProduct } from "@/lib/whatsapp-promo.shared";

export function WhatsAppProductPicker({ products, value, onChange, label, disabled }: { products: PromoProduct[]; value: string; onChange: (id: string) => void; label: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const selected = products.find(p => p.id === value);
  const matching = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button aria-label={label} aria-expanded={open} role="combobox" variant="outline" disabled={disabled} className="w-full justify-between"><span className="truncate">{selected?.name ?? "Select a product"}</span><ChevronDown /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-2">
      <Input aria-label="Search active products" placeholder="Search products or categories" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <div role="listbox" aria-label="Active products" className="mt-2 max-h-64 overflow-y-auto">
        {matching.slice((page - 1) * 50, page * 50).map(p => <Button key={p.id} role="option" aria-selected={p.id === value} variant="ghost" className="h-auto w-full justify-between whitespace-normal px-2 py-2 text-left" onClick={() => { onChange(p.id); setOpen(false); }}><span>{p.name}<span className="block text-xs text-muted-foreground">{p.category} · ₹{p.price}</span></span>{p.id === value && <Check />}</Button>)}
        {!matching.length && <p className="p-3 text-sm text-muted-foreground">No active products match.</p>}
      </div>
      {matching.length > 50 && <div className="mt-2 flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs">{page} / {Math.ceil(matching.length / 50)}</span><Button variant="outline" size="sm" disabled={page * 50 >= matching.length} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
    </PopoverContent>
  </Popover>;
}