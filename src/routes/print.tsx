import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/store";
import {
  ChevronLeft,
  Home,
  LayoutGrid,
  TrendingUp,
  Printer,
  ShieldCheck,
  Upload,
  FileText,
  IdCard,
  Image as ImageIcon,
  HelpCircle,
  ChevronRight,
  Zap,
  Minus,
  Plus,
  IndianRupee,
  X,

} from "lucide-react";
import { PRINT_SERVICES, createPrintJobFn, listMyPrintJobsFn, type PrintJob } from "@/lib/print.functions";

export const Route = createFileRoute("/print")({
  component: PrintStorePage,
  head: () => ({
    meta: [
      { title: "Print Store — Kartogo Ongole" },
      { name: "description", content: "Print documents, passport photos and glossy photo prints with Kartogo — securely deleted after printing and delivered in minutes across Ongole." },
    ],
  }),
});

type ServiceKey = keyof typeof PRINT_SERVICES;

type Service = {
  key: ServiceKey;
  title: string;
  Icon: typeof FileText;
  tint: string;
  lines: string[];
  cta: string;
};

const SERVICES: Service[] = [
  {
    key: "documents",
    title: "Documents",
    Icon: FileText,
    tint: "bg-primary/10 text-primary",
    lines: ["A4 prints — Black & White or Colour", "Single side prints starting at ₹2/page", "PDF files only"],
    cta: "Upload new files",
  },
  {
    key: "passport",
    title: "Passport Photos",
    Icon: IdCard,
    tint: "bg-leaf/10 text-leaf",
    lines: ["Kodak Glossy Paper", "Sets of 8, 16, 32", "JPG or PNG photos"],
    cta: "Order passport photos",
  },
  {
    key: "photos",
    title: "Photos",
    Icon: ImageIcon,
    tint: "bg-saffron/15 text-saffron",
    lines: ["Kodak Glossy Paper", "4 size options", "JPG or PNG photos"],
    cta: "Order photo prints",
  },
];

// Fulfilment milestones shown as a horizontal stepper on each print job.
const PRINT_STEPS: { key: string; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "printing", label: "Printing" },
  { key: "ready", label: "Ready for pickup" },
  { key: "collected", label: "Handed to rider" },
];

