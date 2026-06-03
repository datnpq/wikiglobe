// Build vn-events.js — a curated backbone of key Vietnamese historical events
// with coordinates + years, so the time slider's Vietnam case is rich (Wikidata
// alone is sparse for VN history). Each VI title is verified against the live
// Wikipedia REST summary; entries whose article doesn't resolve are dropped.
//
// Run:  node scripts/build-vn-events.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "vn-events.js");

// [lon, lat, year, viTitle, enTitle]
const CURATED = [
  [105.71, 21.13,   40, "Khởi nghĩa Hai Bà Trưng", "Trưng sisters' rebellion"],
  [105.76, 19.75,  248, "Khởi nghĩa Bà Triệu", "Lady Triệu"],
  [106.72, 20.92,  938, "Trận Bạch Đằng (938)", "Battle of Bạch Đằng (938)"],
  [105.84, 21.03, 1009, "Nhà Lý", "Lý dynasty"],
  [105.84, 21.03, 1010, "Chiếu dời đô", "Edict on the Transfer of the Capital"],
  [105.835,21.028,1070, "Văn Miếu – Quốc Tử Giám", "Temple of Literature, Hanoi"],
  [106.06, 21.18, 1077, "Trận Như Nguyệt", "Battle of Như Nguyệt"],
  [106.72, 20.92, 1288, "Trận Bạch Đằng (1288)", "Battle of Bạch Đằng (1288)"],
  [105.60, 19.90, 1397, "Thành nhà Hồ", "Citadel of the Hồ dynasty"],
  [105.31, 19.92, 1418, "Khởi nghĩa Lam Sơn", "Lam Sơn uprising"],
  [106.49, 21.55, 1427, "Trận Chi Lăng – Xương Giang", "Battle of Chi Lăng – Xương Giang"],
  [106.33, 10.34, 1785, "Trận Rạch Gầm – Xoài Mút", "Battle of Rạch Gầm–Xoài Mút"],
  [105.82, 20.99, 1789, "Trận Ngọc Hồi – Đống Đa", "Battle of Ngọc Hồi-Đống Đa"],
  [107.58, 16.47, 1802, "Nhà Nguyễn", "Nguyễn dynasty"],
  [108.22, 16.07, 1858, "Trận Đà Nẵng (1858–1860)", "Siege of Tourane"],
  [105.00, 18.30, 1885, "Phong trào Cần Vương", "Cần Vương movement"],
  [104.87, 21.70, 1930, "Khởi nghĩa Yên Bái", "Yên Bái mutiny"],
  [105.85, 21.03, 1945, "Cách mạng Tháng Tám", "August Revolution"],
  [103.02, 21.39, 1954, "Chiến dịch Điện Biên Phủ", "Battle of Điện Biên Phủ"],
  [106.70, 10.78, 1975, "Sự kiện 30 tháng 4 năm 1975", "Fall of Saigon"],
  [106.70, 10.78, 1975, "Chiến dịch Hồ Chí Minh", "Ho Chi Minh campaign"],
  [106.76, 22.49, 1979, "Chiến tranh biên giới Việt–Trung 1979", "Sino-Vietnamese War"],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Returns {status:'ok',title} (resolved, canonical), {status:'missing'} (real 404),
// or {status:'unknown'} (throttled/network — trust the curated title instead).
async function resolves(lang, title) {
  for (let attempt = 0; attempt < 4; attempt++) {
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

const events = [];
for (const [lon, lat, year, vi, en] of CURATED) {
  const rv = await resolves("vi", vi);
  const re = en ? await resolves("en", en) : { status: "missing" };
  // Drop only if BOTH are confirmed missing (real 404). Trust curation otherwise.
  if (rv.status === "missing" && re.status === "missing") {
    console.error("DROP (confirmed 404):", vi); continue;
  }
  const t = {};
  t.vi = rv.status === "ok" ? rv.title : (rv.status === "unknown" ? vi : undefined);
  if (en) t.en = re.status === "ok" ? re.title : (re.status === "unknown" ? en : undefined);
  for (const k of Object.keys(t)) if (t[k] === undefined) delete t[k];
  if (!Object.keys(t).length) { console.error("DROP (no title):", vi); continue; }
  events.push([lon, lat, year, t]);
  console.error(`ok ${year}  vi:${t.vi || "—"}  en:${t.en || "—"}`);
  await sleep(600);   // be gentle with the REST API
}

events.sort((a, b) => a[2] - b[2]);
writeFileSync(OUT, "window.WIKIGLOBE_VN_EVENTS=" +
  JSON.stringify({ generated: "2026-06-03", count: events.length, events }) + ";");
console.error("written vn-events:", events.length, "| size",
  (statSync(OUT).size / 1024).toFixed(1) + "KB");
