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

- [ ] 🔥 **Deep-link & URL state** ⏱️S — đồng bộ `#lat,lng,zoom,lang` vào URL → chia sẻ đúng vị trí; mở lại đúng cảnh. Nền tảng cho mọi tính năng share.
- [ ] 🔥 **Search box** ⏱️M — gõ tên địa điểm → geocode (Nominatim/Wikidata) → bay tới. Cửa ngõ khám phá chính.
- [ ] 🔥 **Time slider lịch sử** ⏱️L — kéo theo năm; lọc bài theo `P585`/năm sinh-mất; sự kiện & nhân vật hiện theo dòng thời gian. *Tính năng "wow" định danh sản phẩm.*
- [ ] ⭐ **Hover preview** ⏱️S — rê chuột vào chấm hiện tooltip tên + ảnh nhỏ (prefetch summary).
- [ ] ⭐ **Sửa panel che nút ngôn ngữ** ⏱️S — trên desktop panel phải đè pill ngôn ngữ; dời pill/đẩy layout khi panel mở.
- [ ] ⭐ **i18n UI chrome** ⏱️M — hiện chữ giao diện chỉ tiếng Việt; tách chuỗi theo `LANG`.
- [ ] 💤 **Loading skeleton + retry mạng** ⏱️S — trạng thái tải mượt, nút thử lại khi lỗi.

---

## 📊 Phase 2 — Chiều sâu dữ liệu (khác biệt cạnh tranh)
Mục tiêu: lấp **gap zoom trung gian** (z6–10 hiện chỉ có đô thị) và làm "bản đồ văn minh" thật sự dày.

- [ ] 🔥 **Geo-index cache → Supabase/D1** ⏱️L — index sẵn bài geotagged toàn cầu → tri thức dày ở mọi mức zoom, không phụ thuộc giới hạn `gsbbox`. *Bước nâng tầm lớn nhất.*
- [ ] ⭐ **Heatmap mật độ** ⏱️M — vùng dày tri thức sáng rực = "bản đồ văn minh".
- [ ] ⭐ **Mở rộng tầng toàn cầu** ⏱️M — không chỉ đô thị: di sản UNESCO, núi, danh thắng, sân bay… (thêm `P31` vào `build-cities.mjs`).
- [ ] ⭐ **Bộ lọc theo loại** ⏱️M — người / sự kiện / địa danh / thiên nhiên; đổi màu & toggle.
- [ ] 💤 **Auto-rebuild `cities.js`** ⏱️S — GitHub Action cron hàng tháng chạy `build-cities.mjs` + commit.

---

## ✨ Phase 3 — Gắn kết & phân phối
Mục tiêu: giữ chân người dùng và lan toả.

- [ ] ⭐ **"Khám phá ngẫu nhiên"** ⏱️S — nút bay tới một nơi nổi bật bất kỳ.
- [ ] ⭐ **Địa điểm nổi bật trong ngày** ⏱️M — featured location, tạo lý do quay lại.
- [ ] 💤 **Tour có chủ đề** ⏱️L — chuỗi điểm dẫn dắt (Con đường tơ lụa, kỳ quan cổ đại…).
- [ ] 💤 **Embed widget / iframe** ⏱️M — nhúng globe vào blog/báo.
- [ ] 💤 **Chia sẻ ảnh cảnh hiện tại** ⏱️M — export PNG có watermark + link.
- [ ] 💤 **Analytics tôn trọng riêng tư** ⏱️S — Plausible/Umami đo lượt dùng.

---

## 🛠️ Phase 4 — Hạ tầng & chất lượng
- [ ] ⭐ **Custom domain + Cloudflare Pages** ⏱️S — `wikiglobe.realitech.dev` (cần `wrangler login`).
- [ ] ⭐ **Cancel/debounce request** ⏱️S — huỷ fetch lưới cũ khi pan nhanh (giảm tải API).
- [ ] 💤 **localStorage cache theo ô** ⏱️M — pan lại vùng đã xem không gọi lại API.
- [ ] 💤 **Accessibility + keyboard nav** ⏱️M — điều hướng/đóng panel bằng phím, ARIA.
- [ ] 💤 **Tách build (Vite) nếu phình to** ⏱️M — chỉ khi single-file quá tải; giữ triết lý nhẹ càng lâu càng tốt.
- [ ] 💤 **Test E2E (Playwright) trong CI** ⏱️M — smoke test mỗi PR.

---

## 🥽 Phase 5 — Tầm nhìn Realitech (XR/AR/VR)
- [ ] 💤 **WebXR** — đứng giữa quả địa cầu tri thức trong VR.
- [ ] 💤 **Public API** — cho người khác build trên geo-index.
- [ ] 💤 **AR "tri thức quanh tôi"** — quét môi trường, hiện bài Wikipedia geotagged.

---

### 🎯 Đề xuất 3 việc làm ngay
1. **Deep-link & URL state** (S) — nền tảng share, rẻ, lợi ngay.
2. **Search box** (M) — mở cửa khám phá.
3. **Time slider** (L) — tính năng định danh, biến demo thành sản phẩm có "linh hồn".
