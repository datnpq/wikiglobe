// Build cities.json — a static global "civilization" index for WikiGlobe's
// zoomed-out tier. Pulls notable settlements (pop > threshold) from the
// Wikidata Query Service together with their Wikipedia titles in vi/en/fr/ja,
// so the globe always glows without depending on the slow live SPARQL endpoint.
//
// Run:  node scripts/build-cities.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Emitted as a .js global assignment (not .json) so it loads via a plain
// <script src> tag — that works when index.html is opened directly over
// file://, whereas fetch() of a local file is blocked by browsers.
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "cities.js");
const POP_MIN = 80000;

const QUERY = `SELECT ?coord ?pop ?vi ?en ?fr ?ja WHERE {
  VALUES ?t { wd:Q515 wd:Q1549591 wd:Q1093829 wd:Q5119 wd:Q200250 }
  ?item wdt:P31 ?t ; wdt:P1082 ?pop ; wdt:P625 ?coord .
  FILTER(?pop > ${POP_MIN})
  OPTIONAL { ?a1 schema:about ?item ; schema:isPartOf <https://vi.wikipedia.org/> ; schema:name ?vi . }
  OPTIONAL { ?a2 schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en . }
  OPTIONAL { ?a3 schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?fr . }
  OPTIONAL { ?a4 schema:about ?item ; schema:isPartOf <https://ja.wikipedia.org/> ; schema:name ?ja . }
}`;

const url = "https://query.wikidata.org/sparql?" +
  new URLSearchParams({ query: QUERY, format: "json" });

console.error("Querying Wikidata…");
const res = await fetch(url, {
  headers: {
    Accept: "application/sparql-results+json",
    "User-Agent": "WikiGlobe/1.0 (build-cities.mjs; partner@realitech.dev)",
  },
});
if (!res.ok) throw new Error(`SPARQL ${res.status}: ${await res.text()}`);
const { results } = await res.json();
const rows = results.bindings;
console.error("raw rows:", rows.length);

const PT = /Point\(([-\d.]+) ([-\d.]+)\)/;
const best = new Map(); // key: rounded "lon,lat" → keep highest population
for (const r of rows) {
  const m = PT.exec(r.coord.value);
  if (!m) continue;
  const lon = +(+m[1]).toFixed(4);
  const lat = +(+m[2]).toFixed(4);
  const pop = Math.round(+r.pop.value);
  const t = {};
  for (const l of ["vi", "en", "fr", "ja"]) if (r[l]) t[l] = r[l].value;
  if (Object.keys(t).length === 0) continue; // no article in any supported lang
  const key = `${lon.toFixed(2)},${lat.toFixed(2)}`;
  const prev = best.get(key);
  if (!prev || pop > prev[2]) best.set(key, [lon, lat, pop, t]);
}

const cities = [...best.values()].sort((a, b) => b[2] - a[2]);
const out = {
  generated: "2026-06-03",
  source: `Wikidata Query Service (P31 city-like, pop>${POP_MIN})`,
  count: cities.length,
  cities,
};
writeFileSync(OUT, "window.WIKIGLOBE_CITIES=" + JSON.stringify(out) + ";");
console.error("written cities:", cities.length);
console.error("file size KB:", (statSync(OUT).size / 1024).toFixed(1));
