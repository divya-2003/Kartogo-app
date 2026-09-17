import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Download, RefreshCw } from "lucide-react";
import {
  listPrintJobsFn,
  getPrintJobFileFn,
  setPrintJobStatusFn,
  PRINT_STATUSES,
  type PrintJob,
  type PrintStatus,
} from "@/lib/print.functions";

export const Route = createFileRoute("/printer/")({ component: PrinterQueue });

const LABEL: Record<string, string> = {
  received: "Received",
  printing: "Printing",
  ready: "Ready (order marked packed)",
  collected: "Collected",
};

function readToken(): string {
  try { return JSON.parse(localStorage.getItem("qk_printer_token") || "null") ?? ""; } catch { return ""; }
}

function PrinterQueue() {
  const [printerToken, setPrinterToken] = useState("");
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPrinterToken(readToken()); }, []);

  const load = useCallback(async () => {
    if (!printerToken) return;
    setLoading(true);
    try { setJobs(await listPrintJobsFn({ data: { printerToken } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load the print queue"); }
    finally { setLoading(false); }
  }, [printerToken]);

  useEffect(() => { void load(); }, [load]);

  const download = async (job: PrintJob) => {
    try {
      const f = await getPrintJobFileFn({ data: { printerToken, id: job.id } });
      const a = document.createElement("a");
      a.href = f.fileData;
      a.download = f.fileName;
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download this file");
    }
  };

  const setStatus = async (job: PrintJob, status: PrintStatus) => {
    try {
      const updated = await setPrintJobStatusFn({ data: { printerToken, id: job.id, status } });
      setJobs(prev => prev.map(j => (j.id === job.id ? updated : j)));
      toast.success(status === "ready" ? "Marked ready — the delivery partner now sees this order as packed" : `Marked ${LABEL[status]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this job");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Print queue</h1>
          <p className="text-sm text-muted-foreground">Download customer uploads, print them, then mark them ready — the linked delivery order moves to packed automatically.</p>
        </div>
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No print jobs yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map(j => (
            <div key={j.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Printer className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-bold">{j.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {j.service} · {j.copies} cop{j.copies === 1 ? "y" : "ies"} · {(j.fileSize / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div className="text-xs text-muted-foreground">Order {j.orderId ?? "—"} · {j.customerName ?? "Customer"}</div>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold">{LABEL[j.status] ?? j.status}</span>
              </div>

              {j.notes && <div className="mt-2 text-xs text-muted-foreground">Notes: {j.notes}</div>}
              {j.address && <div className="mt-1 text-xs text-muted-foreground">Deliver to: {j.address}</div>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => void download(j)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary">
                  <Download className="h-3.5 w-3.5" /> Download file
                </button>
                {PRINT_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => void setStatus(j, s)}
                    disabled={j.status === s}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${j.status === s ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
                  >
                    {LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
