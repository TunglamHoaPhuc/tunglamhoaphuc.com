# Spec: Admin cho V3 (dựng lại trên dữ liệu hiện có)

Trạng thái: **chờ chủ dự án duyệt** (22/11/2026). Chưa sửa dòng mã nào.

## Mục tiêu

Người biên tập sửa nội dung ở một nơi và thấy đúng nội dung đó trên v3.tunglamhoaphuc.com, không mất dữ liệu, không ai làm được việc vượt quyền.

Khảo sát cho thấy vấn đề nằm ở ba chỗ, không phải ở chỗ "thiếu một admin":

1. Admin `/quan-tri` (repo www) ghi D1 đúng, nhưng luồng sửa bài có 15 lỗi, trong đó 3 lỗi làm mất dữ liệu.
2. Phân quyền có 2 lỗi mức cao, 3 mức trung bình, 6 mức thấp; ma trận quyền đã cấp thì đúng thiết kế, lỗi nằm ở chỗ thực thi.
3. Site V3 đọc sai hoặc bỏ qua phần lớn thứ admin ghi (tông chỉ lấy thân bài từ WordPress, gỡ bài không có tác dụng vì còn bản đóng gói, bảo tượng không đọc D1…).

## Giả định (cần anh xác nhận)

1. **Một admin duy nhất.** "Admin cho V3" là `/quan-tri` trên www, ghi vào D1/R2 mà V3 đang đọc. Không dựng admin thứ hai trong Worker `tlhp-v3`. Lý do: admin chỉ trả lời trên một tên miền (`ADMIN_BASE_URL`), cookie `__Host-` không dùng chung được giữa hai tên miền, hai admin cùng ghi một D1 là hai nơi phải vá mỗi khi có lỗi quyền, và mã admin (khoảng 21.400 dòng, Bootstrap/SCSS) không chạy sẵn trên nền Tailwind của V3.
2. Không mang mã admin gốc của V3 (JSON trên B2, cookie tự đặt) trở lại.
3. Đợt này không thêm module mới (bài vị, danh tăng, sách tham khảo). Ba mục đó vẫn đọc bản đóng gói trên V3 và được ghi là việc tiếp theo.
4. Không chạy migration, backfill hay deploy lên D1/Worker thật khi chưa có lời đồng ý riêng cho từng lần.

## Bản đồ hạng mục

| Mã | Trách nhiệm | Repo | Phụ thuộc |
|---|---|---|---|
| `quyen` | Sửa thực thi phân quyền ở máy chủ | www | |
| `bai-viet` | Sửa luồng tạo/sửa bài ở máy chủ và lớp đọc công khai | www | |
| `giao-dien` | Trình soạn bài, chặn trang theo quyền, ẩn/hiện nút đúng | www | `quyen`, `bai-viet` |
| `v3-doc` | V3 đọc đúng và đủ những gì admin ghi | v3 | `bai-viet` (lớp đọc dùng chung) |
| `kiem-thu` | Kiểm thử dữ liệu, sửa bài, ma trận quyền; vòng lặp sửa lỗi | cả hai | tất cả |

Thứ tự: `quyen` và `bai-viet` song song → `giao-dien` và `v3-doc` song song → `kiem-thu`.

## Nguyên nhân gốc và cách sửa

### `quyen`

