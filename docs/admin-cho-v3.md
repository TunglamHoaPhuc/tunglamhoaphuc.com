# Admin của www điều khiển V3 đến đâu

Cập nhật 23/11/2026. V3 (`v3.tunglamhoaphuc.com`, Worker `tlhp-v3`) không có admin và không ghi gì. Nó đọc **cùng D1 `tlhp-db` và R2 `tlhp-media`** với www, nên mọi thứ sửa ở `https://www.tunglamhoaphuc.com/quan-tri` (đăng nhập tại `/quan-tri/dang-nhap`) hiện sang V3.

## Đã nối (đọc từ D1/R2 trong mỗi lần dựng trang)

- Bài viết Dòng Chảy và Trí Tuệ: trạng thái (nháp, chờ duyệt, tạm ẩn, hẹn giờ, thùng rác), ghim, lời dẫn, bài liên quan, SEO (tiêu đề, mô tả, ảnh chia sẻ), trường riêng (âm thanh, YouTube, sách), đổi slug và chuyển hướng.
- Tông Chỉ, Giới thiệu, Vũ Trụ Phật Giáo (khu vực, khu vực nổi bật, vị trí ghim bản đồ), Bảo tượng, sự kiện lịch tu học, thư viện ảnh.
- Menu đầu trang, giờ mở cửa, địa chỉ, điện thoại, mạng xã hội, bản đồ, tên chùa, thông báo (`site.announcement`, có công tắc và hạn).
- Chuyên mục (tên, icon) và nhóm Tông Chỉ: dựng từ D1; bộ lọc Dòng Chảy và bảng điều hướng phụ cũng vậy.

## Chưa nối (cần chủ dự án quyết cách thiết kế)

- Khối đầu trang chủ (video, chữ chào) và các khối `home.*`; lịch tu học trên trang chủ còn sinh sự kiện định kỳ theo quy tắc âm lịch viết sẵn nên ẩn một sự kiện định kỳ trong admin chưa làm nó biến mất khỏi lịch trang chủ.
- Danh sách Bảo tượng chỉ hiện 62 tượng "TƯỢNG CHÍNH" (www hiện 126); các tượng còn lại mở được bằng địa chỉ.
- Thứ tự chuyên mục Dòng Chảy và nhóm Tông Chỉ do admin sắp xếp chưa được dùng (lớp `tlhp-content` chưa đưa vị trí; sửa phải làm ở www rồi chép sang).
- Lời Thầy (`quote`), ảnh nhiều góc, thông số và SEO của tượng, cờ `featured` của tượng.
- Chân trang không vẽ menu chân trang; V3 không có `sitemap.xml` (V3 đang `noindex`).

## Độ trễ sau khi sửa trong admin

Admin chỉ xóa cache của www. V3 có cache riêng: trang chi tiết làm mới sau tối đa 30 giây, danh sách Dòng Chảy 60 giây, bản đọc D1 trong bộ nhớ 15 giây. Lượt xem đầu tiên sau khi hết hạn vẫn có thể thấy bản cũ (cache kiểu "phục vụ bản cũ, làm mới nền"); trang không ai ghé có thể giữ bản cũ lâu hơn.

## Kiểm thử

- `tests/unit/v3-www-admin-roundtrip.test.ts`: chạy mã admin của www ghi 14 tình huống (xuất bản, ẩn, hẹn giờ, thùng rác, đổi slug, đổi chuyên trang, trường riêng) rồi đọc bằng lớp đọc của V3. Chạy: `TLHP_WWW_SRC=E:/tlhp-av3/src npm test`.
- Lệch giữa www và V3 sau khi tạo/sửa là lỗi; nếu www đổi API admin thì `tests/helpers/www-admin-world.mjs` có thể phải sửa theo.
