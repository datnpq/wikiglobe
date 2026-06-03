# 🌍 WikiGlobe

**Tri thức nhân loại quay vòng quanh Trái Đất.** Một góc nhìn mới cho Wikipedia: quả địa cầu 3D xoay tròn, mỗi chấm sáng là một bài viết có toạ độ địa lý — zoom vào vùng nào, đọc tri thức của vùng đó.

> Không clone toàn bộ Wikipedia (vô nghĩa). Khai thác **~1.5 triệu bài geotagged** và load nội dung **on-demand, luôn fresh** qua API chính thức.

## ✨ Tính năng (MVP)
- **Globe 3D** (MapLibre GL v5 `projection: globe`) tự xoay khi idle, trên nền sao.
- **Dữ liệu 2 tầng** — globe **luôn sáng**:
  - *Tầng toàn cầu* (zoom xa→trung bình): ~4.000 đô thị (`cities.js`, vàng) + ~35.000 địa danh nổi bật (`places.js`, coral — di sản, danh thắng, núi/hồ…) → dày tri thức ở mọi mức zoom.
  - *Tầng live* (zoom gần): geosearch Wikipedia thật theo viewport, chấm coral.
- **Grid-sampling** — chia khung nhìn thành ô nhỏ rồi gộp, vượt giới hạn diện tích `gsbbox`.
- **Clustering** — zoom xa gom cụm, zoom gần tách từng bài.
- **Dòng thời gian** 🕰 — kéo năm (1830 TCN → 2026), globe hiện sự kiện lịch sử tô màu theo thời đại; có nút tự chạy; chia sẻ khoảnh khắc qua URL.
- **Tìm địa điểm** 🔍 — gõ tên → bay tới (Nominatim).
- **Deep-link** — vị trí/zoom/ngôn ngữ/năm nằm trong URL hash, chia sẻ đúng cảnh.
- **Panel bài viết** — ảnh + tóm tắt + link đọc full (REST `page/summary`).
- **Đa ngôn ngữ** — VI / EN / FR / 日本, đổi tức thì (tầng văn minh rebuild theo ngôn ngữ).
- **Zero backend, zero build, zero API key** — mở `index.html` là chạy (kể cả `file://`).

## 🚀 Chạy
Mở thẳng `index.html` bằng trình duyệt. Xong.
(Hoặc serve tĩnh: `npx serve .` rồi vào `localhost:3000`.)

## 🧱 Kiến trúc
```
Trình duyệt
 ├─ MapLibre GL v5  → globe + clustering + render
 ├─ Carto dark tiles → basemap vũ trụ
 ├─ cities.js (tĩnh)  → tầng văn minh toàn cầu khi zoom xa
 ├─ Wikipedia GeoSearch API (gsbbox, grid-sample) → bài theo khung nhìn khi zoom gần
 └─ Wikipedia REST summary API → nội dung bài khi click

Build (1 lần): scripts/build-cities.mjs  ──Wikidata SPARQL──▶ cities.js
```
Tất cả gọi trực tiếp từ client (CORS `origin=*`). Không server riêng.

### 🔄 Tạo lại `cities.js`
```
node scripts/build-cities.mjs
```
Query Wikidata Query Service (đô thị `P31`, dân số > 80k) + sitelink vi/en/fr/ja,
xuất `window.WIKIGLOBE_CITIES`. Nạp qua thẻ `<script src>` nên chạy được cả khi mở `file://`.

## ⚠️ Giới hạn MVP (cố ý)
- `gsbbox` của Wikipedia chặn box theo **diện tích** (~0.033°²) → tầng live chỉ bật khi viewport đủ nhỏ (≈ zoom ≥ 10); zoom trung gian hiển thị các đô thị lớn của tầng văn minh.
- Tối đa 500 bài / ô lưới.
- Tầng văn minh chỉ gồm đô thị; địa danh/di tích chưa có.

## 🗺️ Roadmap
Xem [ROADMAP.md](ROADMAP.md) cho checklist đầy đủ theo phase.
- [x] **Tầng văn minh toàn cầu** (`cities.js` từ Wikidata): globe luôn sáng khi zoom xa.
- [x] **Deep-link**, **Search box**, **Time slider lịch sử** (`events.js`).
- [ ] **Cache geo-index → Supabase**: tri thức dày đặc kể cả zoom trung gian, không phụ thuộc giới hạn `gsbbox`.
- [ ] **Time slider** 🔥: kéo theo năm, sự kiện/nhân vật hiện theo dòng lịch sử.
- [ ] **Heatmap**: vùng dày tri thức sáng rực — "bản đồ văn minh".
- [ ] **Next.js + deploy** (Vercel / Miaoda) để có link chia sẻ.

## 📚 Nguồn dữ liệu
- Wikipedia / Wikimedia API — nội dung CC BY-SA.
- Basemap © OpenStreetMap, © CARTO.

---
*Realitech — XR/AR/VR. Made by Đạt.*
