// Build events.js — a static, dated, geo-located history index for WikiGlobe's
// time slider. Pulls historically significant events (battles, wars, disasters,
// revolutions, treaties…) that have BOTH a point in time (P585) and coordinates
// (P625) from Wikidata, with Wikipedia titles in vi/en/fr/ja.
//
// Emitted as window.WIKIGLOBE_EVENTS so it loads via <script src> over file://.
// Run:  node scripts/build-events.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "events.js");

// Event-like classes (instance of). Kept tight so the set stays meaningful.
const TYPES = [
  "wd:Q178561",   // battle
  "wd:Q198",      // war
  "wd:Q188055",   // siege
  "wd:Q3199915",  // massacre
  "wd:Q13418847", // historical event
  "wd:Q645883",   // military operation
  "wd:Q10931",    // revolution
  "wd:Q7944",     // earthquake
  "wd:Q8065",     // natural disaster
  "wd:Q3839081",  // disaster
  "wd:Q7692360",  // volcanic eruption (instance via subclasses may vary)
  "wd:Q131569",   // treaty
  "wd:Q40231",    // election
].join(" ");

const QUERY = `SELECT ?coord ?date ?vi ?en ?fr ?ja WHERE {
  VALUES ?t { ${TYPES} }
  ?item wdt:P31 ?t ; wdt:P585 ?date ; wdt:P625 ?coord .
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
    "User-Agent": "WikiGlobe/1.0 (build-events.mjs; partner@realitech.dev)",
  },
});
if (!res.ok) throw new Error(`SPARQL ${res.status}: ${await res.text()}`);
const { results } = await res.json();
const rows = results.bindings;
console.error("raw rows:", rows.length);

const PT = /Point\(([-\d.]+) ([-\d.]+)\)/;
const best = new Map(); // dedupe by rounded coord+year, keep first
for (const r of rows) {
  const m = PT.exec(r.coord.value);
  if (!m) continue;
  const lon = +(+m[1]).toFixed(4);
  const lat = +(+m[2]).toFixed(4);
  // ISO date like "1815-06-18T00:00:00Z" or "-0044-03-15T..." (BCE → leading -)
  const ym = /^(-?\d+)-/.exec(r.date.value);
  if (!ym) continue;
  const year = parseInt(ym[1], 10);
  if (!Number.isFinite(year) || year > 2026 || year < -3000) continue;
  const t = {};
  for (const l of ["vi", "en", "fr", "ja"]) if (r[l]) t[l] = r[l].value;
  if (Object.keys(t).length === 0) continue; // no article in any supported lang
  const key = `${lon.toFixed(2)},${lat.toFixed(2)},${year}`;
  if (!best.has(key)) best.set(key, [lon, lat, year, t]);
}

const events = [...best.values()].sort((a, b) => a[2] - b[2]); // chronological
const years = events.map(e => e[2]);
const out = {
  generated: "2026-06-03",
  source: "Wikidata Query Service (events with P585 + P625)",
  count: events.length,
  minYear: Math.min(...years),
  maxYear: Math.max(...years),
  events,
};
writeFileSync(OUT, "window.WIKIGLOBE_EVENTS=" + JSON.stringify(out) + ";");
console.error("written events:", events.length, "range", out.minYear, "→", out.maxYear);
console.error("file size KB:", (statSync(OUT).size / 1024).toFixed(1));
