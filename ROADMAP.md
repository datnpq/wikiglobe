# 🗺️ WikiGlobe — Roadmap phát triển sản phẩm

> Tầm nhìn: **biến địa lý tri thức nhân loại thành thứ "chạm vào được"** — một quả địa cầu nơi mỗi vùng sáng theo mật độ tri thức, kéo được theo thời gian, và mở ra Wikipedia ngay tại chỗ.

**Trạng thái:** MVP live tại https://datnpq.github.io/wikiglobe/ · single-file, zero-backend.

Ký hiệu ưu tiên: 🔥 cao · ⭐ trung bình · 💤 để sau. Effort: ⏱️S/M/L.

---

## ✅ Phase 0 — MVP (xong)
- [x] Globe 3D xoay idle (MapLibre v5 `projection: globe`) trên nền sao
- [x] GeoSearch Wikipedia theo viewport + clustering + panel bài viết
- [x] Đa ngôn ngữ nội dung VI / EN / FR / 日本
- [x] **Tầng văn minh toàn cầu** (`cities.js` từ Wikidata) — globe luôn sáng khi zoom xa
- [x] **Grid-sampling** vượt giới hạn diện tích `gsbbox`
- [x] Idle-spin không còn giành quyền với navigation
- [x] Deploy GitHub Pages + smoke test production

---

## 🚧 Phase 1 — Trải nghiệm cốt lõi (làm tiếp)
Mục tiêu: từ "demo đẹp" → "công cụ dùng được mỗi ngày".

- [x] 🔥 **Tra cứu trực quan + tối ưu UI** ⏱️L — panel có mini-map locator (tile z0 + pin mercator), toạ độ, **bài lân cận** (geosearch chip bấm để nhảy), nút chia sẻ vị trí; **marker pulse** + auto-frame khi mở bài; **responsive** (bar icon-only ≤760px, không tràn ở 390px); **legend** màu chấm; `defer` data để first-paint nhanh. *(xong)*

- [x] 🔥 **Deep-link & URL state** ⏱️S — hash `#zoom/lat/lng/lang`, khôi phục camera + ngôn ngữ khi mở; chia sẻ đúng cảnh. *(xong)*
- [x] 🔥 **Search box** ⏱️M — gõ tên địa điểm → Nominatim → bay tới (fitBounds); autocomplete, phím ↑↓/Enter/Esc. *(xong)*
- [x] 🔥 **Time slider lịch sử** ⏱️L — `events.js` (8.8k sự kiện có `P585`+`P625` từ Wikidata, 1830 TCN→2026); kéo năm → globe hiện sự kiện trong cửa sổ ±25y, tô màu theo thời đại, glow theo độ gần; play tự chạy; chia sẻ khoảnh khắc qua hash `/t<năm>`. *(xong)*
- [x] 🔥 **Onboarding chọn quốc gia + orbit + vệ tinh** ⏱️M — màn mở chọn nước → bay cinematic (pitch 45°) & xoay quanh; nút 🛰 bật ảnh vệ tinh Esri; click cụm bay kiểu điện ảnh. *(xong)*
- [x] ⭐ **Dải giai đoạn sử Việt Nam** ⏱️M — time slider hiện 10 giai đoạn sử VN (Hồng Bàng→Hiện đại) tô màu + nhãn; kéo tới đâu hiện triều đại + cờ VN; click giai đoạn nhảy tới. VN là case chi tiết đầu tiên. *(xong)*
- [x] ⭐ **Cờ thật (SVG)** ⏱️S — flag emoji → ảnh flagcdn, đẹp trên mọi OS. *(xong)*
- [x] ⭐ **Hover preview** ⏱️S — rê chuột vào chấm → tooltip tên + ảnh (prefetch summary, có cache). *(xong)*
- [x] ⭐ **Sửa panel che nút ngôn ngữ** ⏱️S — panel mở → dịch controls top-bar sang trái (desktop). *(xong)*
- [x] ⭐ **i18n UI chrome** ⏱️M — toàn bộ chữ giao diện dịch theo `LANG` (vi/en/fr/ja); tên quốc gia tự localize qua `Intl.DisplayNames`; định dạng năm TCN/BCE/av.J.-C./紀元前. *(xong)*
- [ ] 💤 **Loading skeleton + retry mạng** ⏱️S — trạng thái tải mượt, nút thử lại khi lỗi.

---

## 📊 Phase 2 — Chiều sâu dữ liệu (khác biệt cạnh tranh)
Mục tiêu: lấp **gap zoom trung gian** (z6–10 hiện chỉ có đô thị) và làm "bản đồ văn minh" thật sự dày.

