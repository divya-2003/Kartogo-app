// Tiny shared CSV utilities for admin report exports.
export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv<T>(rows: T[], headers: { key: string; label: string; get: (r: T) => unknown }[]): string {
  const lines: string[] = [headers.map(h => csvEscape(h.label)).join(",")];
  for (const r of rows) {
    lines.push(headers.map(h => csvEscape(h.get(r))).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