| # | Mức | Nguyên nhân gốc | Sửa |
|---|---|---|---|
| Q1 | Cao | Thùng rác chỉ kiểm `trash.*`, không kiểm quyền của loại nội dung bên trong (`src/admin/ops/trash.ts:65-72,119-150`; `Trashable.module` khai báo mà không dùng). Biên tập viên khôi phục được tài khoản Super Admin đã xóa; Admin xóa vĩnh viễn được tài khoản. | Liệt kê chỉ các loại người gọi có `<module>.view`; khôi phục cần thêm `<module>.update`, xóa hẳn cần `<module>.delete`; với tài khoản và vai trò áp thêm luật "không vượt quyền của mình". |
| Q2 | Cao | Phạm vi "Của mình" được nhận cho mọi module (`users/service.ts:250`) và cổng route luôn cho qua (`http/api.ts:125`, `anyOwner: true`), nhưng chỉ vài handler kiểm chủ sở hữu. Vai trò tự tạo với `users.view:own`, `backup.view:own`… thực tế có toàn quyền. | Chỉ nhận `:own` cho các cặp có thực thi (bài, tông chỉ, trang, sự kiện, tượng, khu vực, lời Thầy × sửa/xóa; media × sửa/xóa; thùng rác); route phải khai `own: true` mới cho phạm vi "của mình" đi qua. |
| Q3 | TB | `GET users/:id/sessions` không gọi `mayManage` (`users/routes.ts:69-76`): Admin xem được phiên, IP của Super Admin. | Đưa vào service, gọi `mayManage`. |
| Q4 | TB | Thư mục media không có chủ nhưng nhận `media.update:own` (`media/routes.ts:63-70`): Cộng tác viên đổi tên thư mục của người khác. | Thư mục cần phạm vi "tất cả". |
| Q5 | TB | `trashItem` không gọi `mayEditLive` (`content/service.ts:816-820`): Cộng tác viên gỡ bài đang hiển thị bằng cách xóa. | Thêm `mayEditLive`; `canDelete` phản ánh đúng. |
| Q6–Q10 | Thấp | Tạo link xem trước cho bài người khác; phiên "phải đổi mật khẩu" vẫn gọi được `me/sessions`, `me/2fa/*`; Super Admin tự gỡ 2FA không cần mật khẩu; `Origin` hỏng trả 500; trang xem trước không kiểm tên miền. | Sửa từng điểm theo báo cáo. |
| G1–G5 | Giao diện | Phần lớn trang không có trạng thái "Không có quyền truy cập"; nút sửa/thay/cắt ảnh hiện với ảnh của người khác; trang tài khoản hiện thao tác mà máy chủ từ chối; nút "Xem trước" luôn hiện; ô "Tất cả" chọn được khi chỉ có "của mình". | Chặn theo `NAV.needs` ở khung; máy chủ trả cờ `manageable` và danh sách vai trò gán được. |

### `bai-viet`

