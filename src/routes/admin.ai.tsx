import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, RefreshCw, AlertTriangle, Bot, Send, Gauge, Truck, Flame, Snowflake, PackageX, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/store";
import {
  aiOpsDashboardFn, runAiAnalysisFn, dismissAiInsightFn, markAiInsightsReadFn,
  approveReorderSuggestionFn, aiAssistantFn, type AiChatMessage,
} from "@/lib/ai-ops.functions";
import {
  InsightCard, ScoreCard, SectionCard, ProductForecastTable, ForecastChart, ConfidenceBar,
  type Forecast, type Insight,
} from "@/components/ai/AiWidgets";

export const Route = createFileRoute("/admin/ai")({
  component: AdminAiPage,
  head: () => ({
    meta: [
      { title: "AI Operations Assistant — Kartogo admin" },
      { name: "description", content: "AI demand forecasting, stock-out predictions, reorder recommendations, anomaly alerts and an operations chat assistant." },
    ],
  }),
});

type Dashboard = Awaited<ReturnType<typeof aiOpsDashboardFn>>;

const SUGGESTED = [
  "What products need restocking?",
  "Which supplier is underperforming?",
  "What will sell the most tomorrow?",
  "Which supermarket has low inventory?",
  "Show top selling products this month.",
  "Predict next week's demand.",
];

