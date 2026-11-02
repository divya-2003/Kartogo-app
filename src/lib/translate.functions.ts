import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LANGUAGES, LANGUAGE_CODES, isTranslatableText } from "./i18n";

// Translates app text with Lovable AI. Every translation is stored once per
// language, so each piece of text is only ever sent to the AI one time.

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export const translateUiFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    lang: z.string().refine(c => LANGUAGE_CODES.includes(c) && c !== "en"),
    texts: z.array(z.string().max(400)).min(1).max(60),
  }).parse(d))
  .handler(async ({ data }): Promise<{ translations: Record<string, string>; error?: string }> => {
    const texts = Array.from(new Set(data.texts.map(t => t.trim()).filter(isTranslatableText)));
    if (texts.length === 0) return { translations: {} };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hashes = await Promise.all(texts.map(sha));
    const { data: rows } = await supabaseAdmin
      .from("ui_translations")
      .select("source_hash, translated")
      .eq("lang", data.lang)
      .in("source_hash", hashes);
    const known = new Map((rows ?? []).map(r => [r.source_hash, r.translated]));
    const out: Record<string, string> = {};
    const missing: { text: string; hash: string }[] = [];
    texts.forEach((t, i) => {
      const hit = known.get(hashes[i]);
      if (hit != null) out[t] = hit; else missing.push({ text: t, hash: hashes[i] });
    });
    if (missing.length === 0) return { translations: out };

    const language = LANGUAGES.find(l => l.code === data.lang)!;
    try {
      const { aiObject } = await import("./ai-responses.server");
      const result = await aiObject({
        instructions:
          `You translate the interface of Kartogo, a grocery, food, rides and services delivery app in Ongole, India, from English into ${language.label} (${language.native}). ` +
          "Use natural, everyday wording a local shopper would understand, in the language's native script. " +
          "Keep brand names (Kartogo, Kartogo Cash), product brand names, numbers, ₹ prices, units (kg, g, ml), codes, emoji and punctuation as they are. " +
          "Translate every item; return each item's index with its translation.",
        prompt: missing.map((m, i) => `${i}\t${m.text}`).join("\n"),
        schema: z.object({ items: z.array(z.object({ i: z.number(), t: z.string() })) }),
        effort: "low",
      });
      const fresh: { lang: string; source_hash: string; source: string; translated: string }[] = [];
      for (const it of result.items) {
        const m = missing[it.i];
        const t = it.t?.trim();
        if (!m || !t) continue;
        out[m.text] = t;
        fresh.push({ lang: data.lang, source_hash: m.hash, source: m.text, translated: t });
      }
      if (fresh.length) await supabaseAdmin.from("ui_translations").upsert(fresh, { onConflict: "lang,source_hash", ignoreDuplicates: true });
      return { translations: out };
    } catch (e) {
      return { translations: out, error: (e as Error).message };
    }
  });
