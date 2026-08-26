// Relevance ranking for product search.
// Exact matches win, then prefix matches, then whole-word matches, then any
// broad substring match on name → category → description.

type Searchable = { name: string; category: string; description?: string };

const norm = (s: string) => s.toLowerCase().trim();

function score(p: Searchable, q: string): number {
  const name = norm(p.name);
  const category = norm(p.category);
  const description = norm(p.description ?? "");
  const word = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

  if (name === q) return 100;
  if (category === q) return 90;
  if (name.startsWith(q)) return 80;
  if (word.test(name)) return 70;
  if (name.includes(q)) return 60;
  if (category.startsWith(q)) return 50;
  if (category.includes(q)) return 40;
  if (word.test(description)) return 30;
  if (description.includes(q)) return 20;
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