| # | Mức | Nguyên nhân gốc | Sửa |
|---|---|---|---|
| B1 | Mất dữ liệu | `slugify` cắt 80 ký tự (`src/admin/slug.ts:2`) và `prepare` slugify lại slug sẵn có (`content/service.ts:558-566`); ô slug tự slugify khi rời ô. 87/632 bài nhập từ web cũ có slug dài hơn 80: sửa là đổi URL, URL cũ báo 404, không có chuyển hướng. | Không đụng slug khi giá trị gửi lên bằng giá trị đang lưu; chỉ slugify thứ người dùng gõ; đổi slug hoặc chuyên mục của bài đang hiển thị thì ghi một dòng `redirect` trong cùng batch và trang bài viết tra `redirect` trước khi 404. |
| B2 | Mất chữ đang gõ | Mỗi lần lưu thành công gọi `apply()` dựng lại cả form và trình soạn (`ContentEditor.tsx:95-107,164`). | Lưu xong chỉ cập nhật mốc so sánh; dựng lại trình soạn khi tải, khôi phục phiên bản hoặc tải lại do xung đột. |
| B3 | Sai | Trình soạn hiện `content_json`, trang hiện `content_html` đã lọc: thứ bị lọc (YouTube dạng `/embed/`, `sub`/`sup`, link `tel:`) vẫn thấy trong admin. | Chuẩn hóa địa chỉ YouTube; máy chủ báo khi lọc làm đổi thân bài và trình soạn nạp lại từ HTML đã lưu. |
| B4 | Sai | Video tông chỉ lấy `id` cũ trước `url` mới (`kinds.ts:87`): không đổi, không gỡ được. | Lấy id từ `url` khi có; url rỗng là gỡ. |
| B5 | Sai | Đổi tiêu đề tông chỉ không đổi `name` mà trang công khai dùng. | Đồng bộ `name` khi nó đang bằng tiêu đề cũ. |
| B6 | Sai | Admin cho trùng slug khác chuyên mục, lớp đọc khử trùng theo slug (`d1.ts:104-110`): bài thứ hai "đã xuất bản" nhưng không hiện. | Khóa theo chuyên mục + slug ở lớp đọc. |
| B7 | Sai | SEO, ảnh OG, ghim, trường mở rộng (pháp âm, video, sách), bài liên quan được lưu nhưng trang công khai không đọc. | Lớp đọc chọn và dùng các trường này. |
| B8 | Sai | Không làm mới cache sau khi ghi: xuất bản/gỡ/xóa mất tới khoảng 6 phút mới hiện. | Làm mới đường dẫn bị ảnh hưởng sau mỗi lần ghi (www); V3 xem `v3-doc`. |
| B9 | Mất dữ liệu (tiềm ẩn) | `markdownOf` nuốt `**` đầu mục danh sách in đậm (`html.ts:512`); xem trước tông chỉ đi đường Markdown nên khác trang thật. | Sửa biểu thức; xem trước dùng HTML như trang thật. |
| B10 | Mất dữ liệu (tiềm ẩn) | Bài nhập từ web cũ không có phiên bản gốc: sửa lần đầu là không khôi phục được bản nhập. | Lần sửa đầu ghi thêm ảnh chụp bản hiện có trong cùng batch. |
| B11 | Sai | Lưu bài xóa dòng `media_usage` của ảnh tham chiếu bằng URL: ảnh bị coi là không dùng, xóa được. | Dựng lại usage có tính cả ảnh `/anh-goc/…` trong thân bài và bìa sách. |
| B12 | Sai | Tìm kiếm và ô chọn bài liên quan bỏ sót bài có `search_text` rỗng (631/636 bài ở D1 cục bộ). | Thêm tìm theo tiêu đề; chạy backfill trên D1 thật **khi anh đồng ý**. |
| B13 | Sai | Hẹn giờ một bài đang hiển thị làm bài biến mất tới giờ hẹn; ngày đăng không cập nhật khi xuất bản; không có tác vụ định kỳ chuyển "hẹn giờ" thành "đã xuất bản". | Cảnh báo và giữ bài hiển thị; đặt ngày đăng lúc xuất bản lần đầu; trạng thái suy ra lúc đọc. |
| B14 | Mất dữ liệu (nhỏ) | `plainText` xóa mọi thứ sau dấu `<` (`html.ts:434`): "Tuổi < 18…" còn "Tuổi". | Chỉ gỡ thẻ hợp lệ. |
| B15 | Giao diện | Rời trang trong admin mất chữ chưa lưu mà không hỏi; lỗi của trường lồng nhau không hiện; bài mới trùng slug báo 409. | Chặn rời trang bằng khối xác nhận trong luồng trang; hiện lỗi theo trường; để máy chủ tự thêm hậu tố. |

### `v3-doc`

| # | Vấn đề | Sửa |
|---|---|---|
| V1 | Thân bài tông chỉ lấy từ WordPress, không lấy D1 (`v3-data.ts:98`; `tong-chi-tu-hoc/[slug]/page.tsx:477-544`). | Đọc `contentHtml` từ D1; bỏ lời gọi WordPress. |
| V2 | Gỡ bài/xóa không có tác dụng vì còn bản đóng gói dự phòng (35 bài viết, 6 trang giới thiệu, khu vực, sự kiện tự dựng, trí tuệ hiện nhầm bài). | D1 là nguồn duy nhất cho các loại đã có trong D1; không có thì 404. |
| V3 | Hai trang giới thiệu dựng nhầm chủ đề; Tiểu sử Sư Tổ luôn lấy bản đóng gói. | Tra theo slug; bỏ phép gộp với bản đóng gói. |
| V4 | Bảo tượng và danh sách khu vực hoàn toàn đóng gói dù D1 và admin đã có. | Đọc từ D1 qua lớp đọc chung. |
| V5 | Thân bài khu vực bị bỏ; `intro` in thẳng HTML chưa lọc. | Dùng `contentHtml`; lọc `intro` ở admin. |
| V6 | Bộ dựng bài của V3 làm phẳng HTML (mất bảng, video, chú thích, liên kết). | Dựng HTML đã lọc như www. |
| V7 | Menu, thông tin trang, khối trang chủ, lời Thầy, thông báo, chuyển hướng không được đọc. | Chép `siteData`, `homeData`, `redirects` sang V3 và dùng. |
| V8 | Lớp đọc là bản chép tay; route ghi cũ không kiểm quyền còn nằm đó; tìm bài vị theo SĐT gốc. | Kiểm thử so khớp hai bản; xóa route ghi; bỏ khớp theo SĐT. |

