import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LANGUAGE_EVENT, getLanguage, isTranslatableText, isUntranslatedPath } from "@/lib/i18n";
import { translateUiFn } from "@/lib/translate.functions";

const SKIP = 'script,style,noscript,textarea,input,select,code,pre,[translate="no"],[data-no-translate],[contenteditable="true"]';
const ATTRS = ["placeholder", "aria-label", "title"] as const;
const BATCH = 60;
const CACHE_LIMIT = 4000;

type Engine = { stop: () => void };

const sources = new WeakMap<Text, string>();
const applied = new WeakMap<Text, string>();
const attrSources = new WeakMap<Element, Record<string, { src: string; tr: string }>>();

function readCache(lang: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`qk_tr_${lang}`) || "{}") as Record<string, string>; } catch { return {}; }
}
function writeCache(lang: string, cache: Record<string, string>) {
  try {
    const keys = Object.keys(cache);
    const trimmed = keys.length > CACHE_LIMIT ? Object.fromEntries(keys.slice(-CACHE_LIMIT).map(k => [k, cache[k]])) : cache;
    localStorage.setItem(`qk_tr_${lang}`, JSON.stringify(trimmed));
  } catch { /* storage full — keep in memory only */ }
}

/** Puts every translated text and attribute back to the original English. */
function restoreAll(root: Node = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const src = sources.get(n);
    if (src != null && applied.get(n) === n.nodeValue) n.nodeValue = src;
    applied.delete(n);
  }
  (root as Element).querySelectorAll?.("[placeholder],[aria-label],[title]").forEach(el => {
    const rec = attrSources.get(el);
    if (!rec) return;
    for (const [a, v] of Object.entries(rec)) if (el.getAttribute(a) === v.tr) el.setAttribute(a, v.src);
    attrSources.delete(el);
  });
}

function startEngine(lang: string): Engine {
  const cache = readCache(lang);
  const waiting = new Map<string, Set<Text>>();
  const waitingAttrs = new Map<string, Set<[Element, string]>>();
  const pending = new Set<string>();
  const inflight = new Set<string>();
  let stopped = false;
  let failed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const applyText = (node: Text, src: string, tr: string) => {
    const lead = src.match(/^\s*/)?.[0] ?? "";
    const tail = src.match(/\s*$/)?.[0] ?? "";
    const next = lead + tr + tail;
    applied.set(node, next);
    if (node.nodeValue !== next) node.nodeValue = next;
  };

  const queue = (key: string) => {
    if (failed || inflight.has(key)) return;
    pending.add(key);
    if (!timer) timer = setTimeout(flush, 180);
  };

  const processText = (node: Text) => {
    const value = node.nodeValue ?? "";
    if (applied.get(node) === value) return; // our own translation
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    if (!isTranslatableText(value)) return;
    sources.set(node, value);
    const key = value.trim();
    const hit = cache[key];
    if (hit != null) { applyText(node, value, hit); return; }
    let set = waiting.get(key);
    if (!set) waiting.set(key, (set = new Set()));
    set.add(node);
    queue(key);
  };

  const processAttrs = (el: Element) => {
    if (el.closest(SKIP) && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const rec = attrSources.get(el) ?? {};
      if (rec[a]?.tr === v) continue;
      if (!isTranslatableText(v)) continue;
      const key = v.trim();
      const hit = cache[key];
      if (hit != null) {
        rec[a] = { src: v, tr: hit };
        attrSources.set(el, rec);
        el.setAttribute(a, hit);
        continue;
      }
      let set = waitingAttrs.get(key);
      if (!set) waitingAttrs.set(key, (set = new Set()));
      set.add([el, a]);
      queue(key);
    }
  };

  const scan = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) { processText(root as Text); return; }
    if (!(root instanceof Element)) return;
    if (root.closest(SKIP) && !(root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement)) return;
    processAttrs(root);
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(processAttrs);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) processText(n);
  };

  const deliver = (key: string, tr: string) => {
    cache[key] = tr;
    waiting.get(key)?.forEach(node => {
      const src = sources.get(node);
      if (node.isConnected && src != null && src.trim() === key && node.nodeValue === src) applyText(node, src, tr);
    });
    waiting.delete(key);
    waitingAttrs.get(key)?.forEach(([el, a]) => {
      const v = el.getAttribute(a);
      if (!el.isConnected || v?.trim() !== key) return;
      const rec = attrSources.get(el) ?? {};
      rec[a] = { src: v, tr };
      attrSources.set(el, rec);
      el.setAttribute(a, tr);
    });
    waitingAttrs.delete(key);
  };

  async function flush() {
    timer = null;
    if (stopped || failed) return;
    const batch = Array.from(pending).slice(0, BATCH);
    batch.forEach(k => { pending.delete(k); inflight.add(k); });
    if (batch.length === 0) return;
    try {
      const res = await translateUiFn({ data: { lang, texts: batch } });
      if (stopped) return;
      Object.entries(res.translations).forEach(([k, v]) => deliver(k, v));
      writeCache(lang, cache);
      // Stop asking when Lovable AI is unavailable (credits, access) — no retry storm.
      if (res.error && Object.keys(res.translations).length === 0) failed = true;
    } catch {
      failed = true;
    } finally {
      batch.forEach(k => inflight.delete(k));
      if (!stopped && !failed && pending.size) timer = setTimeout(flush, 120);
    }
  }

  scan(document.body);
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "characterData") processText(m.target as Text);
      else if (m.type === "attributes") processAttrs(m.target as Element);
      else m.addedNodes.forEach(scan);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      observer.disconnect();
    },
  };
}

/**
 * Translates the visible app into the language picked on the profile page.
 * Admin pages always stay in English.
 */
export function PageTranslator() {
  const path = useRouterState({ select: s => s.location.pathname });
  const [lang, setLang] = useState("en");
  useEffect(() => {
    setLang(getLanguage());
    const on = (e: Event) => setLang((e as CustomEvent<string>).detail || getLanguage());
    window.addEventListener(LANGUAGE_EVENT, on);
    return () => window.removeEventListener(LANGUAGE_EVENT, on);
  }, []);
  const active = lang !== "en" && !isUntranslatedPath(path);
  useEffect(() => {
    document.documentElement.lang = active ? lang : "en";
    if (!active) { restoreAll(); return; }
    const engine = startEngine(lang);
    return () => { engine.stop(); };
  }, [active, lang]);
  return null;
}
