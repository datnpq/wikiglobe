# ⚡ WikiGlobe EV proxy (Cloudflare Worker)

Một endpoint duy nhất, trộn nguồn trạm sạc theo vùng và **giấu API key** server-side.

```
GET /stations?bbox=<south>,<west>,<north>,<east>
```

- 🇺🇸 **Mỹ** → RapidAPI *EV Stations* (NREL AFDC — giàu data: status, số cổng L2/DC, network, pricing)
- 🌍 **còn lại** → OpenStreetMap / Overpass (phủ toàn cầu, gồm VN)
- 💾 Cache edge 1 ngày → bảo vệ quota free (1000 req/tháng) + nhanh
- 🔒 Key nằm trong secret `RAPIDAPI_KEY`, **không bao giờ** lộ ra client

Response (đã chuẩn hóa 1 schema cho cả 2 nguồn):
```json
{ "source": "afdc|osm", "count": 12, "stations": [
  { "id","lat","lon","title","operator","network","status","conn",
    "ports","power","fee","access","website","address","checkdate" } ] }
```

## Deploy (cần tài khoản Cloudflare của ný — chạy trong terminal)

```bash
cd ev-proxy
npm i -g wrangler          # nếu chưa có
wrangler login             # mở trình duyệt, đăng nhập Cloudflare (1 lần)
wrangler secret put RAPIDAPI_KEY   # dán key RapidAPI khi được hỏi
wrangler deploy            # in ra URL: https://wikiglobe-ev.<subdomain>.workers.dev
```

> 💡 Trong Claude Code, gõ `!wrangler login` để chạy ngay trong phiên này.

Sau khi deploy, copy URL Worker và dán vào `index.html`:
```js
const EV_PROXY = 'https://wikiglobe-ev.<subdomain>.workers.dev';
```
Bỏ trống `EV_PROXY` thì WikiGlobe tự fallback gọi thẳng Overpass (như cũ) — vẫn chạy.

## Test nhanh sau khi deploy
```bash
# Mỹ (giàu data, có status)
curl "https://wikiglobe-ev.<sub>.workers.dev/stations?bbox=37.30,-121.95,37.40,-121.85"
# Việt Nam (qua OSM)
curl "https://wikiglobe-ev.<sub>.workers.dev/stations?bbox=10.72,106.62,10.84,106.78"
```

## Bảo mật
- Key chỉ sống trong secret của Worker. Client chỉ thấy URL `*.workers.dev`.
- Muốn khoá chặt hơn: thêm kiểm tra `Origin`/`Referer` trong Worker, hoặc Cloudflare WAF rate-limit theo IP.
