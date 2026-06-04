/**
 * WikiGlobe EV proxy — Cloudflare Worker with durable tile cache
 *
 *   GET /stations?bbox=<south>,<west>,<north>,<east>
 *
 * Resource-optimal design (the AFDC free quota is tiny, ~1000 req/month):
 *  1. Quantise the world into fixed 0.5° tiles. A viewport snaps to the tiles
 *     covering it, so every visitor of the same area shares the same cache key.
 *  2. Each tile is stored DURABLY in KV ({ t: fetchedAt, src, stations }).
 *     Unlike the edge cache, KV is global and isn't evicted per-datacentre.
 *  3. Stale-while-revalidate: a fresh tile (<7d) is served with ZERO upstream
 *     calls; a stale tile is served instantly and refreshed in the background;
 *     only a missing tile blocks on a live fetch.
 *  4. Monthly AFDC budget counter in KV — once spent, we serve stale/empty
 *     instead of burning quota. The key never reaches the client.
 *  5. A nightly cron refreshes the oldest known US tiles within budget, so
 *     popular areas stay fresh without depending on user traffic.
 *
 * Sources: 🇺🇸 RapidAPI "EV Stations" (NREL AFDC) · 🌍 OpenStreetMap/Overpass.
 * Set the key once:  wrangler secret put RAPIDAPI_KEY
 * Bind KV:           wrangler kv namespace create EV_CACHE  (id → wrangler.toml)
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

const TILE = 0.5;                          // degrees per cache tile (~55 km, metro-sized)
const FRESH_MS = 7 * 24 * 3600 * 1000;     // under this age → serve, no refresh
const STALE_MS = 60 * 24 * 3600 * 1000;    // beyond this → treat as missing (KV TTL too)
const MAX_TILES = 16;                      // cap tiles fetched per viewport request
const AFDC_BUDGET = 900;                   // monthly AFDC call ceiling (free plan ~1000)
const CRON_CAP = 40;                       // max tiles refreshed per cron run
const CACHE_V = 1;                          // bump to invalidate every tile (e.g. when adding OCM)

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

    if (!env.EV_CACHE) {
      // KV not bound yet → behave as a plain pass-through (still works, no caching)
      const src = inUS((s + n) / 2, (w + e) / 2) ? 'afdc' : 'osm';
      try {
        const stations = await fetchSource(src, { s, w, n, e }, env);
        return json({ source: src, count: stations.length, stations, cached: false });
      } catch (err) { return json({ error: String(err) }, 502); }
    }

    const tiles = tilesFor(s, w, n, e);
    const now = Date.now();
    const quota = await quotaGet(env);
    const afdcAllowed = quota < AFDC_BUDGET;
    let newAfdc = 0;
    const dbg = [];

    const perTile = await Promise.all(tiles.map(async (tile) => {
      const src = sourceForTile(tile);
      const key = `ev:v${CACHE_V}:${src}:${tile.tx}:${tile.ty}`;
      const raw = await env.EV_CACHE.get(key, 'json');
      const age = raw ? now - raw.t : Infinity;

      if (raw && age < FRESH_MS) return raw.stations;          // fresh → zero upstream cost

      if (src === 'afdc' && !afdcAllowed) return raw ? raw.stations : [];  // out of budget

      if (raw && age < STALE_MS) {                              // stale → serve now, refresh bg
        if (src === 'afdc') newAfdc++;
        ctx.waitUntil(refreshTile(src, key, tile, env));
        return raw.stations;
      }

      try {                                                     // missing → blocking fetch
        const stations = await fetchSource(src, tile, env);
        if (src === 'afdc') newAfdc++;
        ctx.waitUntil(env.EV_CACHE.put(key, JSON.stringify({ t: now, src, stations }),
          { expirationTtl: Math.ceil(STALE_MS / 1000) }));
        return stations;
      } catch (e) { dbg.push(src + ': ' + (e && e.message || e)); return raw ? raw.stations : []; }
    }));

    if (newAfdc) ctx.waitUntil(quotaInc(env, newAfdc));
    const debug = url.searchParams.get('debug');

    const seen = new Set(), stations = [];
    for (const arr of perTile) for (const st of arr || []) {
      if (st && !seen.has(st.id)) { seen.add(st.id); stations.push(st); }
    }
    return json(
      { count: stations.length, stations, tiles: tiles.length, quotaUsed: quota + newAfdc,
        ...(debug ? { _dbg: dbg } : {}) },
      200, { 'Cache-Control': 'public, max-age=3600' });
  },

  // nightly: refresh the oldest known US tiles, within the monthly budget
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cronRefresh(env));
  },
};

/* ---------- tiling ---------- */
function tilesFor(s, w, n, e) {
  const t = [];
  const x0 = Math.floor(w / TILE), x1 = Math.floor(e / TILE);
  const y0 = Math.floor(s / TILE), y1 = Math.floor(n / TILE);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    t.push({ tx: x, ty: y, s: y * TILE, w: x * TILE, n: (y + 1) * TILE, e: (x + 1) * TILE });
    if (t.length >= MAX_TILES) return t;
  }
  return t;
}
function sourceForTile(tile) {
  return inUS((tile.s + tile.n) / 2, (tile.w + tile.e) / 2) ? 'afdc' : 'osm';
}

