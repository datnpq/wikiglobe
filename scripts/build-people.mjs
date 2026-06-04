// Build people.js — a curated "People" knowledge lens: the world's most iconic
// figures (science, art, music, letters, thought, leadership) + key Vietnamese
// figures, placed at their birthplace. SPARQL birthplace queries scan all ~10M
// humans and time out (and skew to athletes), so we curate for quality and
// verify each title against the live REST API (drop only confirmed 404s).
//
// Run:  node scripts/build-people.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "people.js");

// [lon, lat (birthplace), viTitle, enTitle]
const CURATED = [
  // — science —
  [9.99, 48.40, "Albert Einstein", "Albert Einstein"],
  [-0.63, 52.81, "Isaac Newton", "Isaac Newton"],
  [21.01, 52.23, "Marie Curie", "Marie Curie"],
  [-2.75, 52.71, "Charles Darwin", "Charles Darwin"],
  [10.40, 43.72, "Galileo Galilei", "Galileo Galilei"],
  [15.31, 44.55, "Nikola Tesla", "Nikola Tesla"],
  [-1.26, 51.75, "Stephen Hawking", "Stephen Hawking"],
  [-0.18, 51.49, "Alan Turing", "Alan Turing"],
  [15.29, 37.07, "Archimedes", "Archimedes"],
  [23.79, 40.57, "Aristoteles", "Aristotle"],
  // — art —
  [10.92, 43.78, "Leonardo da Vinci", "Leonardo da Vinci"],
  [11.98, 43.64, "Michelangelo", "Michelangelo"],
  [4.66, 51.47, "Vincent van Gogh", "Vincent van Gogh"],
  [-4.42, 36.72, "Pablo Picasso", "Pablo Picasso"],
  [4.49, 52.16, "Rembrandt", "Rembrandt"],
  [2.35, 48.86, "Claude Monet", "Claude Monet"],
  [-99.16, 19.35, "Frida Kahlo", "Frida Kahlo"],
  // — music —
  [7.10, 50.73, "Ludwig van Beethoven", "Ludwig van Beethoven"],
  [13.05, 47.80, "Wolfgang Amadeus Mozart", "Wolfgang Amadeus Mozart"],
  [10.32, 50.97, "Johann Sebastian Bach", "Johann Sebastian Bach"],
  [20.13, 52.26, "Frédéric Chopin", "Frédéric Chopin"],
  [54.00, 57.05, "Pyotr Ilyich Tchaikovsky", "Pyotr Ilyich Tchaikovsky"],
  // — letters & thought —
  [-1.71, 52.19, "William Shakespeare", "William Shakespeare"],
  [11.26, 43.77, "Dante Alighieri", "Dante Alighieri"],
  [8.68, 50.11, "Johann Wolfgang von Goethe", "Johann Wolfgang von Goethe"],
  [6.02, 47.24, "Victor Hugo", "Victor Hugo"],
  [37.52, 54.07, "Lev Nikolayevich Tolstoy", "Leo Tolstoy"],
  [37.62, 55.75, "Fyodor Mikhailovich Dostoevsky", "Fyodor Dostoevsky"],
  [116.99, 35.60, "Khổng Tử", "Confucius"],
  [23.73, 37.98, "Platon", "Plato"],
  [23.73, 37.98, "Socrates", "Socrates"],
  [6.64, 49.76, "Karl Marx", "Karl Marx"],
  // — leaders & explorers —
  [8.74, 41.93, "Napoléon Bonaparte", "Napoleon"],
  [12.50, 41.89, "Julius Caesar", "Julius Caesar"],
  [22.52, 40.76, "Alexandros Đại đế", "Alexander the Great"],
  [29.92, 31.20, "Cleopatra VII", "Cleopatra"],
  [69.60, 21.64, "Mahatma Gandhi", "Mahatma Gandhi"],
  [28.45, -31.95, "Nelson Mandela", "Nelson Mandela"],
  [-85.74, 37.57, "Abraham Lincoln", "Abraham Lincoln"],
  [8.93, 44.41, "Cristoforo Colombo", "Christopher Columbus"],
  // — Vietnam —
  [105.50, 18.68, "Hồ Chí Minh", "Ho Chi Minh"],
  [105.90, 18.55, "Nguyễn Du", "Nguyễn Du"],
  [106.60, 17.49, "Võ Nguyên Giáp", "Võ Nguyên Giáp"],
  [105.67, 18.68, "Phan Bội Châu", "Phan Bội Châu"],
  [105.78, 21.02, "Hồ Xuân Hương", "Hồ Xuân Hương"],
  [106.30, 20.44, "Trần Hưng Đạo", "Trần Hưng Đạo"],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function resolve(lang, title) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/` +
        encodeURIComponent(title), { headers: { "User-Agent": "WikiGlobe/1.0 (build)" } });
      if (r.status === 429 || r.status >= 500) { await sleep(1500); continue; }
      if (r.status === 404) return { status: "missing" };
      if (!r.ok) return { status: "unknown" };
      const j = await r.json();
      if (j.type === "disambiguation" || !j.title) return { status: "missing" };
      return { status: "ok", title: j.title };
    } catch { await sleep(800); }
  }
  return { status: "unknown" };
}

const people = [];
for (const [lon, lat, vi, en] of CURATED) {
  const rv = await resolve("vi", vi);
  const re = await resolve("en", en);
  if (rv.status === "missing" && re.status === "missing") { console.error("DROP:", vi); continue; }
  const t = {};
  if (rv.status === "ok") t.vi = rv.title; else if (rv.status === "unknown") t.vi = vi;
  if (re.status === "ok") t.en = re.title; else if (re.status === "unknown") t.en = en;
  people.push([lon, lat, 0, t]);   // [lon,lat,_,titles] — theme 'p' assigned client-side
  console.error(`ok  vi:${t.vi || "—"}  en:${t.en || "—"}`);
  await sleep(500);
}

writeFileSync(OUT, "window.WIKIGLOBE_PEOPLE=" +
  JSON.stringify({ generated: "2026-06-04", count: people.length, people }) + ";");
console.error("written people:", people.length, "| size",
  (statSync(OUT).size / 1024).toFixed(1) + "KB");
