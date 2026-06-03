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

// Filter by place TYPE (P31) — like cities.js — so the sitelink join stays fast.
// These are the categories worth seeing at regional zoom.
const TYPES = [
  "wd:Q9259",     // UNESCO World Heritage Site
  "wd:Q23413",    // castle
  "wd:Q839954",   // archaeological site
  "wd:Q33506",    // museum
  "wd:Q207694",   // art museum
  "wd:Q8502",     // mountain
  "wd:Q23397",    // lake
  "wd:Q34038",    // waterfall
  "wd:Q46169",    // national park
  "wd:Q44539",    // temple
  "wd:Q16970",    // church building
  "wd:Q32815",    // mosque
  "wd:Q4989906",  // monument
  "wd:Q12518",    // tower
  "wd:Q179700",   // statue
  "wd:Q22698",    // park
  "wd:Q57821",    // fortification
  "wd:Q2065736",  // cultural heritage
].join(" ");

// One query per language: a single INNER join (only items with an article in
// that wiki) is far lighter than four OPTIONALs at once. Merge results by coord.
const langQuery = (lang) => `SELECT ?coord ?s ?name WHERE {
  VALUES ?t { ${TYPES} }
  ?item wdt:P31 ?t ; wdt:P625 ?coord ; wikibase:sitelinks ?s .
  FILTER(?s >= ${MIN_SITELINKS})
  ?a schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> ; schema:name ?name .
}`;

const PT = /Point\(([-\d.]+) ([-\d.]+)\)/;
const best = new Map(); // coord key → [lon,lat,sitelinks,{titles}]
for (const lang of ["en", "vi", "fr", "ja"]) {
  const url = "https://query.wikidata.org/sparql?" +
    new URLSearchParams({ query: langQuery(lang), format: "json" });
  console.error(`Querying ${lang}…`);
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json",
      "User-Agent": "WikiGlobe/1.0 (build-places.mjs; partner@realitech.dev)" },
  });
  if (!res.ok) throw new Error(`SPARQL ${lang} ${res.status}: ${(await res.text()).slice(0,200)}`);
  const rows = (await res.json()).results.bindings;
  console.error(`  ${lang}: ${rows.length} rows`);
  for (const r of rows) {
    const m = PT.exec(r.coord.value); if (!m) continue;
    const lon = +(+m[1]).toFixed(4), lat = +(+m[2]).toFixed(4);
    // Key on full precision: the same item has identical P625 across languages
    // (so it still merges), but distinct nearby landmarks stay separate.
    const sl = +r.s.value, key = `${lon},${lat}`;
    let e = best.get(key);
    if (!e) { e = [lon, lat, sl, {}]; best.set(key, e); }
    e[3][lang] = r.name.value;
    if (sl > e[2]) e[2] = sl;
  }
}

const places = [...best.values()].sort((a, b) => b[2] - a[2]);
const out = {
  generated: "2026-06-03",
  source: `Wikidata Query Service (P625 + sitelinks>=${MIN_SITELINKS})`,
  count: places.length,
  places,
};
writeFileSync(OUT, "window.WIKIGLOBE_PLACES=" + JSON.stringify(out) + ";");
console.error("written places:", places.length);
console.error("file size KB:", (statSync(OUT).size / 1024).toFixed(1));
