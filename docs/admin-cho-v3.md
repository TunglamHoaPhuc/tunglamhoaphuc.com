# Admin của www điều khiển V3 đến đâu

Cập nhật 23/11/2026. V3 (`v3.tunglamhoaphuc.com`, Worker `tlhp-v3`) không có admin và không ghi gì. Nó đọc **cùng D1 `tlhp-db` và R2 `tlhp-media`** với www, nên mọi thứ sửa ở `https://www.tunglamhoaphuc.com/quan-tri` (đăng nhập tại `/quan-tri/dang-nhap`) hiện sang V3.

## Đã nối (đọc từ D1/R2 trong mỗi lần dựng trang)

- Bài viết Dòng Chảy và Trí Tuệ: trạng thái (nháp, chờ duyệt, tạm ẩn, hẹn giờ, thùng rác), ghim, lời dẫn, bài liên quan, SEO (tiêu đề, mô tả, ảnh chia sẻ), trường riêng (âm thanh, YouTube, sách), đổi slug và chuyển hướng.
- Tông Chỉ, Giới thiệu, Vũ Trụ Phật Giáo (khu vực, khu vực nổi bật, vị trí ghim bản đồ), Bảo tượng, sự kiện lịch tu học, thư viện ảnh.
- Menu đầu trang, giờ mở cửa, địa chỉ, điện thoại, mạng xã hội, bản đồ, tên chùa, thông báo (`site.announcement`, có công tắc và hạn).
- Chuyên mục (tên, icon) và nhóm Tông Chỉ: dựng từ D1; bộ lọc Dòng Chảy và bảng điều hướng phụ cũng vậy.

## Đã nối thêm (cập nhật cuối 23/11/2026)

- Trang chủ: tiêu đề, dòng phụ và video của Hero theo `home.hero` và `home.welcome.videoUrl` (video nằm ở khối "Lời chào" trong admin); "Dấu ấn hoằng pháp" theo lượt xem thật.
- Lịch tu học trên trang chủ: sự kiện riêng lẻ từ `calendar_event` (chỉ đã xuất bản, chưa xóa), khóa lễ thường kỳ từ `featured_program`, chủ đề tháng từ `month_theme`; kết quả khớp mã đọc lịch của www qua 36 tháng. Bộ sinh ngày âm lịch viết sẵn chỉ còn là dự phòng khi D1 không có chương trình thường kỳ: các đại lễ cố định (Tết, Phật Đản, Vu Lan…) không tự hiện nữa nếu admin chưa tạo thành sự kiện (www cũng không tự sinh chúng).
- Bảo tượng: danh sách hiện đủ mọi tượng đang hiển thị (62 tượng chính theo chúng hội, 64 tượng "Nghệ thuật Phật giáo" ở khối riêng, bộ lọc "Loại"); trang tượng liệt kê hết biến thể.
- Thứ tự chuyên mục Dòng Chảy theo vị trí admin sắp xếp. Lớp đọc đã có thêm vị trí chuyên mục, vị trí nhóm Tông Chỉ, ảnh nhiều góc, thông số và SEO của tượng, và `listQuotes()`.

## Chưa nối (cần chủ dự án quyết cách thiết kế)

- Trang chủ V3 không có khối chào, số liệu (472 bài…, Phật lịch) và Lời Thầy để vẽ; hàm đọc đã có (`homeSettings.ts`, `listQuotes()`). Chữ phụ, nút và ảnh của từng slide Hero, cờ tự lấy sự kiện/bài mới cũng chưa dùng vì Hero V3 chỉ có một video.
- Thứ tự nhóm Tông Chỉ do admin sắp xếp chưa dùng: thứ tự nhóm gắn với ảnh nền và số thứ tự của thiết kế 5 nhóm.
- Trang tượng chưa vẽ ảnh nhiều góc, thông số, "Bảo tượng liên quan" (dữ liệu đã có trong lớp đọc).
- Chân trang không vẽ menu chân trang; V3 không có `sitemap.xml` (V3 đang `noindex`); nhóm Giới thiệu chưa có vị trí.

## Độ trễ sau khi sửa trong admin

Admin chỉ xóa cache của www. V3 có cache riêng: trang chi tiết làm mới sau tối đa 30 giây, danh sách Dòng Chảy 60 giây, bản đọc D1 trong bộ nhớ 15 giây. Lượt xem đầu tiên sau khi hết hạn vẫn có thể thấy bản cũ (cache kiểu "phục vụ bản cũ, làm mới nền"); trang không ai ghé có thể giữ bản cũ lâu hơn.

## Kiểm thử

- `tests/unit/v3-www-admin-roundtrip.test.ts`: chạy mã admin của www ghi 14 tình huống (xuất bản, ẩn, hẹn giờ, thùng rác, đổi slug, đổi chuyên trang, trường riêng) rồi đọc bằng lớp đọc của V3. Chạy: `TLHP_WWW_SRC=E:/tlhp-av3/src npm test`.
- Lệch giữa www và V3 sau khi tạo/sửa là lỗi; nếu www đổi API admin thì `tests/helpers/www-admin-world.mjs` có thể phải sửa theo.