function AdminAiPage() {
  const { adminToken } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Forecast | null>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      const d = await aiOpsDashboardFn({ data: { adminToken } });
      setData(d);
      setSelected((cur) => cur ?? (d.forecasts[0] as unknown as Forecast) ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load AI insights");
    } finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const runAnalysis = async () => {
    if (!adminToken) return;
    setRunning(true);
    try {
      const r = await runAiAnalysisFn({ data: { adminToken } });
      toast.success(`Analysis complete — ${r.insights} insights, ${r.forecasts} forecasts`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally { setRunning(false); }
  };

  const dismiss = async (id: string) => {
    if (!adminToken) return;
    setData((d) => (d ? { ...d, insights: d.insights.filter((i) => i.id !== id) } : d));
    try { await dismissAiInsightFn({ data: { adminToken, id } }); } catch { void load(); }
  };

  const approve = async (insight: Insight) => {
    if (!adminToken) return;
    try {
      await approveReorderSuggestionFn({
        data: { adminToken, insightId: insight.id, quantity: insight.recommended_quantity ?? 1 },
      });
      toast.success("Draft purchase order created — review it under Purchase orders");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create the draft order"); }
  };

  const markRead = async () => {
    if (!adminToken) return;
    await markAiInsightsReadFn({ data: { adminToken } });
    setData((d) => (d ? { ...d, insights: d.insights.map((i) => ({ ...i, read: true })) } : d));
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || !adminToken || thinking) return;
    setQuestion("");
    const history = messages;
    setMessages([...history, { role: "user", content: q }]);
    setThinking(true);
    try {
      const { answer } = await aiAssistantFn({ data: { adminToken, question: q, history } });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The assistant could not answer that.";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
    } finally { setThinking(false); }
  };

  const insights = (data?.insights ?? []) as unknown as Insight[];
  const critical = insights.filter((i) => i.severity === "critical");
  const unread = insights.filter((i) => !i.read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold"><Sparkles className="h-6 w-6 text-primary" /> AI Operations Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Forecasts, stock-out predictions and reorder recommendations. The assistant never changes stock — every action needs your approval.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void markRead()} className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-secondary">
            Mark read{unread ? ` (${unread})` : ""}
          </button>
          <button onClick={() => void runAnalysis()} disabled={running} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> {running ? "Analysing…" : "Run analysis"}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading AI insights…</p> : !data ? null : (
        <>
          {/* Widgets */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ScoreCard label="Inventory health" value={data.health} suffix="/100" hint="Stock cover across tracked products" />
            <ScoreCard label="Forecast accuracy" value={data.accuracy.overall} suffix="%" hint={`${data.accuracy.samples} scored predictions`} />
            <ScoreCard label="About to stock out" value={data.aboutToStockOut.length} hint="Next 7 days" />
            <ScoreCard label="Critical alerts" value={critical.length} hint="Need attention today" />
            <ScoreCard label="Reorder suggestions" value={data.reorderSuggestions.length} hint="Awaiting your approval" />
          </div>

          {/* Critical alerts */}
          {critical.length > 0 && (
            <SectionCard title="Critical alerts" icon={AlertTriangle}>
              <div className="grid gap-3 md:grid-cols-2">
                {critical.slice(0, 6).map((i) => <InsightCard key={i.id} insight={i} onDismiss={dismiss} onApprove={approve} />)}
              </div>
            </SectionCard>
          )}

          {/* Chat assistant */}
          <SectionCard title="Ask the assistant" icon={Bot}>
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary">{s}</button>
              ))}
            </div>
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Ask anything about stock, demand, suppliers or sales. Answers are grounded in your live business data.</p>}
              {messages.map((m, idx) => (
                <div key={idx} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.content}
                </div>
              ))}
              {thinking && <div className="w-fit rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Analysing your data…</div>}
              <div ref={chatEnd} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); void ask(question); }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Which products will stock out this week?"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button type="submit" disabled={thinking} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                <Send className="h-4 w-4" /> Ask
              </button>
            </form>
          </SectionCard>

          {/* Forecast explorer */}
          <SectionCard title="Demand forecast" icon={Gauge}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <ProductForecastTable rows={data.forecasts as unknown as Forecast[]} onSelect={setSelected} />
              {selected && (
                <div className="rounded-2xl border border-border p-3">
                  <div className="font-display text-base font-bold">{selected.name}</div>
                  <div className="mt-1"><ConfidenceBar value={selected.confidence} /></div>
                  <ForecastChart forecast={selected} />
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Tomorrow</dt><dd className="font-bold">{selected.nextDay} units</dd></div>
                    <div><dt className="text-muted-foreground">Next 7 days</dt><dd className="font-bold">{selected.nextWeek} units</dd></div>
                    <div><dt className="text-muted-foreground">Next 30 days</dt><dd className="font-bold">{selected.nextMonth} units</dd></div>
                    <div><dt className="text-muted-foreground">Suggested reorder</dt><dd className="font-bold">{selected.recommendedQuantity} units</dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">{selected.reasoning}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Today's recommendations */}
          <SectionCard title="Today's AI recommendations" icon={ClipboardList}>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open recommendations. Run the analysis to refresh.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {insights.slice(0, 12).map((i) => <InsightCard key={i.id} insight={i} onDismiss={dismiss} onApprove={approve} />)}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Products about to stock out" icon={PackageX}>
              <ProductForecastTable rows={data.aboutToStockOut as unknown as Forecast[]} emptyText="All tracked products have healthy cover." />
            </SectionCard>
            <SectionCard title="Reorder suggestions" icon={ClipboardList}>
              <ProductForecastTable rows={data.reorderSuggestions as unknown as Forecast[]} emptyText="Nothing needs reordering right now." />
            </SectionCard>
            <SectionCard title="Fastest selling" icon={Flame}>
              <ProductForecastTable rows={data.fastestSelling as unknown as Forecast[]} />
            </SectionCard>
            <SectionCard title="Slowest selling" icon={Snowflake}>
              <ProductForecastTable rows={data.slowestSelling as unknown as Forecast[]} />
            </SectionCard>
            <SectionCard title="Unusual demand" icon={Flame}>
              <ProductForecastTable rows={data.unusualDemand as unknown as Forecast[]} emptyText="No unusual demand detected." />
            </SectionCard>
            <SectionCard title="Declining demand" icon={Snowflake}>
              <ProductForecastTable rows={data.decliningDemand as unknown as Forecast[]} emptyText="No declining products." />
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Supplier performance" icon={Truck}>
              <div className="space-y-2">
                {data.suppliers.map((s) => (
                  <div key={s.supplierId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.products} products · {s.stockouts} out of stock · {s.fillRate}% fulfilled · {s.unitsSold} units sold</span>
                    <span className={`ml-auto rounded-lg px-2 py-0.5 text-sm font-bold ${s.score >= 80 ? "bg-leaf/15 text-leaf" : s.score >= 55 ? "bg-saffron/20 text-saffron-foreground" : "bg-destructive/10 text-destructive"}`}>{s.score}/100</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Anomaly detection" icon={AlertTriangle}>
              {data.anomalies.length === 0 ? <p className="text-sm text-muted-foreground">No anomalies detected.</p> : (
                <ul className="space-y-2">
                  {data.anomalies.map((a, i) => (
                    <li key={`${a.kind}-${i}`} className="rounded-xl border border-border p-3 text-sm">
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <p className="text-xs text-muted-foreground">
            Forecast accuracy improves daily: every prediction is stored and compared with what actually sold.
            Last analysed {new Date(data.generatedAt).toLocaleString("en-IN")}.
          </p>
        </>
      )}
    </div>
  );
}
