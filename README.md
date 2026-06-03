# 🌍 WikiGlobe

**Tri thức nhân loại quay vòng quanh Trái Đất.** Một góc nhìn mới cho Wikipedia: quả địa cầu 3D xoay tròn, mỗi chấm sáng là một bài viết có toạ độ địa lý — zoom vào vùng nào, đọc tri thức của vùng đó.

> Không clone toàn bộ Wikipedia (vô nghĩa). Khai thác **~1.5 triệu bài geotagged** và load nội dung **on-demand, luôn fresh** qua API chính thức.

## ✨ Tính năng (MVP)
- **Globe 3D** (MapLibre GL v5 `projection: globe`) tự xoay khi idle, trên nền sao.
- **GeoSearch theo viewport** — map di tới đâu, load bài Wikipedia tới đó (`list=geosearch&gsbbox`).
- **Clustering** — zoom xa gom cụm, zoom gần tách từng bài.
- **Panel bài viết** — ảnh + tóm tắt + link đọc full (REST `page/summary`).
- **Đa ngôn ngữ** — VI / EN / FR / 日本, đổi tức thì.
- **Zero backend, zero build, zero API key** — một file `index.html` tự chứa.

## 🚀 Chạy
Mở thẳng `index.html` bằng trình duyệt. Xong.
(Hoặc serve tĩnh: `npx serve .` rồi vào `localhost:3000`.)

## 🧱 Kiến trúc
```
Trình duyệt
 ├─ MapLibre GL v5  → globe + clustering + render
 ├─ Carto dark tiles → basemap vũ trụ
 ├─ Wikipedia GeoSearch API (gsbbox)  → toạ độ bài theo khung nhìn
 └─ Wikipedia REST summary API        → nội dung bài khi click
```
Tất cả gọi trực tiếp từ client (CORS `origin=*`). Không server riêng.

## ⚠️ Giới hạn MVP (cố ý)
- Zoom xa toàn cầu **không load chấm** — `gsbbox` của Wikipedia chặn bbox quá lớn → gate ở zoom ~4.5.
- Tối đa 500 bài / viewport (giới hạn API).

## 🗺️ Roadmap
- [ ] **Cache geo-index → Supabase**: thấy "dải sáng tri thức" toàn cầu kể cả khi zoom xa, không phụ thuộc giới hạn `gsbbox`.
- [ ] **Time slider** 🔥: kéo theo năm, sự kiện/nhân vật hiện theo dòng lịch sử.
- [ ] **Heatmap**: vùng dày tri thức sáng rực — "bản đồ văn minh".
- [ ] **Next.js + deploy** (Vercel / Miaoda) để có link chia sẻ.

## 📚 Nguồn dữ liệu
- Wikipedia / Wikimedia API — nội dung CC BY-SA.
- Basemap © OpenStreetMap, © CARTO.

---
*Realitech — XR/AR/VR. Made by Đạt.*
