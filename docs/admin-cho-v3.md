# Admin của www điều khiển V3 đến đâu

Cập nhật 23/11/2026. V3 (`v3.tunglamhoaphuc.com`, Worker `tlhp-v3`) không có admin và không ghi gì. Nó đọc **cùng D1 `tlhp-db` và R2 `tlhp-media`** với www, nên mọi thứ sửa ở `https://www.tunglamhoaphuc.com/quan-tri` (đăng nhập tại `/quan-tri/dang-nhap`) hiện sang V3.

## Đã nối (đọc từ D1/R2 trong mỗi lần dựng trang)

- Bài viết Dòng Chảy và Trí Tuệ: trạng thái (nháp, chờ duyệt, tạm ẩn, hẹn giờ, thùng rác), ghim, lời dẫn, bài liên quan, SEO (tiêu đề, mô tả, ảnh chia sẻ), trường riêng (âm thanh, YouTube, sách), đổi slug và chuyển hướng.
- Tông Chỉ, Giới thiệu, Vũ Trụ Phật Giáo (khu vực, khu vực nổi bật, vị trí ghim bản đồ), Bảo tượng, sự kiện lịch tu học, thư viện ảnh.
- Menu đầu trang, giờ mở cửa, địa chỉ, điện thoại, mạng xã hội, bản đồ, tên chùa, thông báo (`site.announcement`, có công tắc và hạn).
- Chuyên mục (tên, icon) và nhóm Tông Chỉ: dựng từ D1; bộ lọc Dòng Chảy và bảng điều hướng phụ cũng vậy.

## Trang chủ V3 do admin điều khiển (cập nhật 23/11/2026)

Mọi khối của trang chủ đọc từ D1 trong mỗi lần dựng trang (kiểm bằng 33 tình huống admin ghi, V3 đọc: `tests/unit/v3-www-admin-home-roundtrip.test.ts`):

| Khối | Nguồn trong admin |
|---|---|
| Đầu trang (nhiều khung xoay, nút, khung "Khóa tu sắp tới", khung "Pháp sự mới nhất") | Trang chủ › khung đầu trang (`home.hero`), Lịch tu học, Bài viết |
| Video đầu trang | Trang chủ › Lời chào (`home.welcome.videoUrl`) |
| Lời chào, số liệu (tối đa 3), Phật lịch | `home.welcome`, `home.stats`, `home.buddhist_year`; số bài đếm từ bài đang hiển thị |
| Tin mới nhất | Bài viết (nháp, ẩn, hẹn giờ, thùng rác, ghim), Tông Chỉ, Giới thiệu, Bảo tượng |
| Dấu ấn hoằng pháp | Lượt xem thật của bài |
| Lời Thầy dạy | Lời Thầy (`quote`) + `home.quotes` (nguồn, chế độ), hoặc câu kệ chủ đề tháng |
| Lịch tu học | Sự kiện, khóa lễ thường kỳ, chủ đề tháng (khớp www từng ngày) |
| Khu vực & Bảo tượng | Khu vực nổi bật (`area.featured`), tượng đang hiển thị |
| Chân trang, thông báo | Cài đặt › Thông tin trang, `site.announcement` |

Cũng đã nối: bài (ghim, lời dẫn, bài liên quan, trường riêng, SEO từng trang), menu phụ, chuyên mục (tên, icon, thứ tự Dòng Chảy), Bảo tượng đủ 126, âm lịch đúng tháng nhuận (trước đây V3 lệch ở 2025 và 2028).

## Chưa nối

- Chữ phụ, ảnh của từng khung đầu trang: Hero V3 là video toàn khung, chưa có chỗ vẽ ảnh khung. Ảnh dải bên cạnh video của khối Lời chào và hộp "Chư Tôn Đức" cũng chưa vẽ.
- Đại lễ cố định (Tết, Phật Đản, Vu Lan…) không còn tự hiện trên lịch nếu admin chưa tạo thành sự kiện (www cũng không tự sinh).
- "Kho ảnh tư liệu" (Galaxy timeline): chữ và ảnh mẫu viết sẵn, admin chưa có màn hình nào cho nó; nên ẩn nút mở nó hoặc thêm màn "ảnh theo mốc".
- Trợ lý Phật học (thanh tìm kiếm AI) là bản trả lời soạn sẵn, hai liên kết trong đó sai (`/tong-chi-tu-hoc/bo-de-tam`, `/#lich-tu`).
- Bảo tượng nổi bật: admin chưa có cờ `featured` cho tượng (V3 giữ 4 mã chọn sẵn).
- Thứ tự nhóm Tông Chỉ (gắn với ảnh nền của thiết kế 5 nhóm); trang tượng chưa vẽ ảnh nhiều góc, thông số, tượng liên quan; chân trang không vẽ menu chân trang; V3 chưa có `sitemap.xml` và đang `noindex` (phải bỏ khi V3 thành trang chính).

## Độ trễ sau khi sửa trong admin

Admin chỉ xóa cache của www. V3 có cache riêng: trang chi tiết làm mới sau tối đa 30 giây, danh sách Dòng Chảy 60 giây, bản đọc D1 trong bộ nhớ 15 giây. Lượt xem đầu tiên sau khi hết hạn vẫn có thể thấy bản cũ (cache kiểu "phục vụ bản cũ, làm mới nền"); trang không ai ghé có thể giữ bản cũ lâu hơn.

## Kiểm thử

- `tests/unit/v3-www-admin-roundtrip.test.ts`: chạy mã admin của www ghi 14 tình huống (xuất bản, ẩn, hẹn giờ, thùng rác, đổi slug, đổi chuyên trang, trường riêng) rồi đọc bằng lớp đọc của V3. Chạy: `TLHP_WWW_SRC=E:/tlhp-av3/src npm test`.
- Lệch giữa www và V3 sau khi tạo/sửa là lỗi; nếu www đổi API admin thì `tests/helpers/www-admin-world.mjs` có thể phải sửa theo.