/* ---------- quota counter (soft monthly cap) ---------- */
function monthKey() { return 'afdc:quota:' + new Date().toISOString().slice(0, 7); }
async function quotaGet(env) { return +(await env.EV_CACHE.get(monthKey())) || 0; }
async function quotaInc(env, by) {
  const k = monthKey();
  const v = (+(await env.EV_CACHE.get(k)) || 0) + by;
  await env.EV_CACHE.put(k, String(v), { expirationTtl: 62 * 24 * 3600 });
}

/* ---------- background + cron refresh ---------- */
async function refreshTile(src, key, tile, env) {
  try {
    const stations = await fetchSource(src, tile, env);
    await env.EV_CACHE.put(key, JSON.stringify({ t: Date.now(), src, stations }),
      { expirationTtl: Math.ceil(STALE_MS / 1000) });
  } catch (e) { /* keep the old tile */ }
}
async function cronRefresh(env) {
  if (!env.EV_CACHE) return;
  let quota = await quotaGet(env);
  if (quota >= AFDC_BUDGET) return;
  const { keys } = await env.EV_CACHE.list({ prefix: `ev:v${CACHE_V}:afdc:` });
  const now = Date.now(); let spent = 0;
  for (const k of keys) {
    if (quota + spent >= AFDC_BUDGET || spent >= CRON_CAP) break;
    const raw = await env.EV_CACHE.get(k.name, 'json');
    if (!raw || now - raw.t < FRESH_MS) continue;            // still fresh → skip
    const p = k.name.split(':');                             // ev:v1:afdc:tx:ty
    const tx = +p[3], ty = +p[4];
    const tile = { tx, ty, s: ty * TILE, w: tx * TILE, n: (ty + 1) * TILE, e: (tx + 1) * TILE };
    try {
      const stations = await fetchSource('afdc', tile, env);
      await env.EV_CACHE.put(k.name, JSON.stringify({ t: Date.now(), src: 'afdc', stations }),
        { expirationTtl: Math.ceil(STALE_MS / 1000) });
      spent++;
    } catch (e) { /* skip */ }
  }
  if (spent) await quotaInc(env, spent);
}

/* ---------- sources (return a normalised station[] for one tile) ---------- */
async function fetchSource(src, tile, env) {
  if (src === 'afdc') {
    const lat = (tile.s + tile.n) / 2, lon = (tile.w + tile.e) / 2;
    const radius = Math.min(80000, Math.round(haversine(lat, lon, tile.n, tile.e)));
    return afdcFetch(lat, lon, radius, env);
  }
  // non-US: merge OpenChargeMap (rich: kW, operator, status) + OSM, dedupe ~100m
  const ocm = env.OCM_KEY ? await ocmFetch(tile.s, tile.w, tile.n, tile.e, env).catch(() => null) : null;
  const osm = await osmFetch(tile.s, tile.w, tile.n, tile.e).catch(() => null);
  if (ocm === null && osm === null) throw new Error('sources unavailable');
  return dedupe([...(ocm || []), ...(osm || [])]);   // OCM first → wins on a duplicate
}
function dedupe(list) {
  const seen = new Map();
  for (const st of list) {
    const k = st.lat.toFixed(3) + ',' + st.lon.toFixed(3);   // ~100 m grid
    if (!seen.has(k)) seen.set(k, st);
  }
  return [...seen.values()];
}

