// Build places.js — a static index of the world's most NOTABLE geotagged
// places (beyond big cities): heritage sites, landmarks, monuments, natural
// features, etc. Notability is proxied by wikibase:sitelinks (how many language
// Wikipedias cover it), a precomputed property so the query stays fast.
//
// This densifies the global tier at mid zoom (z6–10), the gap the live gsbbox
// tier can't fill. Emitted as window.WIKIGLOBE_PLACES (loads via <script src>).
// Run:  node scripts/build-places.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "places.js");
const MIN_SITELINKS = 7;    // notability floor among the typed places below

// Each place TYPE (P31) maps to a knowledge THEME — the lenses users filter by.
// h=history, c=culture, n=nature, s=science.
const TYPE_THEME = {
  Q9259:"h", Q23413:"h", Q839954:"h", Q4989906:"h", Q12518:"h", Q179700:"h",
  Q57821:"h", Q2065736:"h",                                   // history / heritage
  Q33506:"c", Q207694:"c", Q44539:"c", Q16970:"c", Q32815:"c",// culture
  Q8502:"n", Q23397:"n", Q34038:"n", Q46169:"n", Q22698:"n",  // nature
  Q3918:"s", Q14350:"s", Q7075:"s", Q31855:"s",               // science / knowledge
};
// When an item matches several types, the more distinctive theme wins.
const THEME_PRIORITY = ["n", "s", "c", "h"];
// Science types (universities, libraries…) have huge instance counts, so query
// them separately at a higher notability floor to keep each query under the
// WDQS timeout. The rest run at MIN_SITELINKS.
const SCI = new Set(["Q3918", "Q14350", "Q7075", "Q31855"]);
const MAIN_TYPES = Object.keys(TYPE_THEME).filter(q => !SCI.has(q)).map(q => "wd:" + q).join(" ");
const SCI_TYPES  = [...SCI].map(q => "wd:" + q).join(" ");

const langQuery = (lang, typesStr, minS) => `SELECT ?coord ?s ?t ?name WHERE {
  VALUES ?t { ${typesStr} }
  ?item wdt:P31 ?t ; wdt:P625 ?coord ; wikibase:sitelinks ?s .
  FILTER(?s >= ${minS})
  ?a schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> ; schema:name ?name .
}`;

const PT = /Point\(([-\d.]+) ([-\d.]+)\)/;
const best = new Map(); // coord key → [lon,lat,sitelinks,{titles},Set<theme>]
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchRows(lang, typesStr, minS) {
  const url = "https://query.wikidata.org/sparql?" +
    new URLSearchParams({ query: langQuery(lang, typesStr, minS), format: "json" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/sparql-results+json",
          "User-Agent": "WikiGlobe/1.0 (build-places.mjs; partner@realitech.dev)" },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Strip raw control chars (harmless for structural whitespace; fixes the
      // rare unescaped char in a title). A truncated/timed-out body still throws.
      const clean = text.replace(new RegExp("[\u0000-\u001f]", "g"), " ");
      return JSON.parse(clean).results.bindings;
    } catch (e) {
      console.error(`  ${lang} attempt ${attempt} failed (${e.message}); retrying…`);
      await sleep(6000);
    }
  }
  console.error(`  !! ${lang}: gave up — skipping (partial coverage)`);
  return [];   // non-fatal: build continues with whatever succeeded
}

async function runSet(label, typesStr, minS) {
  for (const lang of ["en", "vi", "fr", "ja"]) {
    console.error(`Querying ${label}/${lang}…`);
    const rows = await fetchRows(lang, typesStr, minS);
    console.error(`  ${label}/${lang}: ${rows.length} rows`);
    await sleep(1500);   // pace requests so WDQS doesn't rate-limit us
    for (const r of rows) {
      const m = PT.exec(r.coord.value); if (!m) continue;
    const lon = +(+m[1]).toFixed(4), lat = +(+m[2]).toFixed(4);
    // Key on full precision: the same item has identical P625 across languages
    // (so it still merges), but distinct nearby landmarks stay separate.
    const sl = +r.s.value, key = `${lon},${lat}`;
    const theme = TYPE_THEME[r.t.value.split("/").pop()];
    let e = best.get(key);
    if (!e) { e = [lon, lat, sl, {}, new Set()]; best.set(key, e); }
    e[3][lang] = r.name.value;
    if (theme) e[4].add(theme);
      if (sl > e[2]) e[2] = sl;
    }
  }
}
// Split by theme group so each per-language query stays well under the WDQS
// timeout (the combined query is borderline and dies mid-stream).
const byTheme = { h: [], c: [], n: [], s: [] };
for (const [q, th] of Object.entries(TYPE_THEME)) byTheme[th].push("wd:" + q);
await runSet("history", byTheme.h.join(" "), MIN_SITELINKS);
await runSet("culture", byTheme.c.join(" "), MIN_SITELINKS);
await runSet("nature",  byTheme.n.join(" "), 9);   // mountains/lakes are numerous → notable only
await runSet("science", byTheme.s.join(" "), 13);

const resolveTheme = (set) => THEME_PRIORITY.find(th => set.has(th)) || "h";
const places = [...best.values()]
  .map(e => [e[0], e[1], e[2], e[3], resolveTheme(e[4])])   // [lon,lat,sitelinks,titles,theme]
  .sort((a, b) => b[2] - a[2]);
const out = {
  generated: "2026-06-03",
  source: `Wikidata Query Service (P625 + sitelinks>=${MIN_SITELINKS})`,
  count: places.length,
  places,
};
writeFileSync(OUT, "window.WIKIGLOBE_PLACES=" + JSON.stringify(out) + ";");
console.error("written places:", places.length);
console.error("file size KB:", (statSync(OUT).size / 1024).toFixed(1));
