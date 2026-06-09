// Extract EV station name + coords from a Google My Maps viewer HTML (_pageData blob).
// Feature shape in the data: [["Name"]] ... [null,[lat,lng]]   (note: lat first)
import fs from 'fs';

const html = fs.readFileSync(process.argv[2] || 'mm.html', 'utf8');
let i = html.indexOf('var _pageData = ');
if (i < 0) { console.error('no _pageData'); process.exit(1); }
i = html.indexOf('"', i);
let j = i + 1, lit = '';
while (j < html.length) {
  const c = html[j];
  if (c === '\\') { lit += html[j] + html[j + 1]; j += 2; continue; }
  if (c === '"') break;
  lit += c; j++;
}
const inner = JSON.parse('"' + lit + '"');   // → the actual JSON text of the map

// names: [["…"]]  (positions kept so we can attach the nearest preceding one)
const names = [];
for (const m of inner.matchAll(/\[\["((?:[^"\\]|\\.)*?)"\]\]/g)) {
  let n; try { n = JSON.parse('"' + m[1] + '"'); } catch { n = m[1]; }
  names.push({ i: m.index, n });
}
// canonical point geometry: [null,[lat,lng]]
const pts = [];
for (const m of inner.matchAll(/\[null,\[(-?\d+\.\d+),(-?\d+\.\d+)\]\]/g)) {
  pts.push({ i: m.index, lat: +m[1], lng: +m[2] });
}

// In this map the name FOLLOWS its geometry block → take the nearest name after the point.
const followingName = (pos) => {
  for (const nm of names) if (nm.i > pos) return nm.n;
  return '';
};

const seen = new Set(), feats = [];
for (const p of pts) {
  if (!(p.lat >= -85 && p.lat <= 85 && p.lng >= -180 && p.lng <= 180)) continue;
  const key = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
  if (seen.has(key)) continue; seen.add(key);
  feats.push({ title: followingName(p.i) || 'Trạm sạc', lat: p.lat, lng: p.lng });
}

console.log('names found:', names.length, '| point geometries:', pts.length, '| unique stations:', feats.length);
console.log('--- 10 mẫu ---');
for (const f of feats.slice(0, 10)) console.log(' •', f.title, '@', f.lat.toFixed(5) + ',' + f.lng.toFixed(5));

// Emit a static JS file (window global → loads over file:// too), station schema
const stations = feats.map(f => ({
  lat: f.lat, lon: f.lng, title: f.title,
  operator: 'BYD', network: 'BYD (cộng đồng)',
  conn: '', ports: '', power: '', fee: '', access: '', website: '', address: '', checkdate: '', availId: '',
}));
const out = process.argv[3] || '../community-ev.js';
fs.writeFileSync(out,
  '/* BYD charging map (community, from Google My Maps) — ' + stations.length +
  ' points. Regenerate: node ev-proxy/extract_mymaps.mjs <viewer.html> */\n' +
  'window.WIKIGLOBE_COMMUNITY = ' + JSON.stringify(stations) + ';\n');
console.log('→ wrote', stations.length, 'stations to', out);
