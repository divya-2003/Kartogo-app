import { highlightRanges } from "@/lib/search-rank";

/** Renders `text` with the parts matching `query` visually emphasised. */
export function HighlightText({ text, query, className }: { text: string; query: string; className?: string }) {
  const ranges = query ? highlightRanges(text, query) : [];
  if (ranges.length === 0) return <span className={className}>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(<span key={`p${i}`}>{text.slice(cursor, start)}</span>);
    parts.push(
      <mark key={`m${i}`} className="bg-transparent font-extrabold text-primary">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <span className={className}>{parts}</span>;
}
