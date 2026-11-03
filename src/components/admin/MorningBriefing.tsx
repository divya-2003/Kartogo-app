import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { latestBriefingsFn, generateBriefingNowFn, type Briefing } from "@/lib/briefing.functions";

function adminToken(): string | null {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null"); } catch { return null; }
}

/** Today's AI morning briefing (yesterday's sales, bookings and open tasks). */
export function MorningBriefing() {
  const [rows, setRows] = useState<Briefing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const token = adminToken();
    if (!token) return;
    try { setRows(await latestBriefingsFn({ data: { token } })); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    const token = adminToken();
    if (!token) return;
    setBusy(true);
    try {
      const r = await generateBriefingNowFn({ data: { token } });
      if ("ok" in r && r.ok === false) toast.error(r.error ?? "Couldn't write the briefing");
      else toast.success("Briefing updated");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const latest = rows?.[0];
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-pop">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-5 w-5 text-primary" /> Morning briefing</h2>
          <p className="text-xs text-muted-foreground">Written by Kartogo AI every day at 7:00 AM from yesterday's sales, bookings and open tasks.</p>
        </div>
        <button onClick={generate} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "Writing…" : "Generate now"}
        </button>
      </div>
      {rows === null ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-secondary" />
      ) : !latest ? (
        <p className="mt-4 text-sm text-muted-foreground">No briefing yet — the first one arrives tomorrow at 7:00 AM, or tap Generate now.</p>
      ) : latest.status === "ready" && latest.summary ? (
        <div className="mt-4">
          <div className="text-xs font-semibold text-muted-foreground">For {new Date(`${latest.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="mt-2 whitespace-pre-line text-sm leading-relaxed">{latest.summary}</div>
        </div>
      ) : latest.status === "running" ? (
        <p className="mt-4 text-sm text-muted-foreground">Writing the briefing…</p>
      ) : (
        <p className="mt-4 text-sm text-destructive">{latest.error ?? "The briefing couldn't be written."}</p>
      )}
    </section>
  );
}
