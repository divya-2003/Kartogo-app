#!/usr/bin/env node
/**
 * Brand guard: fails the build if the old brand name "Kartigo" appears in
 * frontend source, localization files, or UI components.
 *
 * The rebrand is Kartigo -> Kartogo. Any rendered/user-visible brand text is
 * always capitalized ("Kartigo"), so we match case-sensitively to avoid false
 * positives on legitimate internal identifiers that still contain the lowercase
 * token (the physical logo asset filename `kartigo-logo.png`, the `kartigoLogo`
 * import identifier, and persisted localStorage keys like `kartigo_cancel_seen`).
 *
 * Run: `node scripts/check-no-kartigo.mjs`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = "src";
const FORBIDDEN = "Kartigo";

// File types that hold frontend source, UI components, and localization strings.
const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".html",
  ".md",
]);

// Never scan generated or binary-descriptor files.
const IGNORE_FILE = (path) =>
  path.endsWith(".gen.ts") || path.endsWith(".asset.json");

/** @type {{ file: string; line: number; text: string }[]} */
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = statSync(path);
    if (info.isDirectory()) {
      walk(path);
      continue;
    }
    if (!EXTENSIONS.has(extname(path))) continue;
    if (IGNORE_FILE(path)) continue;

    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      if (text.includes(FORBIDDEN)) {
        hits.push({ file: path, line: i + 1, text: text.trim() });
      }
    });
  }
}

walk(ROOT);

if (hits.length > 0) {
  console.error(
    `\n\u274c Brand guard failed: found ${hits.length} occurrence(s) of "${FORBIDDEN}" in frontend source.\n` +
      `The brand is "Kartogo". Replace every user-visible "${FORBIDDEN}" string.\n`,
  );
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.text}`);
  }
  process.exit(1);
}

console.log(`\u2705 Brand guard passed: no "${FORBIDDEN}" strings in ${ROOT}/.`);