function PrintJobTracker({ status }: { status: string }) {
  const current = Math.max(0, PRINT_STEPS.findIndex(s => s.key === status));
  return (
    <div className="mt-3">
      <div className="flex items-start">
        {PRINT_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className={`relative grid h-4 w-4 place-items-center rounded-full border-2 ${
                    active ? "border-leaf bg-leaf" : done ? "border-primary bg-primary" : "border-border bg-card"
                  }`}
                >
                  {active && <span className="absolute inset-0 rounded-full bg-leaf/50 animate-ping" aria-hidden />}
                </span>
                <span className={`text-center text-[10px] font-semibold leading-tight ${active ? "text-leaf" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {i < PRINT_STEPS.length - 1 && (
                <span className={`mt-2 h-0.5 w-4 shrink-0 sm:w-8 ${i < current ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function PrintStorePage() {
  const { customerToken, user } = useAuth();
  const [openService, setOpenService] = useState<ServiceKey | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  const loadJobs = async () => {
    if (!customerToken) { setJobs([]); return; }
    try { setJobs(await listMyPrintJobsFn({ data: { token: customerToken } })); } catch { /* offline */ }
  };
  useEffect(() => { void loadJobs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customerToken]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-7xl lg:px-8">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold">Print Store</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-7xl lg:px-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-[oklch(0.9_0.07_70)] to-card p-6 text-center shadow-pop">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-background">
            <Printer className="h-7 w-7" />
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-none tracking-tight">
            Kartogo <span className="text-primary">Prints</span>
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Fast, affordable printing — delivered to your door
          </p>
        </div>

        {/* Security note */}
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold shadow-pop">
          <ShieldCheck className="h-5 w-5 shrink-0 text-leaf" />
          <span>Your documents are securely deleted after printing</span>
        </div>

        {/* Services */}
        <div className="mt-4 space-y-3">
          {SERVICES.map(s => (
            <div key={s.key} className="rounded-3xl border border-border bg-card p-5 shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-extrabold">{s.title}</h3>
                  <ul className="mt-2 space-y-1">
                    {s.lines.map(line => (
                      <li key={line} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-primary">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${s.tint}`}>
                  <s.Icon className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenService(s.key)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-pop transition hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" /> {s.cta}
                </button>
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf/10 px-3 py-1 text-[11px] font-bold text-leaf">
                  <Zap className="h-3 w-3" /> {PRINT_SERVICES[s.key].hint}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* My print jobs */}
        {jobs.length > 0 && (
          <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-pop">
            <h3 className="font-display text-lg font-extrabold">My print jobs</h3>
            <ul className="mt-3 space-y-3">
              {jobs.map(j => (
                <li key={j.id} className="rounded-2xl bg-secondary/50 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate font-semibold">{j.fileName}</span>
                    <span className="text-xs text-muted-foreground">{j.copies} cop{j.copies === 1 ? "y" : "ies"}</span>
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {PRINT_STEPS.find(s => s.key === j.status)?.label ?? j.status}
                    </span>
                  </div>
                  <PrintJobTracker status={j.status} />
                </li>
              ))}
            </ul>

          </div>
        )}

        {/* FAQ */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-pop">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-extrabold">Have questions?</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Please read the FAQs before printing or get in touch with our support team for more details.
          </p>
          <Link
            to="/support"
            className="mt-3 inline-flex items-center gap-1 rounded-2xl border border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
          >
            Browse our FAQs <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {openService && (
        <UploadModal
          service={openService}
          token={customerToken}
          defaultAddress={user?.address ?? ""}
          onClose={() => setOpenService(null)}
          onUploaded={async () => { setOpenService(null); await loadJobs(); }}
        />
      )}

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 lg:max-w-7xl">
          <Link to="/" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/categories" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <LayoutGrid className="h-5 w-5" /> Categories
          </Link>
          <Link to="/search" search={{ q: "" }} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-muted-foreground">
            <TrendingUp className="h-5 w-5" /> Trending
          </Link>
          <Link to="/print" className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-primary">
            <Printer className="h-5 w-5" /> Print Store
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ---------------- Pricing ----------------
// Flat, transparent rates shown live as the customer configures the job.
const RATE_BW = 2;      // ₹ per page, black & white
const RATE_COLOR = 10;  // ₹ per page, colour
const DELIVERY_FEE = 15; // flat, added once per order

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Count pages in a PDF without pulling in a parser — the page objects are
// plain markers in the raw file body.
async function countPdfPages(file: File): Promise<number> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    let text = "";
    for (let i = 0; i < buf.length; i += 65536) {
      text += String.fromCharCode(...buf.subarray(i, Math.min(i + 65536, buf.length)));
    }
    const counts = text.match(/\/Type\s*\/Page[^s]/g);
    if (counts?.length) return counts.length;
    const fromKids = text.match(/\/Count\s+(\d+)/);
    return fromKids ? Math.max(1, Number(fromKids[1])) : 1;
  } catch {
    return 1;
  }
}

function UploadModal({
  service, token, defaultAddress, onClose, onUploaded,
}: {
  service: ServiceKey;
  token: string | null;
  defaultAddress: string;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const cfg = PRINT_SERVICES[service];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [colorMode, setColorMode] = useState<"bw" | "color">(service === "documents" ? "bw" : "color");
  const [copies, setCopies] = useState(1);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState(defaultAddress);
  const [busy, setBusy] = useState(false);

  const isImage = !!file && /^image\//.test(file.type);

  // Build (and clean up) the thumbnail + page count whenever the file changes.
  useEffect(() => {
    if (!file) { setPreview(null); setPages(1); return; }
    let url: string | null = null;
    if (/^image\//.test(file.type)) {
      url = URL.createObjectURL(file);
      setPreview(url);
      setPages(1);
    } else {
      setPreview(null);
      void countPdfPages(file).then(setPages);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file]);

  const perPage = colorMode === "color" ? RATE_COLOR : RATE_BW;
  const baseCost = perPage * pages;
  const printCost = baseCost * copies;
  const total = file ? printCost + DELIVERY_FEE : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error("Please log in to upload files for printing"); return; }
    if (!file) { toast.error("Please choose a file to upload"); return; }
    setBusy(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read that file"));
        reader.readAsDataURL(file);
      });
      const billing = `${colorMode === "color" ? "Colour" : "Black & White"} · ${pages} page${pages === 1 ? "" : "s"} × ${copies} cop${copies === 1 ? "y" : "ies"} · ₹${total}`;
      await createPrintJobFn({
        data: {
          token, service, fileName: file.name, fileType: file.type, fileData, copies,
          notes: notes ? `${notes} — ${billing}` : billing,
          address,
        },
      });
      toast.success("Uploaded — the print shop has your file");
      await onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{cfg.label}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Accepted: {cfg.hint} · up to 5 MB</p>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Choose file
          <input
            type="file"
            accept={cfg.accept}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        {/* Live file preview */}
        {file && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
            {isImage && preview ? (
              <img src={preview} alt={file.name} className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                <FileText className="h-7 w-7" />
              </div>
            )}
            <div className="min-w-0 text-sm">
              <div className="truncate font-semibold">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {prettySize(file.size)}
                {!isImage && <> · {pages} page{pages === 1 ? "" : "s"} detected</>}
              </div>
            </div>
          </div>
        )}

        {/* Print options */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setColorMode("bw")}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${colorMode === "bw" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}
          >
            Black &amp; White · ₹{RATE_BW}/page
          </button>
          <button
            type="button"
            onClick={() => setColorMode("color")}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${colorMode === "color" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}
          >
            Colour · ₹{RATE_COLOR}/page
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Copies</span>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
              <button type="button" aria-label="Fewer copies" onClick={() => setCopies(c => Math.max(1, c - 1))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{copies}</span>
              <button type="button" aria-label="More copies" onClick={() => setCopies(c => Math.min(50, c + 1))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <label className="min-w-[8rem] flex-1 text-xs font-semibold text-muted-foreground">
            Notes (optional)
            <input
              value={notes} onChange={e => setNotes(e.target.value)} placeholder="Paper size, binding…"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        {/* Live billing breakdown */}
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 font-display text-sm font-extrabold text-primary">
            <IndianRupee className="h-4 w-4" /> Billing summary
          </div>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{colorMode === "color" ? "Colour" : "Black & White"} · ₹{perPage} × {pages} page{pages === 1 ? "" : "s"}</dt>
              <dd className="font-semibold">₹{baseCost}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Copies × {copies}</dt>
              <dd className="font-semibold">₹{printCost}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery fee</dt>
              <dd className="font-semibold">₹{file ? DELIVERY_FEE : 0}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-primary/20 pt-2 font-display text-base font-extrabold">
              <dt>Total payable</dt>
              <dd className="text-primary">₹{total}</dd>
            </div>
          </dl>
          {!file && <p className="mt-2 text-[11px] text-muted-foreground">Choose a file to see your exact total.</p>}
        </div>

        <label className="mt-3 block text-xs font-semibold text-muted-foreground">
          Delivery address
          <textarea
            value={address} onChange={e => setAddress(e.target.value)} rows={2}
            placeholder="Where should we deliver the prints?"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <div className="mt-4 flex items-center gap-2">
          <button disabled={busy} className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {busy ? "Uploading..." : `Upload & pay ₹${total}`}
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

