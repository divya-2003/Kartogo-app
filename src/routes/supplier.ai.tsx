import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Bot, Send, PackageX, ClipboardList, Flame, Gauge } from "lucide-react";
import { useAuth } from "@/lib/store";
import { aiOpsDashboardFn, dismissAiInsightFn, markAiInsightsReadFn, aiAssistantFn, type AiChatMessage } from "@/lib/ai-ops.functions";
import {
  InsightCard, ScoreCard, SectionCard, ProductForecastTable, ForecastChart, ConfidenceBar,
  type Forecast, type Insight,
} from "@/components/ai/AiWidgets";

export const Route = createFileRoute("/supplier/ai")({
  component: SupplierAiPage,
  head: () => ({
    meta: [
      { title: "AI insights for suppliers — Kartogo" },
      { name: "description", content: "Demand forecasts, restock recommendations and low-stock alerts for the categories you supply to Kartogo." },
    ],
  }),
});

type Dashboard = Awaited<ReturnType<typeof aiOpsDashboardFn>>;

const SUGGESTED = [
  "What should I restock this week?",
  "Which of my products sell fastest?",
  "Predict demand for the next 7 days.",
];

function SupplierAiPage() {
  const { supplierToken } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Forecast | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supplierToken) return;
    try {
      const d = await aiOpsDashboardFn({ data: { supplierToken } });
      setData(d);
      setSelected((cur) => cur ?? (d.forecasts[0] as unknown as Forecast) ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load AI insights");
    } finally { setLoading(false); }
  }, [supplierToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const dismiss = async (id: string) => {
    if (!supplierToken) return;
    setData((d) => (d ? { ...d, insights: d.insights.filter((i) => i.id !== id) } : d));
    try { await dismissAiInsightFn({ data: { supplierToken, id } }); } catch { void load(); }
  };

  const markRead = async () => {
    if (!supplierToken) return;
    await markAiInsightsReadFn({ data: { supplierToken } });
    setData((d) => (d ? { ...d, insights: d.insights.map((i) => ({ ...i, read: true })) } : d));
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || !supplierToken || thinking) return;
    setQuestion("");
    const history = messages;
    setMessages([...history, { role: "user", content: q }]);
    setThinking(true);
    try {
      const { answer } = await aiAssistantFn({ data: { supplierToken, question: q, history } });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Could not answer that." }]);
    } finally { setThinking(false); }
  };

  const insights = (data?.insights ?? []) as unknown as Insight[];
  const unread = insights.filter((i) => !i.read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Sparkles className="h-5 w-5 text-primary" /> AI insights</h1>
          <p className="text-sm text-muted-foreground">Demand forecasts and restock guidance for your categories only.</p>
        </div>
        <button onClick={() => void markRead()} className="ml-auto rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
          Mark read{unread ? ` (${unread})` : ""}
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreCard label="Inventory health" value={data.health} suffix="/100" />
            <ScoreCard label="Forecast accuracy" value={data.accuracy.overall} suffix="%" />
            <ScoreCard label="Low / out of stock" value={data.aboutToStockOut.length} />
            <ScoreCard label="Restock suggestions" value={data.reorderSuggestions.length} />
          </div>

          <SectionCard title="Your recommendations" icon={ClipboardList}>
            {insights.length === 0 ? <p className="text-sm text-muted-foreground">No open recommendations right now.</p> : (
              <div className="grid gap-3 md:grid-cols-2">
                {insights.slice(0, 10).map((i) => <InsightCard key={i.id} insight={i} onDismiss={dismiss} />)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Ask the assistant" icon={Bot}>
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary">{s}</button>
              ))}
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Ask about demand, stock cover or what to send next.</p>}
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.content}</div>
              ))}
              {thinking && <div className="w-fit rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Analysing…</div>}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void ask(question); }} className="mt-3 flex items-center gap-2">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your products…" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <button type="submit" disabled={thinking} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                <Send className="h-4 w-4" /> Ask
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Demand forecast" icon={Gauge}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <ProductForecastTable rows={data.forecasts as unknown as Forecast[]} onSelect={setSelected} emptyText="No tracked stock for your categories yet." />
              {selected && (
                <div className="rounded-2xl border border-border p-3">
                  <div className="font-display text-base font-bold">{selected.name}</div>
                  <div className="mt-1"><ConfidenceBar value={selected.confidence} /></div>
                  <ForecastChart forecast={selected} />
                  <p className="mt-2 text-xs text-muted-foreground">{selected.reasoning}</p>
                </div>
              )}
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Running low" icon={PackageX}>
              <ProductForecastTable rows={data.aboutToStockOut as unknown as Forecast[]} emptyText="Nothing is running low." />
            </SectionCard>
            <SectionCard title="Fastest selling" icon={Flame}>
              <ProductForecastTable rows={data.fastestSelling as unknown as Forecast[]} />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
