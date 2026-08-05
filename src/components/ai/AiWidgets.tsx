import { AlertTriangle, Sparkles, TrendingDown, TrendingUp, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Reusable presentation components for the AI Operations Assistant.

export type Severity = "critical" | "medium" | "low";

export type Insight = {
  id: string;
  kind: string;
  severity: string;
  product_id: string | null;
  product_name: string | null;
  title: string;
  body: string;
  reasoning: string;
  recommended_quantity: number | null;
  confidence: number;
  read: boolean;
  created_at: string;
};

export type Forecast = {
  productId: string;
  name: string;
  availableStock: number;
  reservedStock: number;
  soldLast7: number;
  soldLast30: number;
  dailyAverage: number;
  nextDay: number;
  nextWeek: number;
  nextMonth: number;
  trendPercent: number;
  daysToStockout: number | null;
  stockoutDate: string | null;
  recommendedQuantity: number;
  confidence: number;
  severity: string | null;
  reasoning: string;
  cancelledUnits: number;
  history: { date: string; units: number }[];
  projection: { date: string; units: number }[];
};

export const SEVERITY_TONE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  medium: "bg-saffron/20 text-saffron-foreground",
  low: "bg-leaf/15 text-leaf",
};

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical", medium: "Medium priority", low: "Low priority",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_TONE[severity] ?? "bg-muted text-muted-foreground"}`}>
      {severity === "critical" && <AlertTriangle className="h-3 w-3" />}
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

export function ScoreCard({ label, value, suffix = "", hint }: { label: string; value: number | string; suffix?: string; hint?: string }) {
  const numeric = typeof value === "number" ? value : null;
  const tone = numeric === null ? "text-foreground"
    : numeric >= 80 ? "text-leaf" : numeric >= 55 ? "text-saffron" : "text-destructive";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}{suffix}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <span className="text-[11px] font-bold text-muted-foreground">{value}% confidence</span>
    </div>
  );
}

export function InsightCard({
  insight, onDismiss, onApprove,
}: { insight: Insight; onDismiss?: (id: string) => void; onApprove?: (i: Insight) => void }) {
  return (
    <div className={`rounded-2xl border p-4 ${insight.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"}`}>
      <div className="flex flex-wrap items-start gap-2">
        <SeverityBadge severity={insight.severity} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{insight.kind.replace(/_/g, " ")}</span>
        {onDismiss && (
          <button onClick={() => onDismiss(insight.id)} aria-label="Dismiss insight" className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-2 font-display text-base font-bold">{insight.title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
      {insight.reasoning && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-primary">Why this recommendation?</summary>
          <p className="mt-1 text-xs text-muted-foreground">{insight.reasoning}</p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ConfidenceBar value={insight.confidence} />
        {onApprove && (insight.recommended_quantity ?? 0) > 0 && (
          <button
            onClick={() => onApprove(insight)}
            className="ml-auto rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            Approve reorder ({insight.recommended_quantity})
          </button>
        )}
      </div>
    </div>
  );
}

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const data = [
    ...forecast.history.map((h) => ({ date: h.date.slice(5), actual: h.units, predicted: null as number | null })),
    ...forecast.projection.map((p) => ({ date: p.date.slice(5), actual: null as number | null, predicted: p.units })),
  ];
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
          <Area type="monotone" dataKey="actual" name="Sold" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" connectNulls={false} />
          <Line type="monotone" dataKey="predicted" name="Forecast" stroke="hsl(var(--saffron, 38 92% 50%))" strokeDasharray="5 4" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendPill({ percent }: { percent: number }) {
  if (!percent) return <span className="text-xs text-muted-foreground">flat</span>;
  const up = percent > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${up ? "text-leaf" : "text-destructive"}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{percent}%
    </span>
  );
}

export function ProductForecastTable({
  rows, emptyText = "Nothing to show yet.", onSelect,
}: { rows: Forecast[]; emptyText?: string; onSelect?: (f: Forecast) => void }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Product</th>
            <th className="text-right">Available</th>
            <th className="text-right">Sold 7d</th>
            <th className="text-right">Tomorrow</th>
            <th className="text-right">Next 7d</th>
            <th className="text-right">Stock-out</th>
            <th className="text-right">Reorder</th>
            <th className="text-right">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr
              key={f.productId}
              onClick={() => onSelect?.(f)}
              className={`border-t border-border ${onSelect ? "cursor-pointer hover:bg-secondary/50" : ""}`}
            >
              <td className="py-2 pr-2">
                <div className="font-semibold">{f.name}</div>
                {f.severity && <SeverityBadge severity={f.severity} />}
              </td>
              <td className="text-right">{f.availableStock}</td>
              <td className="text-right">{f.soldLast7}</td>
              <td className="text-right">{f.nextDay}</td>
              <td className="text-right font-bold">{f.nextWeek}</td>
              <td className="text-right text-xs">{f.stockoutDate ?? "—"}</td>
              <td className="text-right">{f.recommendedQuantity || "—"}</td>
              <td className="pl-2 text-right"><TrendPill percent={f.trendPercent} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionCard({ title, icon: Icon = Sparkles, children, action }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Icon className="h-4 w-4" /> {title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
