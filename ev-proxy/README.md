# ⚡ WikiGlobe EV proxy (Cloudflare Worker + KV tile cache)

Một endpoint, trộn nguồn theo vùng, **giấu key**, và **cache bền theo tile** để không cháy quota.

```
GET /stations?bbox=<south>,<west>,<north>,<east>
```

- 🇺🇸 **Mỹ** → RapidAPI *EV Stations* (NREL AFDC: status, số cổng L2/DC, network, pricing)
- 🌍 **còn lại** → OpenStreetMap / Overpass (toàn cầu, gồm VN)

## 🧠 Tối ưu tài nguyên (quota AFDC ~1000 req/tháng)
1. **Tile 0.5°**: viewport snap về các ô cố định → mọi lượt xem cùng vùng dùng chung cache key.
2. **KV bền**: mỗi tile lưu `{t, src, stations}` trên KV (global, không bị evict như edge cache).
3. **Stale-while-revalidate**: tile <7 ngày → trả ngay, **0 call**; tile cũ → trả ngay + refresh ngầm; tile chưa có → mới fetch.
4. **Ngân sách quota**: đếm call AFDC/tháng trong KV, chạm 900 thì ngừng gọi (phục vụ data cũ) → **không bao giờ cháy**.
5. **Cron mỗi đêm**: refresh các tile US cũ nhất, ≤40 tile/lần + trong ngân sách → data luôn tươi không cần lượt mở.

→ Lần đầu xem 1 vùng tốn vài call; sau đó **gần như free mãi**.

Response (chuẩn hóa 1 schema cho cả 2 nguồn):
```json
{ "count": 12, "tiles": 2, "quotaUsed": 37, "stations": [
  { "id","lat","lon","title","operator","network","status","conn",
    "ports","power","fee","access","website","address","checkdate" } ] }
```

## 🚀 Deploy (đã `wrangler login` rồi)

```bash
cd C:\Users\Admin\wikiglobe\ev-proxy

# 1) Tạo KV namespace → copy id nó in ra
npx wrangler kv namespace create EV_CACHE
#   dán id vào wrangler.toml (thay PASTE_KV_ID_HERE)

# 2) Nạp key RapidAPI (vào secret, không lộ ra client)
npx wrangler secret put RAPIDAPI_KEY
#   dán: 9e6ca3fb53msh4adc055e6921835p116ea4jsn07562cf4a420

# 3) Deploy
npx wrangler deploy
#   → URL: https://wikiglobe-ev.<subdomain>.workers.dev
```

Xong gửi anh URL → anh set `EV_PROXY` trong `index.html`, commit + push.

## Test sau deploy
```bash
curl "https://wikiglobe-ev.<sub>.workers.dev/stations?bbox=37.30,-121.95,37.40,-121.85"  # US, có status
curl "https://wikiglobe-ev.<sub>.workers.dev/stations?bbox=10.72,106.62,10.84,106.78"     # VN, qua OSM
```
Gọi lần 2 cùng vùng → `quotaUsed` không tăng (đã cache tile).

## Bảo mật
Key chỉ sống trong secret Worker; client chỉ thấy URL `*.workers.dev`. Siết thêm: kiểm `Origin`/`Referer` hoặc WAF rate-limit.