- [x] 🔥 **Geo-index tĩnh (zero-backend)** ⏱️L — `places.js`: 35k địa danh nổi bật (di sản, danh thắng, núi/hồ, công trình…) lọc theo `wikibase:sitelinks`, trộn vào tầng toàn cầu → **lấp dày z6–10**. Thành phố vàng, danh thắng coral. *(xong)*
- [ ] 💤 **Nâng lên Supabase/D1** ⏱️L — nếu cần full coverage (mọi bài, không chỉ nổi bật) + lazy-load theo tile, không phụ thuộc `gsbbox`.
- [x] ⭐ **Heatmap mật độ** ⏱️M — nút 🔥: ~39k điểm (cities+places+people) gộp thành dải nhiệt coral→vàng→trắng = "bản đồ văn minh"; legend vẫn lọc được; fade vào tầng live khi zoom sâu. *(xong)*
- [x] 🔥 **⚡ Lớp trạm sạc EV — vertical mới** ⏱️L — nút ⚡: trạm sạc xe điện từ OpenStreetMap/Overpass theo viewport, cụm xanh lá, panel chi tiết (cổng Type 2/CCS/CHAdeMO, công suất kW, phí, ngày cập nhật, nút Chỉ đường). GET `?data=` + 3 mirror fallback né lỗi 406. **Hướng "lụm tiền toàn cục":** bản OSM để prove UX; moat thật = realtime availability + giá + booking qua partnership/API trả phí (sân B2B REALITECH). *(xong — MVP)*
- [ ] ⭐ **Mở rộng tầng toàn cầu** ⏱️M — không chỉ đô thị: di sản UNESCO, núi, danh thắng, sân bay… (thêm `P31` vào `build-cities.mjs`).
- [x] ⭐ **Đào sâu Việt Nam** ⏱️M — `vn-events.js` (22 sự kiện sử Việt verified) + toggle "🇻🇳 chỉ VN" lọc sự kiện theo vùng & khung VN. *(xong)*
- [x] 🔥 **Phân lớp theo chủ đề** ⏱️L — mỗi điểm gắn lĩnh vực (Đô thị / Lịch sử / Văn hóa / Thiên nhiên / Khoa học) phân loại qua kiểu Wikidata; tô màu riêng; **legend = bộ lọc** bật/tắt từng lăng kính. Globe thành bản đồ tri thức đa lĩnh vực. *(xong)*
- [ ] 💤 **Auto-rebuild `cities.js`** ⏱️S — GitHub Action cron hàng tháng chạy `build-cities.mjs` + commit.

---

## ✨ Phase 3 — Gắn kết & phân phối
Mục tiêu: giữ chân người dùng và lan toả.

- [x] ⭐ **"✨ Khám phá ngẫu nhiên"** ⏱️S — bay cinematic tới một địa danh nổi bật bất kỳ (bias theo notability) & mở bài luôn. *(xong)*
- [x] ⭐ **Địa điểm nổi bật trong ngày** ⏱️M — card ✨ deterministic theo ngày (bias notability), click bay tới + mở bài; hiện sau onboarding, tự ẩn 15s. *(xong)*
- [ ] 💤 **Tour có chủ đề** ⏱️L — chuỗi điểm dẫn dắt (Con đường tơ lụa, kỳ quan cổ đại…).
- [ ] 💤 **Embed widget / iframe** ⏱️M — nhúng globe vào blog/báo.
- [ ] 💤 **Chia sẻ ảnh cảnh hiện tại** ⏱️M — export PNG có watermark + link.
- [ ] 💤 **Analytics tôn trọng riêng tư** ⏱️S — Plausible/Umami đo lượt dùng.

---

## 🛠️ Phase 4 — Hạ tầng & chất lượng
- [ ] ⭐ **Custom domain + Cloudflare Pages** ⏱️S — `wikiglobe.realitech.dev` (cần `wrangler login`).
- [x] ⭐ **Cancel/debounce request** ⏱️S — AbortController huỷ batch geosearch + query EV cũ khi pan nhanh. *(xong)*
- [ ] 💤 **localStorage cache theo ô** ⏱️M — pan lại vùng đã xem không gọi lại API.
- [ ] 💤 **Accessibility + keyboard nav** ⏱️M — điều hướng/đóng panel bằng phím, ARIA.
- [ ] 💤 **Tách build (Vite) nếu phình to** ⏱️M — chỉ khi single-file quá tải; giữ triết lý nhẹ càng lâu càng tốt.
- [ ] 💤 **Test E2E (Playwright) trong CI** ⏱️M — smoke test mỗi PR.

---

## 🥽 Phase 5 — Tầm nhìn Realitech (XR/AR/VR)
- [x] 🔥 **WebXR (POC)** — `xr.html`: three.js globe + chấm tri thức theo lăng kính, Enter VR cho Meta Quest 3 / Pico, controller chĩa-chọn → panel nổi; desktop fallback. Dùng lại lớp data tĩnh. *(xong — proof-of-concept)*
- [x] ⭐ **Hand-tracking** — búng (pinch) tay vào chấm gần để mở, hoặc chĩa tay/tay cầm rồi pinch; bàn tay hiện dạng khớp cầu. *(xong)*
- [ ] ⭐ **WebXR nâng cao** — time-slider dạng núm vặt 3D, lọc lăng kính trong VR, AR passthrough/để-bàn, multi-user (lớp học).
- [ ] 💤 **Public API** — cho người khác build trên geo-index.
- [ ] 💤 **AR "tri thức quanh tôi"** — quét môi trường, hiện bài Wikipedia geotagged.

---

### 🎯 Đề xuất 3 việc làm tiếp
1. **localStorage cache theo ô** (M) — pan lại vùng đã xem không gọi lại API; mượt + nhẹ tải Wikipedia/Overpass.
2. **EV: realtime availability + giá** (L) — moat thương mại thật; cần partnership/API trả phí (OpenChargeMap, hãng sạc).
3. **Featured có ảnh thumbnail + heatmap cho lớp EV** (M) — tăng chiều sâu trải nghiệm, "lý do quay lại".
