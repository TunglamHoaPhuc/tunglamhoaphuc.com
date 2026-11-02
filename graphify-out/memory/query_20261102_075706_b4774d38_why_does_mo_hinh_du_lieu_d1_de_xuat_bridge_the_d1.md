---
type: "query"
date: "2026-11-02T07:57:06.661927+00:00"
question: "Why does Mo hinh du lieu D1 de xuat bridge the D1 community to six others?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Mô hình dữ liệu D1 đề xuất (thực thể chính)", "Cấu trúc JSON thực tế từ API admin GET", "Giai đoạn 2: Dữ liệu sang D1 (2–4 ngày)", "Media / Album / AlbumItem (r2_key)", "PageView (lượt xem ghi gộp theo ngày)", "Redirect (from_path → to_path, 301)", "User & AuditLog (tài khoản admin, nhật ký)", "Monk (Danh Tăng & Tổ Sư – thực thể mới)", "Cloudflare D1 (SQLite)"]
---

# Q: Why does Mo hinh du lieu D1 de xuat bridge the D1 community to six others?

## Answer

Expanded from original query via vocab: [post, statue, area, calendar, event, page, view, media, album, redirect, monk, registration]. Then BFS + neighbor dump + shortest paths. Mo hinh du lieu D1 de xuat (spec L299-L355) la cau noi vi no la schema dich ma moi chuyen muc deu anh xa vao: Post, TeachingArticle, Page (site cong khai), Area/Statue/StatueCluster (bao tuong), CalendarEvent/Registration/User (lich, dang ky), Publication (admin), Media/PageView/Redirect; duoc nap tu Cau truc JSON thuc te (L357-L383) va nam tren Cloudflare D1. Ca 17 canh deu EXTRACTED. 9 canh INFERRED quanh no deu dung khi doi chieu (Media r2_key -> R2; User.role khop 5 vai tro RBAC; PageView thay viewsCount ghi de file JSON L377). Do thi thieu canh truc tiep Mo hinh D1 -> Giai doan 2 du spec L570 ghi ro mo hinh Phan 3 dung lam schema D1 cho Giai doan 2. Lech pham vi: migration L107 chi liet ke 6 bang (posts, categories, statues, books, views, media) trong khi spec 3.1 + anh xa L383 co khoang 30 bang, cong them viec lam sach du lieu (12 vs 14 khu vuc, 3 dinh dang ngay, 3 dinh dang noi dung, URL anh tren 3 host). Uoc tinh 2-4 ngay cho Giai doan 2 co the thap. Nut Cau truc JSON thuc te la ban le chung giua cau noi /admin va cau noi D1.

## Outcome

- Signal: useful

## Source Nodes

- Mô hình dữ liệu D1 đề xuất (thực thể chính)
- Cấu trúc JSON thực tế từ API admin GET
- Giai đoạn 2: Dữ liệu sang D1 (2–4 ngày)
- Media / Album / AlbumItem (r2_key)
- PageView (lượt xem ghi gộp theo ngày)
- Redirect (from_path → to_path, 301)
- User & AuditLog (tài khoản admin, nhật ký)
- Monk (Danh Tăng & Tổ Sư – thực thể mới)
- Cloudflare D1 (SQLite)