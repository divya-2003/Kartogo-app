import { useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";

// Downscale an uploaded image to keep dataURL size reasonable for the catalog.
async function fileToDataUrl(file: File, maxDim = 800, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ImagePicker({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(value && !value.startsWith("data:") ? value : "");

  async function handleFile(f: File) {
    if (f.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8MB)"); return; }
    try {
      setBusy(true);
      const data = await fileToDataUrl(f);
      onChange(data);
      toast.success("Image updated");
    } catch (e) {
      console.error(e);
      toast.error("Could not read image");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-input bg-background p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Product image</div>
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
          {value ? (
            <>
              <img src={value} alt="preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => { onChange(undefined); setUrl(""); }}
                className="absolute right-0 top-0 rounded-bl-md bg-black/60 p-0.5 text-white"
                aria-label="Remove image"
              ><X className="h-3 w-3" /></button>
            </>
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70 disabled:opacity-50"
          >
            <Upload className="h-3 w-3" /> {busy ? "Uploading..." : "Upload image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="or paste image URL"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => { if (url.trim()) { onChange(url.trim()); toast.success("Image set"); } }}
              className="rounded-md bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground"
            >Set</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MAX_GALLERY_IMAGES = 8;

/** Multi-image picker for the product gallery. First image doubles as the cover. */
export function MultiImagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const images = value.filter(Boolean);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    if (images.length + list.length > MAX_GALLERY_IMAGES) {
      toast.error(`Up to ${MAX_GALLERY_IMAGES} images per product`);
      return;
    }
    try {
      setBusy(true);
      const added: string[] = [];
      for (const f of list) {
        if (f.size > 8 * 1024 * 1024) { toast.error(`"${f.name}" too large (max 8MB)`); continue; }
        added.push(await fileToDataUrl(f));
      }
      if (added.length) { onChange([...images, ...added]); toast.success(`${added.length} image${added.length > 1 ? "s" : ""} added`); }
    } catch (e) {
      console.error(e);
      toast.error("Could not read image");
    } finally { setBusy(false); }
  }

  const removeAt = (i: number) => onChange(images.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-input bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">Product gallery ({images.length}/{MAX_GALLERY_IMAGES})</div>
        <div className="text-[11px] text-muted-foreground">First image is the cover</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            <img src={src} alt={`Product image ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-0 top-0 rounded-br-md bg-primary px-1 text-[9px] font-bold text-primary-foreground">Cover</span>}
            <button type="button" onClick={() => removeAt(i)} aria-label={`Remove image ${i + 1}`}
              className="absolute right-0 top-0 rounded-bl-md bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
            <div className="absolute bottom-0 inset-x-0 flex justify-between bg-black/40 px-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left" className="text-[10px] font-bold text-white disabled:opacity-30">‹</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move right" className="text-[10px] font-bold text-white disabled:opacity-30">›</button>
            </div>
          </div>
        ))}
        {images.length < MAX_GALLERY_IMAGES && (
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary/60 disabled:opacity-50"
            aria-label="Add images">
            <span className="flex flex-col items-center gap-1 text-[10px] font-semibold">
              <ImagePlus className="h-4 w-4" />{busy ? "Adding..." : "Add"}
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
      <div className="mt-2 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="or paste image URL"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
        <button type="button"
          onClick={() => { const u = url.trim(); if (!u) return; if (images.length >= MAX_GALLERY_IMAGES) { toast.error(`Up to ${MAX_GALLERY_IMAGES} images`); return; } onChange([...images, u]); setUrl(""); toast.success("Image added"); }}
          className="rounded-md bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground">Add</button>
      </div>
    </div>
  );
}
