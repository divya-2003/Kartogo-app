import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MultiImagePicker } from "@/components/ImagePicker";
import { listInventoryFn, saveProductFn, deleteProductFn, setListingActiveFn, updateStockFn } from "@/lib/studio.functions";
import { stockState, type StockState } from "@/lib/studio";
import { useStudio, useStudioQuery } from "@/components/studio/StudioContext";
import { ActiveBadge, ConfirmButton, Empty, ErrorBox, Field, Loading, PageHeader, Pager, StockBadge, Spinner, btnDanger, btnOutline, btnPrimary, inputCls, inr } from "@/components/studio/ui";

export const Route = createFileRoute("/supplier/studio/inventory")({
  component: Inventory,
  head: () => ({ meta: [{ title: "Inventory — Partner Studio" }, { name: "description", content: "Manage furniture products, stock and prices." }] }),
});

type Product = any;
const PER_PAGE = 10;

function Inventory() {
  const { token, partnerId } = useStudio();
  const qc = useQueryClient();
  const q = useStudioQuery("inventory", (a) => listInventoryFn({ data: a }));
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("");
  const [stock, setStock] = useState<"" | StockState>("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [bulk, setBulk] = useState(false);
  const reload = () => { qc.invalidateQueries({ queryKey: ["studio-inventory"] }); qc.invalidateQueries({ queryKey: ["studio-overview"] }); };

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = ((q.data?.products ?? []) as Product[]).filter(p =>
      (!t || `${p.name} ${p.sku ?? ""} ${p.attributes?.brand ?? ""}`.toLowerCase().includes(t)) &&
      (!cat || p.category_slug === cat) && (!stock || stockState(p.stock_qty, p.low_stock_threshold) === stock) &&
      (!status || (status === "active") === p.is_active));
    const by: Record<string, (a: Product, b: Product) => number> = {
      newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      name: (a, b) => a.name.localeCompare(b.name),
      price_asc: (a, b) => Number(a.price) - Number(b.price), price_desc: (a, b) => Number(b.price) - Number(a.price),
      stock_asc: (a, b) => Number(a.stock_qty ?? -1) - Number(b.stock_qty ?? -1),
    };
    return list.sort(by[sort]);
  }, [q.data, term, cat, stock, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((Math.min(page, pages) - 1) * PER_PAGE, Math.min(page, pages) * PER_PAGE);
  const catName = (slug: string) => q.data?.categories.find(c => c.slug === slug)?.name ?? slug;

  const run = async (p: Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    const r = await p.catch(() => ({ ok: false, error: "Network error. Please try again." }));
    if (!r.ok) { toast.error((r as any).error); return false; }
    toast.success(okMsg); reload(); return true;
  };
  const setActive = (ids: string[], active: boolean) => run(setListingActiveFn({ data: { token, partnerId, ids, active } }), active ? "Activated" : "Deactivated").then(ok => ok && setSel(new Set()));
  const quickStock = async (p: Product, v: string) => {
    const qty = Math.round(Number(v));
    if (!Number.isFinite(qty) || qty < 0 || qty === p.stock_qty) return;
    await run(updateStockFn({ data: { token, partnerId, items: [{ id: p.id, qty }] } }), "Stock updated");
  };

  return (
    <div>
      <PageHeader title="Inventory" crumb="Inventory" sub="Products, prices and stock customers see.">
        <button className={btnOutline} onClick={() => setBulk(true)}><Upload className="h-4 w-4" />Bulk stock update</button>
        <button className={btnPrimary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add product</button>
      </PageHeader>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input aria-label="Search products" placeholder="Search name, SKU or brand" value={term} onChange={e => { setTerm(e.target.value); setPage(1); }} className={`${inputCls} lg:col-span-2`} />
        <select aria-label="Category" value={cat} onChange={e => { setCat(e.target.value); setPage(1); }} className={inputCls}><option value="">All categories</option>{q.data?.categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <div className="flex gap-2">
          <select aria-label="Stock" value={stock} onChange={e => { setStock(e.target.value as never); setPage(1); }} className={inputCls}><option value="">Any stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="untracked">Stock not set</option></select>
          <select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value as never); setPage(1); }} className={inputCls}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
        <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className={inputCls}><option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="stock_asc">Lowest stock first</option></select>
      </div>
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 text-sm">
          <b className="px-2">{sel.size} selected</b>
          <button className={btnOutline} onClick={() => setActive([...sel], true)}>Activate</button>
          <button className={btnOutline} onClick={() => setActive([...sel], false)}>Deactivate</button>
          <button className={btnOutline} onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <Empty title={q.data?.products.length ? "No products match" : "No products yet"} body={q.data?.products.length ? "Try a different search or filter." : "Add your first furniture product to start selling."}>
          {!q.data?.products.length && <button className={btnPrimary} onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add product</button>}
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 p-3"><input type="checkbox" aria-label="Select all on page" checked={shown.every(p => sel.has(p.id))} onChange={e => setSel(s => { const n = new Set(s); shown.forEach(p => e.target.checked ? n.add(p.id) : n.delete(p.id)); return n; })} /></th>
                  <th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th><th className="p-3">Quantity</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map(p => (
                  <tr key={p.id}>
                    <td className="p-3"><input type="checkbox" aria-label={`Select ${p.name}`} checked={sel.has(p.id)} onChange={e => setSel(s => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} /></td>
                    <td className="p-3"><div className="flex items-center gap-2">{p.images?.[0] ? <img src={p.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary">{p.icon}</span>}<span className="font-medium">{p.name}</span></div></td>
                    <td className="p-3 text-muted-foreground">{p.sku || "—"}</td>
                    <td className="p-3">{catName(p.category_slug)}{p.subcategory ? <span className="text-muted-foreground"> · {p.subcategory}</span> : null}</td>
                    <td className="p-3 text-right tabular-nums">{inr(Number(p.price ?? 0))}</td>
                    <td className="p-3"><input aria-label={`Stock for ${p.name}`} type="number" min={0} defaultValue={p.stock_qty ?? ""} placeholder="Set" onBlur={e => quickStock(p, e.target.value)} onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm tabular-nums" /></td>
                    <td className="p-3"><StockBadge s={stockState(p.stock_qty, p.low_stock_threshold)} /></td>
                    <td className="p-3"><ActiveBadge on={p.is_active} /></td>
                    <td className="p-3"><div className="flex justify-end gap-1">
                      <button aria-label={`Edit ${p.name}`} className={btnOutline} onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></button>
                      <button aria-label={p.is_active ? "Deactivate" : "Activate"} className={btnOutline} onClick={() => setActive([p.id], !p.is_active)}><Power className="h-4 w-4" /></button>
                      <ConfirmButton title={`Delete ${p.name}?`} body="This removes the product for customers. Products with past orders can only be deactivated." confirmLabel="Delete" className={btnDanger} onConfirm={() => run(deleteProductFn({ data: { token, partnerId, id: p.id } }), "Product deleted")}><Trash2 className="h-4 w-4" /></ConfirmButton>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} onPage={setPage} />
        </>
      )}
      {editing !== undefined && <ProductDialog product={editing} categories={q.data?.categories ?? []} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
      {bulk && <BulkDialog products={q.data?.products ?? []} onClose={() => setBulk(false)} onDone={() => { setBulk(false); reload(); }} />}
    </div>
  );
}

type Variant = { name: string; sku: string; stock: number | null; price: number | null };

function ProductDialog({ product, categories, onClose, onSaved }: { product: Product | null; categories: { slug: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { token, partnerId } = useStudio();
  const a = product?.attributes ?? {};
  const [f, setF] = useState({
    name: product?.name ?? "", sku: product?.sku ?? "", category: product?.category_slug ?? categories[0]?.slug ?? "", subcategory: product?.subcategory ?? "",
    description: product?.description ?? "", images: (product?.images ?? []) as string[], price: product?.price != null ? String(product.price) : "",
    mrp: product?.mrp != null ? String(product.mrp) : "", stock: product?.stock_qty != null ? String(product.stock_qty) : "", low: String(product?.low_stock_threshold ?? 3),
    brand: a.brand ?? "", material: a.material ?? "", colour: a.colour ?? "", dimensions: a.dimensions ?? "", weight: a.weight ?? "",
    delivery: a.delivery_available ?? !!a.delivery, assembly: !!a.assembly, installation: !!a.installation, active: product?.is_active ?? true,
  });
  const [variants, setVariants] = useState<Variant[]>(((product?.variants?.length ? product.variants : (a.variants ?? []).map((n: string) => ({ name: n }))) as any[]).map(v => ({ name: v.name ?? "", sku: v.sku ?? "", stock: v.stock ?? null, price: v.price ?? null })));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(f.price), stock = Math.round(Number(f.stock));
    if (!f.name.trim() || !(price > 0)) return void toast.error("Add a product name and a selling price.");
    if (f.stock === "" || !Number.isFinite(stock) || stock < 0) return void toast.error("Enter the available quantity.");
    if (!f.images.length) return void toast.error("Add at least one photo.");
    setBusy(true);
    const r = await saveProductFn({ data: {
      token, partnerId, id: product?.id ?? null, name: f.name, sku: f.sku, category: f.category, subcategory: f.subcategory, description: f.description,
      images: f.images, price, mrp: f.mrp ? Number(f.mrp) : null, stock, lowStockThreshold: Math.max(0, Math.round(Number(f.low) || 0)),
      brand: f.brand, material: f.material, colour: f.colour, dimensions: f.dimensions, weight: f.weight,
      deliveryAvailable: f.delivery, assemblyAvailable: f.assembly, installationAvailable: f.installation,
      variants: variants.filter(v => v.name.trim()).map(v => ({ name: v.name.trim(), sku: v.sku.trim(), stock: v.stock, price: v.price })), isActive: f.active,
    } }).catch((err) => ({ ok: false as const, error: err instanceof Error && err.message.includes("description") ? "Add a description of at least 10 characters." : "Please check the form and try again." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(product ? "Product updated" : "Product added");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="font-studio max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name *"><input required value={f.name} onChange={set("name")} className={inputCls} /></Field>
            <Field label="SKU"><input value={f.sku} onChange={set("sku")} placeholder="e.g. SOFA-3S-GRY" className={inputCls} /></Field>
            <Field label="Category *"><select value={f.category} onChange={set("category")} className={inputCls}>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
            <Field label="Subcategory"><input value={f.subcategory} onChange={set("subcategory")} placeholder="e.g. Sofas, Beds, Dining" className={inputCls} /></Field>
          </div>
          <Field label="Description *"><textarea required minLength={10} rows={3} value={f.description} onChange={set("description")} className={inputCls} /></Field>
          <Field label="Photos * (up to 8)"><MultiImagePicker value={f.images} onChange={imgs => setF(s => ({ ...s, images: imgs.slice(0, 8) }))} /></Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Selling price (₹) *"><input required type="number" min={1} value={f.price} onChange={set("price")} className={inputCls} /></Field>
            <Field label="MRP (₹)"><input type="number" min={1} value={f.mrp} onChange={set("mrp")} className={inputCls} /></Field>
            <Field label="Available quantity *"><input required type="number" min={0} value={f.stock} onChange={set("stock")} className={inputCls} /></Field>
            <Field label="Low-stock alert at"><input type="number" min={0} value={f.low} onChange={set("low")} className={inputCls} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Brand"><input value={f.brand} onChange={set("brand")} className={inputCls} /></Field>
            <Field label="Material"><input value={f.material} onChange={set("material")} placeholder="e.g. Sheesham wood" className={inputCls} /></Field>
            <Field label="Colour"><input value={f.colour} onChange={set("colour")} className={inputCls} /></Field>
            <Field label="Dimensions"><input value={f.dimensions} onChange={set("dimensions")} placeholder="L × W × H (cm)" className={inputCls} /></Field>
            <Field label="Weight"><input value={f.weight} onChange={set("weight")} placeholder="e.g. 45 kg" className={inputCls} /></Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["delivery", "Home delivery available"], ["assembly", "Assembly available"], ["installation", "Installation available"], ["active", "Visible to customers (active)"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm"><span>{label}</span><Switch checked={f[k] as boolean} onCheckedChange={v => setF(s => ({ ...s, [k]: v }))} /></label>
            ))}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Variants (colour, size, finish)</span>
              <button type="button" className={btnOutline} onClick={() => setVariants(v => [...v, { name: "", sku: "", stock: null, price: null }])}><Plus className="h-4 w-4" />Add variant</button></div>
            {variants.length === 0 ? <p className="text-xs text-muted-foreground">No variants.</p> : (
              <div className="space-y-2">{variants.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input aria-label="Variant name" placeholder="Name e.g. Walnut" value={v.name} onChange={e => setVariants(x => x.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} className={`${inputCls} min-w-[8rem] flex-1`} />
                  <input aria-label="Variant SKU" placeholder="SKU" value={v.sku} onChange={e => setVariants(x => x.map((y, j) => j === i ? { ...y, sku: e.target.value } : y))} className={`${inputCls} w-28`} />
                  <input aria-label="Variant stock" type="number" min={0} placeholder="Stock" value={v.stock ?? ""} onChange={e => setVariants(x => x.map((y, j) => j === i ? { ...y, stock: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) } : y))} className={`${inputCls} w-24`} />
                  <input aria-label="Variant price" type="number" min={0} placeholder="Price" value={v.price ?? ""} onChange={e => setVariants(x => x.map((y, j) => j === i ? { ...y, price: e.target.value === "" ? null : Number(e.target.value) } : y))} className={`${inputCls} w-24`} />
                  <button type="button" aria-label="Remove variant" className={btnOutline} onClick={() => setVariants(x => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                </div>
              ))}</div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className={btnOutline} onClick={onClose}>Cancel</button>
            <button disabled={busy} className={btnPrimary}>{busy && <Spinner />}{product ? "Save changes" : "Add product"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkDialog({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone: () => void }) {
  const { token, partnerId } = useStudio();
  const [mode, setMode] = useState<"table" | "csv">("table");
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(products.map((p: Product) => [p.id, p.stock_qty != null ? String(p.stock_qty) : ""])));
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    let items: { id?: string; sku?: string; qty: number; price?: number }[] = [];
    if (mode === "table") {
      items = products.filter((p: Product) => vals[p.id] !== "" && Number(vals[p.id]) !== p.stock_qty).map((p: Product) => ({ id: p.id, qty: Math.max(0, Math.round(Number(vals[p.id]))) }));
    } else {
      for (const line of csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
        const [sku, qty, price] = line.split(",").map(x => x.trim());
        if (!sku || sku.toLowerCase() === "sku") continue;
        const n = Number(qty);
        if (!Number.isFinite(n) || n < 0) return void toast.error(`Check the quantity for ${sku}`);
        items.push({ sku, qty: Math.round(n), ...(price ? { price: Number(price) } : {}) });
      }
    }
    if (!items.length) return void toast.error("Nothing to update.");
    setBusy(true);
    const r = await updateStockFn({ data: { token, partnerId, bulk: true, items } }).catch(() => ({ ok: false as const, error: "Network error" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`Updated ${r.data.updated} product${r.data.updated === 1 ? "" : "s"}${r.data.missing.length ? ` · not found: ${r.data.missing.join(", ")}` : ""}`);
    onDone();
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="font-studio max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Bulk stock update</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <button className={mode === "table" ? btnPrimary : btnOutline} onClick={() => setMode("table")}>Edit list</button>
          <button className={mode === "csv" ? btnPrimary : btnOutline} onClick={() => setMode("csv")}>Paste CSV</button>
        </div>
        {mode === "table" ? (
          <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {products.map((p: Product) => (
              <label key={p.id} className="flex items-center gap-2 p-2 text-sm"><span className="min-w-0 flex-1 truncate">{p.name}{p.sku ? <span className="text-muted-foreground"> · {p.sku}</span> : null}</span>
                <input type="number" min={0} value={vals[p.id]} onChange={e => setVals(v => ({ ...v, [p.id]: e.target.value }))} className="w-20 rounded-lg border border-input bg-background px-2 py-1 tabular-nums" /></label>
            ))}
          </div>
        ) : (
          <Field label="One product per line: SKU, quantity, price (optional)"><textarea rows={8} value={csv} onChange={e => setCsv(e.target.value)} placeholder={"SOFA-3S-GRY, 12\nBED-QN-WAL, 4, 32999"} className={`${inputCls} font-mono`} /></Field>
        )}
        <div className="flex justify-end gap-2"><button className={btnOutline} onClick={onClose}>Cancel</button><button disabled={busy} onClick={submit} className={btnPrimary}>{busy && <Spinner />}Update stock</button></div>
      </DialogContent>
    </Dialog>
  );
}