/* OpenChargeMap — richer EV data (power kW, operator, connections, status) */
async function ocmFetch(s, w, n, e, env) {
  const bb = `(${n},${w}),(${s},${e})`;
  const u = `https://api.openchargemap.io/v3/poi?output=json&boundingbox=${encodeURIComponent(bb)}` +
    `&maxresults=200&compact=true&verbose=false&key=${env.OCM_KEY}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'WikiGlobe/1.0 (+https://datnpq.github.io/wikiglobe/)' } });
  if (!r.ok) throw new Error('ocm ' + r.status);
  const arr = await r.json();
  return (arr || []).filter((p) => p.AddressInfo).map((p) => {
    const ai = p.AddressInfo, conns = [];
    for (const c of (p.Connections || [])) if (c.ConnectionType && c.ConnectionType.Title) conns.push(c.ConnectionType.Title);
    const kw = Math.max(0, ...(p.Connections || []).map((c) => c.PowerKW || 0));
    return {
      id: 'ocm' + p.ID, lat: ai.Latitude, lon: ai.Longitude,
      title: ai.Title || '', operator: (p.OperatorInfo && p.OperatorInfo.Title) || '',
      network: (p.OperatorInfo && p.OperatorInfo.Title) || '',
      status: (p.StatusType && p.StatusType.Title) || '',
      conn: [...new Set(conns)].join(' · '), ports: p.NumberOfPoints ? '×' + p.NumberOfPoints : '',
      power: kw ? kw + ' kW' : '',
      fee: p.UsageCost || '', access: '', website: (p.OperatorInfo && p.OperatorInfo.WebsiteURL) || '',
      address: [ai.AddressLine1, ai.Town].filter(Boolean).join(', '),
      checkdate: (p.DateLastStatusUpdate || '').slice(0, 10),
    };
  }).filter((st) => isFinite(st.lat) && isFinite(st.lon));
}

async function afdcFetch(lat, lon, radius, env) {
  if (!env.RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY secret not set');
  const u = `https://${AFDC_HOST}/stations?lat=${lat}&lon=${lon}&radius=${radius}&public_only=true&limit=50`; // AFDC caps limit at 50
  const r = await fetch(u, { headers: { 'x-rapidapi-host': AFDC_HOST, 'x-rapidapi-key': env.RAPIDAPI_KEY } });
  if (!r.ok) throw new Error('afdc ' + r.status);
  const j = await r.json();
  return (j.results || []).map((a) => {
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
      fee: a.pricing || '', access: a.access || '', website: a.network_web || '',
      address: [a.address, a.city, a.state].filter(Boolean).join(', '), checkdate: a.open_date || '',
    };
  }).filter((st) => isFinite(st.lat) && isFinite(st.lon));
}
function networkName(nw) { return nw && nw !== 'Non-Networked' ? nw : ''; }

const EV_CONNECTORS = {
  'socket:type2': 'Type 2', 'socket:type2_cable': 'Type 2', 'socket:type2_combo': 'CCS2',
  'socket:ccs': 'CCS', 'socket:chademo': 'CHAdeMO', 'socket:type1': 'Type 1',
  'socket:type1_combo': 'CCS1', 'socket:tesla_supercharger': 'Tesla',
  'socket:tesla_destination': 'Tesla', 'socket:type3': 'Type 3', 'socket:type3c': 'Type 3',
  'socket:schuko': 'Schuko', 'socket:cee_blue': 'CEE',
};
async function osmFetch(s, w, n, e) {
  const q = `[out:json][timeout:25];node[amenity=charging_station](${s},${w},${n},${e});out body 600;`;
  let j = null;
  for (const base of OVERPASS) {
    try {
      const r = await fetch(base + '?data=' + encodeURIComponent(q),
        { headers: { 'User-Agent': 'WikiGlobe/1.0 (+https://datnpq.github.io/wikiglobe/)' } });
      if (!r.ok) continue;
      j = await r.json(); break;
    } catch (e) { /* next mirror */ }
  }
  if (!j) throw new Error('overpass unavailable');
  return (j.elements || []).filter((el) => isFinite(el.lat) && isFinite(el.lon)).map((el) => {
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
      address: [t['addr:street'], t['addr:city']].filter(Boolean).join(', '), checkdate: t.check_date || '',
    };
  });
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
