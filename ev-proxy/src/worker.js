/**
 * WikiGlobe EV proxy — Cloudflare Worker
 *
 * One endpoint:  GET /stations?bbox=<south>,<west>,<north>,<east>
 * Routes by region and normalises every source into one schema:
 *   - 🇺🇸 United States  → RapidAPI "EV Stations" (NREL AFDC: rich, has live status)
 *   - 🌍 everywhere else → OpenStreetMap / Overpass (global coverage)
 * The RapidAPI key lives in the `RAPIDAPI_KEY` secret — never in the client.
 * Responses are cached at the edge (s-maxage 1 day) to protect the free quota.
 */

const AFDC_HOST = 'ev-stations.p.rapidapi.com';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (!url.pathname.endsWith('/stations')) return json({ error: 'not found' }, 404);

    const bbox = (url.searchParams.get('bbox') || '').split(',').map(Number);
    if (bbox.length !== 4 || bbox.some((n) => !isFinite(n)))
      return json({ error: 'bad bbox — expected ?bbox=south,west,north,east' }, 400);
    let [s, w, n, e] = bbox;
    if (n < s) [s, n] = [n, s];
    if (e < w) [w, e] = [e, w];

    // round the bbox to ~3 decimals so nearby viewports share a cache entry
    const rk = [s, w, n, e].map((x) => x.toFixed(3)).join(',');
    const cacheUrl = new URL(url.origin + url.pathname + '?bbox=' + rk);
    const cache = caches.default;
    const hit = await cache.match(cacheUrl);
    if (hit) return withCors(hit);

    const lat = (s + n) / 2, lon = (w + e) / 2;
    let out;
    try {
      out = inUS(lat, lon)
        ? await fromAFDC(lat, lon, n, e, env)
        : await fromOSM(s, w, n, e);
    } catch (err) {
      // if the rich US source fails, still try OSM so the map isn't empty
      try { out = await fromOSM(s, w, n, e); }
      catch (e2) { return json({ error: String(err) }, 502); }
    }

    const resp = json(out, 200, { 'Cache-Control': 'public, s-maxage=86400' });
    ctx.waitUntil(cache.put(cacheUrl, resp.clone()));
    return resp;
  },
};

/* ---------- US: RapidAPI EV Stations (AFDC) ---------- */
async function fromAFDC(lat, lon, n, e, env) {
  if (!env.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY secret not set');
  const radius = Math.min(80000, Math.round(haversine(lat, lon, n, e))); // metres, capped 80 km
  const u = `https://${AFDC_HOST}/stations?lat=${lat}&lon=${lon}&radius=${radius}&public_only=true&limit=200`;
  const r = await fetch(u, {
    headers: { 'x-rapidapi-host': AFDC_HOST, 'x-rapidapi-key': env.RAPIDAPI_KEY },
  });
  if (!r.ok) throw new Error('afdc ' + r.status);
  const j = await r.json();
  const stations = (j.results || []).map((a) => {
    const c = (a.location && a.location.coordinates) || [];
    const ports = [];
    if (a.number_of_level2_evse_ports) ports.push('L2×' + a.number_of_level2_evse_ports);
    if (a.number_of_dc_fast_evse_ports) ports.push('DC×' + a.number_of_dc_fast_evse_ports);
    if (a.number_of_level1_evse_ports) ports.push('L1×' + a.number_of_level1_evse_ports);
    return {
      id: 'afdc' + a.id, lat: c[1], lon: c[0],
      title: a.name || '', operator: networkName(a.network) || a.owner_type || '',
      network: networkName(a.network), status: a.status || '',
      conn: (a.connector_types || []).join(' · '), ports: ports.join(' · '), power: '',
      fee: a.pricing || '', access: a.access || '',
      website: a.network_web || '',
      address: [a.address, a.city, a.state].filter(Boolean).join(', '),
      checkdate: a.open_date || '',
    };
  }).filter((st) => isFinite(st.lat) && isFinite(st.lon));
  return { source: 'afdc', count: stations.length, stations };
}
function networkName(nw) { return nw && nw !== 'Non-Networked' ? nw : ''; }

/* ---------- rest of world: OpenStreetMap / Overpass ---------- */
const EV_CONNECTORS = {
  'socket:type2': 'Type 2', 'socket:type2_cable': 'Type 2', 'socket:type2_combo': 'CCS2',
  'socket:ccs': 'CCS', 'socket:chademo': 'CHAdeMO', 'socket:type1': 'Type 1',
  'socket:type1_combo': 'CCS1', 'socket:tesla_supercharger': 'Tesla',
  'socket:tesla_destination': 'Tesla', 'socket:type3': 'Type 3', 'socket:type3c': 'Type 3',
  'socket:schuko': 'Schuko', 'socket:cee_blue': 'CEE',
};
async function fromOSM(s, w, n, e) {
  const q = `[out:json][timeout:25];node[amenity=charging_station](${s},${w},${n},${e});out body 600;`;
  let j = null;
  for (const base of OVERPASS) {
    try {
      const r = await fetch(base + '?data=' + encodeURIComponent(q));
      if (!r.ok) continue;
      j = await r.json(); break;
    } catch (e) { /* try next mirror */ }
  }
  if (!j) throw new Error('overpass unavailable');
  const stations = (j.elements || [])
    .filter((el) => isFinite(el.lat) && isFinite(el.lon))
    .map((el) => {
      const t = el.tags || {};
      const conns = [];
      for (const k in EV_CONNECTORS) if (t[k] && t[k] !== 'no') conns.push(EV_CONNECTORS[k]);
      let power = '';
      for (const k of ['socket:type2:output', 'socket:ccs:output', 'socket:chademo:output',
        'socket:type2_combo:output', 'maxpower', 'charge']) if (t[k]) { power = String(t[k]); break; }
      if (power && /^[\d.]+$/.test(power)) power += ' kW';
      const cap = t['capacity:motorcar'] || t.capacity || '';
      return {
        id: 'osm' + el.id, lat: el.lat, lon: el.lon,
        title: t.name || t.operator || t.brand || t.network || '',
        operator: t.operator || t.brand || t.network || '', network: t.network || '', status: '',
        conn: [...new Set(conns)].join(' · '), ports: cap ? '×' + cap : '', power,
        fee: t.fee || '', access: (t.access && t.access !== 'yes') ? t.access : '',
        website: t.website || t['contact:website'] || '',
        address: [t['addr:street'], t['addr:city']].filter(Boolean).join(', '),
        checkdate: t.check_date || '',
      };
    });
  return { source: 'osm', count: stations.length, stations };
}

/* ---------- helpers ---------- */
function inUS(lat, lon) {
  return (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) ||  // contiguous
         (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) || // Alaska
         (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154);   // Hawaii
}
function haversine(la1, lo1, la2, lo2) {
  const R = 6371000, d = Math.PI / 180;
  const a = Math.sin((la2 - la1) * d / 2) ** 2 +
    Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin((lo2 - lo1) * d / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function json(o, status = 200, extra = {}) {
  return new Response(JSON.stringify(o),
    { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } });
}
function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const k in CORS) h.set(k, CORS[k]);
  return new Response(resp.body, { status: resp.status, headers: h });
}
