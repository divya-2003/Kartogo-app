// Picks the right shop category from a product name (and description).
// Browser-safe and instant; the AI fallback only runs when no rule matches.

type Rule = { slug: string; words: RegExp; weight?: number };

// Order does not matter — every match scores, the strongest category wins.
// Multi-word, specific terms get extra weight so "chilli powder" beats "chilli".
const RULES: Rule[] = [
  { slug: "pickles", words: /\b(pickles?|achar|aachar|avakaya|avakai|gongura|thokku|pachadi|uragaya|ooragaya|tomato pickle|lemon pickle|mango pickle)\b/i, weight: 3 },
  { slug: "spice-powders", words: /\b(chil+i powder|mirchi powder|karam|kaaram|sambar powder|rasam powder|masala powder|garam masala|turmeric|haldi|coriander powder|dhania|jeera powder|cumin|pepper powder|biryani masala|curry powder|podi|kandi podi|idli podi|spice)\b/i, weight: 3 },
  { slug: "local-snacks", words: /\b(murukku|chakli|chekkalu|chekka|janthikalu|jantikalu|boondi|kara boondi|pootharekulu|ariselu|sunnundalu|bobbatlu|kajjikayalu|chikki|banana chips|halwa|laddu|ladoo|mysore pak|kova|sweets?)\b/i, weight: 3 },
  { slug: "snacks", words: /\b(chips|crisps|namkeen|mixture|bhujia|biscuits?|cookies?|wafers|kurkure|lays|popcorn|nachos|chocolates?|candy|toffee|cake|rusk|peanuts|makhana|snacks?)\b/i, weight: 2 },
  { slug: "instant-food", words: /\b(noodles|maggi|yippee|pasta|macaroni|vermicelli|semiya|oats|cornflakes|muesli|instant|ready to eat|cup noodles|soup mix|poha|upma mix|ketchup|sauce|jam)\b/i, weight: 2 },
  { slug: "tiffin-batter", words: /\b(batter|idli|dosa|dosai|pesarattu|uttapam|appam|ragi dosa|wet flour)\b/i, weight: 3 },
  { slug: "beverages", words: /\b(coffee|tea|chai|bru|tetley|nescafe|juice|soft drink|cola|pepsi|coke|sprite|soda|water bottle|mineral water|energy drink|horlicks|boost|bournvita|milk shake|lassi|buttermilk|drink)\b/i, weight: 2 },
  { slug: "grooming", words: /\b(soap|body wash|shampoo|conditioner|razor|blade|shaving|trimmer|deodorant|deo|perfume|toothpaste|toothbrush|mouthwash|hair oil|comb|face wash|handwash|hand wash|talc|powder puff|beard)\b/i, weight: 2 },
  { slug: "cosmetics", words: /\b(lipstick|lip balm|kajal|eyeliner|mascara|foundation|concealer|compact|blush|nail polish|nail paint|makeup|face cream|fairness|moisturi[sz]er|sunscreen|serum|bindi|sindoor|cosmetics?|beauty cream|lotion)\b/i, weight: 2 },
  { slug: "pharmacy", words: /\b(tablets?|capsules?|syrup|ointment|cream for|antiseptic|dettol|savlon|band ?aid|bandage|cotton roll|thermometer|ors|paracetamol|dolo|crocin|vitamin|supplement|sanitizer|sanitiser|face mask|surgical|glucose|inhaler|balm|pain relief|medicine|bp monitor|glucometer|strips)\b/i, weight: 2 },
  { slug: "pooja", words: /\b(agarbatti|agarbathi|incense|dhoop|camphor|kapoor|karpuram|diya|deepam|wicks|vattulu|kumkum|kumkuma|pasupu|vibhuti|pooja|puja|haarathi|aarti|sambrani|ghee lamp|kalash|rudraksha)\b/i, weight: 3 },
  { slug: "stationery", words: /\b(notebook|note book|pen|pencil|eraser|sharpener|scale|ruler|stapler|glue|fevicol|marker|highlighter|crayons|sketch|file folder|a4 paper|register|diary|geometry box|chart paper|stationery)\b/i, weight: 2 },
  { slug: "combos", words: /\b(combo|kit|hamper|gift pack|bundle|value pack of)\b/i, weight: 1 },
];

export type CategoryGuess = { slug: string; score: number; strong: boolean } | null;

/** Best-matching category for this product, or null when nothing matches. */
export function guessCategory(name: string, description = "", allowed?: string[]): CategoryGuess {
  const title = name.trim();
  if (title.length < 3) return null;
  const scores = new Map<string, number>();
  for (const r of RULES) {
    if (allowed && !allowed.includes(r.slug)) continue;
    // Name counts three times as much as the description.
    const inName = (title.match(new RegExp(r.words.source, "gi")) ?? []).length;
    const inDesc = description ? (description.match(new RegExp(r.words.source, "gi")) ?? []).length : 0;
    const s = (inName * 3 + inDesc) * (r.weight ?? 1);
    if (s > 0) scores.set(r.slug, (scores.get(r.slug) ?? 0) + s);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [slug, score] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  return { slug, score, strong: score >= 6 && score > runnerUp };
}
