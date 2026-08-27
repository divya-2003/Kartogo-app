// Relevance ranking for product search.
// Exact matches win, then prefix matches, then whole-word matches, then any
// broad substring match on name → category → description. Finally a fuzzy pass
// tolerates typos and missing characters ("detol" → "Dettol", "bandaid" →
// "Band-Aid").

type Searchable = { name: string; category: string; description?: string };

const norm = (s: string) => s.toLowerCase().trim();
// Strip punctuation/space so "band-aid" and "bandaid" compare equal.
const squash = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Levenshtein distance with an early-exit ceiling. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Typo budget scales with query length. */
const budget = (q: string) => (q.length <= 3 ? 0 : q.length <= 5 ? 1 : 2);

/** True when every char of q appears in order inside text (missing chars). */
function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  return i === q.length;
}

/** Fuzzy score 0..1 for a query against one field's words. */
function fuzzyField(query: string, field: string): number {
  const qs = squash(query);
  if (!qs) return 0;
  const fs = squash(field);
  if (!fs) return 0;
  const max = budget(qs);

  if (fs.startsWith(qs)) return 1;
  if (fs.includes(qs)) return 0.9;

  // token-wise typo tolerance
  const words = norm(field).split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;
  for (const w of words) {
    if (max > 0) {
      const d = editDistance(qs, w, max);
      if (d <= max) best = Math.max(best, 1 - d / (max + 1));
      // prefix-typo: compare against the same-length head of the word
      if (w.length > qs.length) {
        const head = w.slice(0, qs.length);
        const dh = editDistance(qs, head, max);
        if (dh <= max) best = Math.max(best, 0.85 - dh / (max + 2));
      }
    }
  }
  if (best === 0 && max > 0 && qs.length >= 4 && isSubsequence(qs, fs)) best = 0.4;
  return best;
}

function score(p: Searchable, q: string): number {
  const name = norm(p.name);
  const category = norm(p.category);
  const description = norm(p.description ?? "");
  // Only match at the start of a word — typing "av" must not match "flavour".
  const word = new RegExp(`\\b${escapeRe(q)}`);

  if (name === q) return 100;
  if (category === q) return 90;
  if (name.startsWith(q)) return 80;
  if (word.test(name)) return 70;
  if (category.startsWith(q)) return 50;
  if (word.test(category)) return 40;
  if (word.test(description)) return 30;

  // Fuzzy fallback — always ranked below any literal match.
  const fName = fuzzyField(q, p.name);
  if (fName > 0) return 5 + fName * 20;
  const fCat = fuzzyField(q, p.category);
  if (fCat > 0) return 1 + fCat * 10;
  return 0;
}

export function rankProducts<T extends Searchable>(products: T[], query: string): T[] {
  const q = norm(query);
  if (!q) return [];
  return products
    .map((p) => ({ p, s: score(p, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.length - b.p.name.length || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);
}

/** Categories whose name literally or fuzzily matches the query. */
export function rankCategories(categories: string[], query: string): string[] {
  const q = norm(query);
  if (!q) return [];
  return categories
    .map((c) => {
      const n = norm(c);
      const s = n === q ? 100 : n.startsWith(q) ? 80 : new RegExp(`\\b${escapeRe(q)}`).test(n) ? 60 : fuzzyField(q, c) * 20;
      return { c, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.localeCompare(b.c))
    .map((x) => x.c);
}

/**
 * Character ranges in `text` to highlight for `query`.
 * Falls back to per-character subsequence highlighting for fuzzy hits.
 */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const t = norm(text);
  const q = norm(query).replace(/\s+/g, " ").trim();
  if (!q) return [];
  const direct = t.indexOf(q);
  if (direct >= 0) return [[direct, direct + q.length]];

  // word-start matches for each query token
  const ranges: Array<[number, number]> = [];
  for (const token of q.split(" ")) {
    if (!token) continue;
    const i = t.indexOf(token);
    if (i >= 0) ranges.push([i, i + token.length]);
  }
  if (ranges.length) return ranges.sort((a, b) => a[0] - b[0]);

  // subsequence highlight (typo tolerant)
  const qs = squash(q);
  const out: Array<[number, number]> = [];
  let qi = 0;
  for (let i = 0; i < t.length && qi < qs.length; i++) {
    const ch = t[i];
    if (!/[a-z0-9]/.test(ch)) continue;
    if (ch === qs[qi]) {
      const last = out[out.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else out.push([i, i + 1]);
      qi++;
    }
  }
  return qi === qs.length ? out : [];
}