## Lệnh

```powershell
npm run typecheck; npm run lint; npm test          # www
npm run dev:db -- --init --seed                     # D1 CỤC BỘ (dừng dev trước)
npm run import -- --from=snapshot --db=<tệp.sqlite> --migrate
$env:BASE_URL='http://localhost:3001'; npx playwright test tests/e2e/admin --project=desktop --workers=1
```

## Kiểm thử (tiêu chí hoàn thành)

- Mỗi lỗi ở trên có một kiểm thử đỏ trước, xanh sau.
- **Dữ liệu:** nhập `data/snapshot` vào SQLite, mở rồi lưu không đổi gì cả 632 bài viết, 25 tông chỉ, 6 trang giới thiệu: nội dung, slug, ngày đăng không đổi một byte; sửa lần đầu sinh đúng hai phiên bản.
- **Sửa bài:** tạo, lưu nháp, gửi duyệt, xuất bản, hẹn giờ, gỡ, xóa, khôi phục, đổi slug (có chuyển hướng), xung đột phiên bản, ảnh bìa và vị trí, video, sách, SEO, bài liên quan; trường hợp biên: slug 145 ký tự, tiêu đề có `<`, YouTube dạng `/embed/`, hai bài trùng slug khác chuyên mục, gõ tiếp trong lúc đang lưu.
- **Ma trận quyền:** 4 vai trò mẫu × mọi route, sinh tự động từ bảng route của máy chủ, mỗi ô khẳng định được phép hoặc 403; thêm vai trò tự tạo chỉ có quyền "của mình"; giao diện: mỗi vai trò mở từng trang bằng URL trực tiếp.
- **V3:** với cùng một D1 cục bộ, mỗi bài đã xuất bản hiện đúng thân bài; bài nháp, hẹn giờ chưa tới, trong thùng rác trả 404; không còn lời gọi tới WordPress.
- `typecheck`, `lint`, toàn bộ kiểm thử đơn vị (mốc hiện tại 394 kiểm thử admin đang xanh) và e2e admin đều xanh.

## Ranh giới

- **Luôn:** làm trong worktree riêng, nhánh riêng cho từng repo; chỉ stage tệp theo đường dẫn; mọi thao tác ghi là một `db.batch` kèm nhật ký; chữ giao diện tiếng Việt có dấu, không toast, không `window.confirm`.
- **Hỏi trước:** migration mới; chạy backfill hay bất kỳ lệnh nào trên D1 thật; deploy www hoặc v3; thêm thư viện.
- **Không bao giờ:** sửa migration `0000`; đổi gói cước Cloudflare; đụng tới việc dở chưa commit của người khác trong cây làm việc chính; dùng hay in bí mật.

## Phân vai

| Vai | Agent | Skill |
|---|---|---|
| Điều phối, kiến trúc, duyệt mã bảo mật | phiên này | `spec-driven-development`, `planning-and-task-breakdown`, `systematic-debugging` |
| Máy chủ – phân quyền (`quyen`) | agent máy chủ 1 | `test-driven-development`, `security-and-hardening` |
| Máy chủ – bài viết và lớp đọc (`bai-viet`) | agent máy chủ 2 | `test-driven-development` |
| Giao diện admin (`giao-dien`) | agent giao diện | `frontend-ui-engineering`, `web-design-guidelines` |
| V3 (`v3-doc`) | agent V3 | `incremental-implementation` |
| QA (`kiem-thu`) | agent kiểm thử + agent rà bảo mật độc lập | `code-review-and-quality`, `security-review`, `verification-before-completion` |

## Câu hỏi mở

1. Anh đồng ý phương án một admin dùng chung (giả định 1), hay muốn có `/quan-tri` chạy ngay trên tên miền v3?
2. Thư mục `E:\tung-lam-hoa-phuc-v3` cần được cấp quyền ghi cho phiên làm việc để làm hạng mục `v3-doc`.
3. Sau khi xong và kiểm thử xanh ở máy cục bộ: có deploy www và v3 không, và có chạy backfill `search_text` trên D1 thật không?
