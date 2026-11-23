# Kiểm kê ảnh để chuyển toàn bộ về Cloudflare R2 (23/11/2026)

> Mục tiêu của chủ chùa: **mọi ảnh của site và của admin chỉ nằm trên Cloudflare (bucket R2 `tlhp-media`)**, không còn trên WordPress (`admin.` / `old.tunglamhoaphuc.com`), Backblaze B2 hay bất kỳ máy chủ ngoài nào.
> Chỉ đọc: `SELECT` trên D1 `tlhp-db`, `cf r2 objects list`, `HEAD` (và `GET` một byte) tới nguồn ảnh với tốc độ tối đa 4,5 yêu cầu mỗi giây, đọc mã của hai repo (`E:\tlhp-av3` = www/admin, `E:\tlhp-v3-doc` = V3). Không ghi D1/R2/Cloudflare, không purge, không deploy, không sửa tệp nào của repo.
> Bản kê chi tiết từng tệp chưa có trong R2: `manifest-thieu-trong-r2.json` và `.csv` (854 mục, thư mục tạm của phiên: `C:\Users\hieup\AppData\Local\Temp\claude\04ca2525432311fe\0068e0f6-cc1f-4487-a0c6-41fac6c8fa86\scratchpad\anh\`). Liên quan: [kiem-ke-cloudflare-23-11-2026.md](kiem-ke-cloudflare-23-11-2026.md), [nguon-b2.md](nguon-b2.md), `scripts/media-copy.ts`.

## 0. Tóm tắt cho chủ dự án

1. **Hiện trạng thật (23/11, 06:30 UTC trở đi):** `www.tunglamhoaphuc.com` và tên miền gốc do Worker **`tlhp-v3`** (V3) phục vụ; `tlhp-web` giữ `v2.` và `quantri.` (admin). Vì vậy phần mã V3 mới là phần khách đang xem, và V3 chứa nhiều địa chỉ ảnh B2 viết cứng nhất.
2. **R2 đã giữ 20.912 tệp, 2.953.892.303 byte (2,75 GiB)**; 20.853 tệp được bảng `media` nhắc tới (không dòng nào dùng chung khóa). 59 tệp còn lại (22,4 MB) không có dòng `media` nào trỏ tới, trong đó 35 được mã hoặc `page.book` dùng, **24 không ai dùng** (12 trong `site/images/lich-tu-hoc`, 11 trong `s2-cnv03/tunglamhoaphuc2`, 1 trong `media-tunglamhoaphuc`; 11,1 MB).
3. **Số ảnh còn phụ thuộc nguồn ngoài (không có ở khóa R2 mà route `/anh-goc/` sẽ đọc): 854 ảnh khác nhau.** Chia theo việc phải làm:
   - **684 ảnh lấy được ngay, khoảng 251 MB:** 483 ảnh WordPress cũ (202,7 MB) thực ra nằm **trên B2** ở `s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/<cùng đường dẫn>`, 196 ảnh `media-tunglamhoaphuc` mà mã V3 viết thẳng (48,0 MB, trong đó 30 trang sách lật `08-tu-an-book/page_01..30.webp`, 16,2 MB), 1 ảnh `1..jpg` (0,3 MB), 4 ảnh bên thứ ba còn sống (35 KB).
   - **120 ảnh đã có byte trong R2 nhưng dưới khóa của bucket kia** (`s2-cnv03/…` trong khi mã đọc `media-tunglamhoaphuc/…`; 16,7 MB): chỉ cần sao chép trong R2 hoặc sửa mã, không cần nguồn.
   - **12 ảnh đã có trong R2** dưới khóa kho WordPress cũ; chỉ cần đổi tham chiếu.
   - **158 ảnh không lấy được** (xem mục 4): 107 trả 404 hoặc tên miền không còn, 15 bị Facebook chặn (403), 15 máy chủ infonet không kết nối được, 21 không còn nguồn nhưng có tệp trùng tên trong R2 (cần người xem mắt).
4. **Phát hiện quan trọng:** 495 dòng `media` trỏ `admin.tunglamhoaphuc.com/wp-content/uploads/…` (xác nhận đúng con số đã biết) **đều trả 404 trên WordPress** (đã `HEAD` đủ 495), tức là **ảnh album của 107 bài đang hỏng ngoài site** ngay lúc này (thử `https://www.tunglamhoaphuc.com/anh-goc/wordpress/2018/07/K49A0733-568x379.jpg` trả 404). Nhưng cả 495 tệp **có trên B2** ở khóa `tunglamhoaphuc-com/wp-content/uploads/…` (495/495 trả 200, 203.653.253 byte); `https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2018/07/K49A0733-568x379.jpg` trả 200 qua đường dự phòng B2. **Cái cần làm là chép từ B2, không phải từ WordPress**; WordPress `admin.` hiện không còn giữ ảnh cũ nào cần cứu (2026/07 đến 2026/10 vẫn còn, và 393 tệp đó đã nằm trong R2).
5. **Điều chưa đo được** (mục 7): tổng dung lượng thật của hai bucket B2 (cần khóa B2), số tệp trên máy chủ WordPress, lưu lượng thật đi qua đường dự phòng, độ trùng nội dung giữa các tệp khác tên.

## 1. Bảng: các loại tham chiếu ảnh

Cột "R2?" là so với **khóa mà `mediaSource()` sẽ đọc** (`<bucket>/<key>`, `wordpress/<đường dẫn>`).

| # | Loại tham chiếu | Nơi lưu | Số lượng | Nguồn / host | Đã có trong R2? | Phụ thuộc ánh xạ `/anh-goc/<bucket>` |
|---|---|---|---|---|---|---|
| 1 | Ảnh trong thư viện `media` (mọi ảnh qua id) | `media.r2_key` (20.340 dòng) và `media.url` (1.112 dòng); không dòng nào xóa mềm; **mọi dòng đều có `media_usage`** | 21.452 dòng | 20.340 B2 `s2-cnv03`, 129 B2 `media-tunglamhoaphuc`, 884 WordPress `admin.`, 87 bên thứ ba, 12 đường dẫn của chính site | 20.335/20.340 (`s2-cnv03`), 129/129 (`media-tunglamhoaphuc`), 389/884 (WordPress), 0/87 (bên thứ ba), 12 `/images/lich-tu-hoc/…` có ở `site/images/…` nhưng **không có route nào đọc `site/`** (xem dòng 11) | `r2_key` thành `/anh-goc/s2-cnv03/<key>`; `url` WordPress thành `/anh-goc/wordpress/<path>`; `url` B2 thành `/anh-goc/media-tunglamhoaphuc/<path>`; host lạ giữ nguyên (khách tải thẳng) |
| 2 | Ảnh bìa và banner bài | `post.thumbnail_media_id`, `post.banner_media_id` → `media` | 632 + 632 (626 B2, 6 WordPress mỗi loại); `og_media_id` rỗng | B2 `s2-cnv03`, WordPress | có hết | như dòng 1 |
| 3 | Album ảnh | `album_item.media_id` (21.102 dòng, 20.640 ảnh khác nhau); `post.album_id` | 21.102 | 20.132 B2 (4 thiếu), 883 WordPress (495 thiếu), 87 bên thứ ba (thiếu) | thiếu 586 dòng (xem mục 3) | như dòng 1; **đây là nơi 100% ảnh thiếu nằm** |
| 4 | Tượng, biến thể nghệ thuật, tăng ni, khu vực, lịch, chương trình, tháng, lời Thầy, trang Giới thiệu, Tông Chỉ | `statue` 126, `art_variation` 40, `monk.avatar` 91, `area.cover` 14, `calendar_event` 15, `featured_program` 3, `month_theme` 12, `quote_image` 12, `page.banner` 6, `page.portrait` 5, `teaching_article.banner` 11 | 335 | `media-tunglamhoaphuc` (tượng, biến thể, lịch, chương trình, tháng), `s2-cnv03` (còn lại) | có hết trừ **2** (`area:4.cover`, `page:gt-05.portrait`, cả hai 404 ở B2) | như dòng 1 |
| 5 | Nội dung bài (`post.content_html`) | 632 bài | **0 thẻ `<img>`**; 33 liên kết âm thanh/video | `admin.` WordPress: 30 `.mp3`, 2 `.mp4`, 1 `.m4a` (không phải ảnh) | không (không phải ảnh; cả 33 trả 404 trên WordPress) | không qua `/anh-goc/` (chỉ cho ảnh) |
| 6 | Nội dung Tông Chỉ (markdown) | `teaching_article.body` | 5 ảnh `![](…)` | `admin.` WordPress `2026/08`, `2026/09` (4 ảnh) và `uploads/niem-phat.jpg` (chưa bao giờ tồn tại, đã biết) | 4/5 có (`wordpress/2026/…`, nằm trong 59 tệp không có dòng `media`); `niem-phat.jpg` không | qua `mediaUrl()` thành `/anh-goc/wordpress/…` |
| 7 | Vị trí cắt ảnh viết nhầm | `teaching_article.banner_position` | 6 dòng có chuỗi `https://admin.tunglamhoaphuc.com/center 44%` | không phải ảnh; `cleanPosition()` bỏ đi khi vẽ | không áp dụng | dọn dữ liệu (không tải gì) |
| 8 | Bìa sách | `page.book` (JSON, trang `gt-04`) | 1 | B2 `s2-cnv03.s3…/tunglamhoaphuc2/08-tu-an-book/di-qua-kho-vui-cuoc-doi-bia-1.webp` | có | địa chỉ B2 viết thẳng trong JSON, qua `mediaUrl()` thành `/anh-goc/s2-cnv03/…` |
| 9 | Biểu tượng menu, chuyên mục, cài đặt trang chủ, ảnh đại diện admin | `menu_item.icon_url` 6, `category` 0 ảnh, `setting` `home.*` (`imageMediaId` đều `null`), `user.avatar_media_id` 0 | 6 | `/brand/…` (kho tĩnh) | không cần (nằm trong Workers Assets, đã trên Cloudflare) | không |
| 10 | Tệp tĩnh `public/` | `E:\tlhp-av3\public` (479 tệp, 311 ảnh, 17,6 MB), `E:\tlhp-v3-doc\public` (366 tệp, 194 ảnh, 27,2 MB) | 505 ảnh | gói theo Worker (Workers Assets) | **đã nằm trên Cloudflare** (không ở R2); không kiểm tra từng byte sau build | không |
| 11 | Ảnh `/images/lich-tu-hoc/quotes/…` | `media.url` (12 dòng, loại `quote_image`) | 12 | đường dẫn của site, có trong `public/` của V3 (`www` hiện trả 200); R2 giữ bản chép ở `site/images/lich-tu-hoc/quotes/` (7,3 MB) nhưng không route nào đọc | bản trong R2 không được dùng | không (nếu bản deploy nào thiếu `public/images/lich-tu-hoc` thì 404) |
| 12 | Địa chỉ B2 viết cứng trong mã V3 | 70 tệp trong `E:\tlhp-v3-doc\src` (1.409 lần), phần lớn là `src/data/*.json|ts` | 363 địa chỉ ảnh khác nhau khi gộp V3 (362) và www (26): 336 `media-tunglamhoaphuc`, 13 `b1.congngheviet.com.vn`, 13 `admin.`, 1 `s2-cnv03` | B2, WordPress | 61 đúng khóa; **120 có byte dưới khóa bucket kia**; **165 chưa có, còn lấy được (31,7 MB; chưa tính 30 trang sách lật ở dòng 14)**; 17 đã mất | nhiều chỗ qua `fitImage()`/`mediaUrl()`; nhiều chỗ là thẻ `<img src>` thẳng tới B2 (xem mục 5) |
| 13 | Địa chỉ B2/WordPress viết cứng trong mã www | 11 tệp trong `E:\tlhp-av3\src` (36 lần, 26 địa chỉ ảnh) | 26 | B2 `media-tunglamhoaphuc` (30 lần), `s2-cnv03` (3), `admin.` (1) | 6 đúng khóa; còn lại ở khóa bucket kia hoặc chưa có | qua `mediaUrl()` |
| 14 | Trang sách lật tạo bằng template | `BookFlipModal.tsx:50`, `TuAnFlipbook.tsx:10` (V3) | 30 ảnh `page_01..30.webp` | B2 `media-tunglamhoaphuc/tunglamhoaphuc2/08-tu-an-book/` | **không** (cả 30 còn trên B2, 16,2 MB) | không (trình duyệt tải thẳng B2) |
| 15 | Đường dẫn `/images/…` của V3 không có trong `public/` | 94 đường dẫn khác nhau trong mã V3; 59 không có tệp | 59 | route `src/app/images/[...path]/route.ts` đổi sang `.webp` rồi **307 sang B2** | 2 có trong R2 (khóa `media-tunglamhoaphuc/…`), **3 lấy được từ B2 (0,46 MB), 54 trả 404 (13 có tệp trùng tên trong R2)** | route này tự ghép địa chỉ B2, **không đi qua `/anh-goc/`, không đọc R2** |
| 16 | Ảnh tải lên qua admin mới | `src/admin/media/store.ts` ghi vào R2 `s2-cnv03/cms/<id>/v<n>/<tên>` | hiện 0 khóa `cms/` | chỉ R2 | có (nơi ghi duy nhất) | `/anh-goc/s2-cnv03/cms/…` |
| 17 | Ảnh admin có thể nhập tay | `safeMediaSrc()` trong `src/admin/content/html.ts:212`, `picture` trong `src/admin/content/kinds.ts:62-68`, `audioUrl` trong `extra.ts:22` | không đếm được trước | **mọi địa chỉ `https://` bất kỳ đều hợp lệ** | không kiểm soát | đường rò rỉ: biên tập viên có thể dán ảnh từ host ngoài |
| 18 | Ảnh bên thứ ba lúc chạy | `src/features/home/components/WelcomeSection.tsx:104` (V3) | 1 chỗ | `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (ảnh xem trước video YouTube, chỉ khi bài không có ảnh) | không áp dụng | không |
| 19 | Âm thanh không phải ảnh nhưng ngoài Cloudflare | V3: `ZenAudioPlayer.tsx:30-42`, `DanhTangMap.tsx:543`, `InteractiveMap2D.tsx:304`; admin cũ `post` | 5 tệp `cdn.pixabay.com` + 33 tệp WordPress (mục dòng 5) | Pixabay, WordPress | ngoài phạm vi "ảnh" nhưng cùng chủ đề | ghi nhận để chủ quyết |

Không có `url(...)` trỏ ra ngoài trong CSS/SCSS của hai repo (chỉ Google Fonts). Không có tham số `?v=` trên ảnh B2/WordPress; duy nhất `PostCard.tsx:166,252` (V3) gắn `?v=4` sau `logoUrl` (mặc định là địa chỉ B2 của biểu tượng Tông Chỉ) và `GallerySection.tsx:210` gắn `?v=2` sau một biểu tượng tĩnh của site; route `/anh-goc/` bỏ qua chuỗi truy vấn nên vô hại.

## 2. Số tệp và dung lượng theo nơi lưu

### 2.1 Trong R2 `tlhp-media` (đo trực tiếp, `cf r2 objects list`)

| Tiền tố khóa | Tệp | Byte | Ghi chú |
|---|---|---|---|
| `s2-cnv03/tunglamhoaphuc-com/wp-content/…` | 19.657 | 2.305.123.919 | gương B2 của WordPress cũ |
| `s2-cnv03/tunglamhoaphuc2/…` | 710 | 413.771.030 | |
| `s2-cnv03/uploads/…` | 7 | 2.249.602 | |
| `media-tunglamhoaphuc/tunglamhoaphuc2/…` | 133 | 36.355.428 | |
| `wordpress/2026/…` | 393 | 189.068.836 | |
| `site/images/lich-tu-hoc/…` | 12 | 7.323.488 | không route nào đọc |
| **Cộng** | **20.912** | **2.953.892.303** | tất cả ghi 17/11/2026, 100% `image/*` |

Đuôi tệp: 20.516 `.jpg`, 51 `.jpeg`, 62 `.jfif`, 266 `.webp`, 14 `.png`, 2 `.gif`, 1 tệp không đuôi (`…/anh-hoa-thuong-tong-hop/-jpg`).

### 2.2 Theo nguồn của dữ liệu D1 (bảng `media`)

| Nguồn | Dòng `media` | Có trong R2 | Byte trong R2 (bản đã xử lý) | Thiếu | Ước lượng byte ở nguồn* |
|---|---|---|---|---|---|
| B2 `s2-cnv03` (`r2_key`) | 20.340 | 20.335 | 2.712.795.288 | 5 (1 lấy được 296.845 B, 4 mất) | khoảng 2,9 GB (nhân 1,06 theo mẫu 100 tệp) |
| B2 `media-tunglamhoaphuc` (`url`) | 129 | 129 | 34.841.920 | 0 | khoảng 70 MB (nhân 2,0 theo mẫu 30 tệp) |
| WordPress `admin.` (`url`) | 884 | 389 | 183.823.825 | 495 (đều 404 trên WP, **đều có trên B2: 203.653.253 B**, 12 đã có sẵn trong R2 dưới khóa gương) | khoảng 0,55 GB cho 389 tệp 2026 (nhân 2,97 theo mẫu 60 tệp; sai số lớn) |
| Bên thứ ba | 87 | 0 | 0 | 87 | 4 tệp còn sống, 35.206 B; còn lại không đo được |
| Đường dẫn của chính site | 12 | 12 (ở `site/`) | 7.323.488 | 0 | không áp dụng |

\* **Bản R2 không bằng bản gốc:** `scripts/media-copy.ts` xóa EXIF và thu ảnh dài hơn 2560 px xuống 2560 px, nên bản R2 thường nhỏ hơn nguồn. Mẫu thật (HEAD nguồn so với kích thước R2): `s2-cnv03` 77/100 tệp bằng nhau, 20 nguồn lớn hơn (tối đa 2,96 lần), 3 nguồn nhỏ hơn; `media-tunglamhoaphuc` 23/30 bằng, 7 lớn hơn (tối đa 6,2 lần); WordPress chỉ 16/60 bằng, 36 lớn hơn (tối đa 19 lần), 8 nhỏ hơn (R2 lớn hơn nguồn, đến 8%). Tổng nguồn 2.953.892.303 B của R2 vì thế **không** bằng dung lượng nguồn; con số "ước lượng ở nguồn" ở trên chỉ là ngoại suy từ mẫu, **không phải số đo**.

### 2.3 Tổng theo nguồn ngoài, tính trên các ảnh **chưa có trong R2** (854 mục khác nhau, đã `HEAD`)

| Nguồn | Mục | Lấy được | Byte lấy được | Không lấy được |
|---|---|---|---|---|
| B2 `s2-cnv03`, gương WordPress cũ (qua 495 dòng `admin.`) | 495 | 495 (12 đã có sẵn trong R2, 483 cần chép) | 203.653.253 (483 cần chép: 202.701.585) | 0 |
| B2 `media-tunglamhoaphuc` (mã V3 và www: viết thẳng, trang sách lật, `/images/…`) | 258 | 196 | 47.980.520 | 62 (8 viết cứng + 54 `/images/…`, đều 404, cả ở bucket `s2-cnv03`) |
| B2 `s2-cnv03` (dòng `media`) | 5 | 1 | 296.845 | 4 (404) |
| Bên thứ ba (87 dòng `media`) | 87 | 4 | 35.206 | 83 |
| WordPress `admin.` (mã V3, tệp `uploads/<tên>.jpg`) | 8 | 0 | 0 | 8 (404, kể cả trên gương B2) |
| `b1.congngheviet.com.vn` (mã V3) | 1 | 0 | 0 | 1 (404) |
| **Cộng** | **854** | **696** (trừ 12 đã có: **684**) | **khoảng 251 MB** | **158** |

Tên miền ngoài trong 87 dòng `media`: `media.ex-cdn.com` 21, `img2.infonet.vn` 15, `image.giaoducthoidai.vn` 11, `image2.tienphong.vn` 9, `image.tienphong.vn` 6, `giacngo.vn` 4, `scontent.*.fbcdn.net` 17, `vnn-imgs-f.vgcloud.vn` 3, `www.chuahoangphap.com.vn` 1. **R2 hiện chưa có tệp nào của 87 ảnh này**, và khách đang tải thẳng từ các máy chủ ấy (hoặc thấy ảnh hỏng).

## 3. Danh sách chưa có trong R2

Danh sách đầy đủ, từng tệp (URL gốc, kích thước, kiểu, các dòng `media` và nơi dùng, tệp mã tham chiếu, ứng viên trùng trong R2, hành động khuyến nghị) nằm trong `manifest-thieu-trong-r2.json`; bản bảng tính `manifest-thieu-trong-r2.csv`. Phần tóm tắt theo nhóm:

| Nhóm | Mục | Trạng thái nguồn | Hành động khuyến nghị |
|---|---|---|---|
| 495 dòng `media` WordPress `admin.` (album của 107 bài) | 495 | WP `admin.`, `old.`, `www.`: **404** (đã thử mẫu 5 tệp trên cả ba host); gương B2 `s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/<path>`: **200 cả 495** | chép từ gương B2 vào R2 (483 tệp; 12 đã có). Cách ít rủi ro nhất: chép vào khóa `wordpress/<path>` (đúng khóa route hiện đọc, không đổi mã hay D1); cách gọn hơn: khóa `s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/<path>` rồi đặt `media.r2_key`, `media.url = NULL` |
| 5 dòng `media` B2 `s2-cnv03` | 5 | 1 lấy được (`…/2019/05/1..jpg`, 296.845 B, tên có hai dấu chấm), 4 đã mất (3 ảnh `2025/04` dùng ở trang Giới thiệu `gt-03`/`gt-05` và 1 ảnh `Chua-Mot-Cot-xua.webp` bìa khu vực `area:4`) | chép 1; 4 ảnh mất cần chủ dự án gửi lại bản gốc hoặc gỡ khỏi trang |
| 87 dòng `media` bên thứ ba (album của 23 bài) | 87 | 4 còn sống (3 + 1 logo, 35 KB); 17 Facebook (15 trả 403, 2 tên miền không còn); 47 ở ba tên miền khác không còn (NXDOMAIN, đã kiểm lại bằng DoH 1.1.1.1); 15 `img2.infonet.vn` (phân giải được nhưng kết nối quá hạn); 4 `giacngo.vn` 404 | chép 4; 83 ảnh còn lại cần chủ quyết: tìm lại ảnh gốc hoặc **gỡ khỏi album** (khả năng cao đã mất; token Facebook ghi năm 2021) |
| Mã V3/www viết thẳng B2 `media-tunglamhoaphuc` (kể cả 30 trang sách lật) | 202 | 194 lấy được; 8 trả 404 cả ở bucket `s2-cnv03` | chép vào `media-tunglamhoaphuc/<path>` (đúng khóa mà mã đọc); 8 mất: sửa mã hoặc thay ảnh |
| `/images/…` của V3 không có trong `public/` (1 trong 57 trùng với dòng trên) | 57 | 3 lấy được (0,46 MB); 54 trả 404 (trong đó 13 có tệp trùng tên trong R2, ví dụ `to_su_dat_ma.webp` dưới `s2-cnv03/tunglamhoaphuc2/05-bao-tuong-phat-giao/`; 41 không có ứng viên: các tệp `batBoKimCangData.ts`, `thapBatLaHanData.ts` trỏ tới thư mục `bao_tuong_phat_giao/…/NGHE_THUAT_PHAT_GIAO/` chưa từng có trên B2) | các dữ liệu này đang ảnh hỏng sẵn trên V3; sửa đường dẫn hoặc bỏ |
| Mã V3 dùng `https://admin.tunglamhoaphuc.com/wp-content/uploads/<tên>.jpg` | 8 | 404 cả ở WP lẫn gương B2 (`tong-chi-data.json`: `niem-phat.jpg`, `thap-thien-gioi.jpg`, 6 banner Tông Chỉ) | mất; V3 đã có bản B2 `media-tunglamhoaphuc/…/02-tong-chi-tu-hoc/` của nhiều ảnh này (4 có ứng viên trùng tên) |
| 120 địa chỉ ở khóa bucket kia | 120 (16.694.680 B) | **byte đã nằm trong R2** dưới `s2-cnv03/tunglamhoaphuc2/…` trong khi mã V3 yêu cầu `media-tunglamhoaphuc/tunglamhoaphuc2/…` | `copy` trong R2 (không cần nguồn), hoặc sửa mã đọc `/anh-goc/s2-cnv03/…` |
| 12 dòng WordPress đã có dưới khóa gương | 12 | trong R2 | đổi tham chiếu |
| 1 `b1.congngheviet.com.vn` (mã) | 1 | 404 | mất |

## 4. Những gì không lấy được

| Nguồn | Mục | Tình trạng | Chắc chắn đến đâu |
|---|---|---|---|
| `media.ex-cdn.com` | 21 | NXDOMAIN | đã kiểm bằng DoH 1.1.1.1 |
| `image.giaoducthoidai.vn` | 11 | NXDOMAIN | đã kiểm |
| `image.tienphong.vn` / `image2.tienphong.vn` | 6 + 9 | NXDOMAIN (CNAME `photo-cms-tpo.epicdn.me` cũng không còn) | đã kiểm |
| `scontent.*.fbcdn.net` | 17 | 15 trả 403, 2 tên miền không còn; địa chỉ có token hết hạn năm 2021 | chắc là đã mất |
| `giacngo.vn` | 4 | 404 | chắc |
| `img2.infonet.vn` | 15 | kết nối quá hạn 20 giây (cả `curl`), phân giải ra `118.102.1.123` | **chưa kết luận**, thử lại từ máy khác |
| `vnn-imgs-f.vgcloud.vn` | 3 | 2 ảnh trả 200 không có `Content-Length`, 1 `.gif` 2.572 B trả 206 | tải được, chưa đo kích thước 2 ảnh |
| `www.chuahoangphap.com.vn` | 1 | 200, 32.634 B (`.gif`) | tải được |
| B2 `media-tunglamhoaphuc` (mã) | 33 | 404, cả ở bucket `s2-cnv03` cùng đường dẫn | chắc |
| B2 `s2-cnv03` (dòng `media`) | 4 | 404 | chắc |
| `/images/…` của V3 | 54 | 404 | chắc (có thể tồn tại tên khác trong R2, 13 ứng viên) |
| WordPress/B2 `uploads/<tên>.jpg` | 8 | 404 | chắc |

## 5. Mọi chỗ trong mã dựng địa chỉ tới host ngoài (phải đổi)

### 5.1 www / admin (`E:\tlhp-av3`)

| Tệp:dòng | Việc |
|---|---|
| `src/libs/content/media.ts:13-19` | khai báo host B2 (`s2-cnv03`, `b1.congngheviet.com.vn`, `f005.backblazeb2.com`), WordPress, `MOVING_HOSTS` |
| `media.ts:58-66` `storedMediaAddress()` | dựng lại địa chỉ B2 và WordPress làm "id" của ảnh (id băm theo địa chỉ này; **đổi là đổi id**, giữ nguyên) |
| `media.ts:93-113` `mediaUrl()` | đổi địa chỉ B2 và WordPress thành `/anh-goc/…`; **host lạ (`https://…`) được giữ nguyên, khách tải thẳng** |
| `media.ts:121-140` `b2Source()`, `mediaSource()` | trả `origin` B2/WordPress làm dự phòng khi R2 thiếu |
| `src/libs/content/mediaRoute.ts:29-48` `fetchOrigin`, `serveMedia()` | **đường dự phòng tải B2/WordPress thật**; phải bỏ sau khi R2 đủ |
| `src/app/cdn-cgi/image/[...rest]/route.ts:6` | cho chuyển hướng sang `admin.tunglamhoaphuc.com` |
| `src/libs/content/sources/b2.ts` | đọc JSON dữ liệu (không phải ảnh) từ B2, bật bằng `CONTENT_SOURCE=b2`; đang không dùng khi `d1` |
| `src/libs/content/schedule.ts:94` | cảnh báo "bucket B2 khác" |
| `src/libs/content/posts.ts:99` | cảnh báo liên kết `wp-content` |
| `src/db/mediaBackfill.ts`, `scripts/media-copy.ts`, `scripts/import.ts`, `scripts/check-urls.ts` | công cụ nhập và sao chép (giữ để chạy lại, nhưng đừng để `import` nhận lại địa chỉ ngoài) |
| `src/components/gioi-thieu/nguoi-lien-quan/image.ts:6,23,34` | `WP_BASE_URL = https://admin.tunglamhoaphuc.com` ghép đường dẫn thiếu thành địa chỉ WordPress |
| `…/nguoi-lien-quan/data.ts:55-145` (12 địa chỉ), `FourCirclesPortalSection.tsx:29-145` (12), `TieuSuSuToOdysseyView.tsx:77-105` (6), `GioiThieuDetailLayout.tsx:31` (1), `src/config/vuTru.ts:14,23` (2) | địa chỉ B2 viết cứng |
| `src/admin/content/html.ts:212`, `kinds.ts:62-68`, `extra.ts:22` | cho phép **mọi** `https://` làm ảnh/âm thanh: cần thu hẹp còn `/anh-goc/` và `/brand/` |
| `next.config.js:64` | CSP của admin `img-src … https:`: thu hẹp còn `'self' data: blob:` |

### 5.2 V3 (`E:\tlhp-v3-doc`)

| Tệp:dòng | Việc |
|---|---|
| `src/lib/tlhp-content/media.ts`, `mediaRoute.ts` | **bản sao y hệt của www** (kiểm bằng `diff`: giống hoàn toàn); sửa cùng lúc |
| `src/utils/image.ts:2-3` | `WP_BASE_URL`, `PLACEHOLDER_IMAGE` (B2) |
| `src/utils/image.ts:28-69` `getImageUrl()` | tên tệp rời hoặc đường dẫn thiếu thành `https://admin.tunglamhoaphuc.com/wp-content/uploads/<tên>`; `/images/tong-chi/…` cũng đổi sang WordPress |
| `src/utils/image.ts:73-103` `getHighResImageUrl()`, `getOptimizedNextImageUrl()` | bỏ hậu tố kích thước WordPress (`-668x501`) để đoán bản gốc trên WP (đa số không còn); ghép vào `/_next/image?url=<host ngoài>` |
| `src/app/images/[...path]/route.ts:3,86` | **ghép địa chỉ B2 `media-tunglamhoaphuc/tunglamhoaphuc2/…` rồi 307**, không đọc R2 |
| `src/lib/media-helper.ts:6,24` | `getMediaUrl()` ghép B2 (không nơi nào gọi, xóa được) |
| `src/lib/tlhp-content/sources/b2.ts` | như www |
| `next.config.ts:46-71` | `images.remotePatterns` cho `admin.`, `tunglamhoaphuc.com`, B2 `media-tunglamhoaphuc`, B2 `s2-cnv03` |
| `src/app/cdn-cgi/image/[...rest]/route.ts:7` | như www |
| `src/lib/v3-data.ts:13` `absUrl()`, `WWW_ORIGIN` | ghép `https://www.tunglamhoaphuc.com` (cùng Cloudflare, không phải host ngoài) |
| `src/lib/v3-home-news.ts:43-46`, `v3-dharma.ts:14-16`, `v3-calendar.ts:70`, `wisdom.ts:8`, `features/home/components/DharmaSection.tsx:17-97` | ảnh mặc định viết cứng (B2; `:65` là WordPress 2026/07 còn có trong R2) |
| `src/components/common/PostCard.tsx:16,152,238`, `VerticalAnchorNav.tsx:30`, `StatueListClient.tsx:28,346,352`, `VuTruPhatGiaoClient.tsx:19`, `TieuSuSuToOdysseyView.tsx:73-102`, `ArticleDetailTemplate.tsx:106`, `BookCitationSection.tsx:128-216`, `FourCirclesPortalSection.tsx` (12), `ThapDaiDeTuCards.tsx` (10), `GalaxyTimelineGallery.tsx` (35) và khoảng 40 tệp component khác (xem `manifest`, mục `code_refs`) | ảnh B2 viết cứng, nhiều chỗ là `<img src>` thẳng tới B2 |
| `src/components/tong-chi-tu-hoc/chi-tiet/BookFlipModal.tsx:50`, `src/features/universe/components/TuAnFlipbook.tsx:10` | ghép `page_NN.webp` của B2 (30 trang) |
| `src/data/*.json|ts` | **khoảng 1.225 lần nhắc địa chỉ B2/WordPress/b1 ở 21 tệp**, lớn nhất: `thu-vien-data.ts` 427, `tong-chi-data.json` 168 (có địa chỉ `admin.`), `danh-tang-database.json` 91, `danh-tang-data.ts` 90, `heritageGalleryData.ts` 75, `quan-am-33-data.ts` 64, `statue-article-extras.json` 59, `gioi-thieu-*.{ts,json}` 71 (có 14 địa chỉ `b1.congngheviet.com.vn`), `schedule-*.{ts,json}` 59, `tong-chi-tu-hoc-data.ts` 29 |
| `scripts/review_statues.html` | công cụ duyệt cục bộ, không được phục vụ |
| `public/_headers` | không có luật phụ thuộc host ngoài |

## 6. Rủi ro đã thấy

1. **Đã hỏng trước khi chuyển:** 495 ảnh album WordPress (107 bài), 83 ảnh album bên thứ ba không lấy được, 54 đường dẫn `/images/…` của V3, 8 ảnh viết cứng trong mã V3 và 4 ảnh `media` B2 đã mất. Chuyển sang R2 không cứu được những ảnh đã mất; cần danh sách để chủ quyết định.
2. **Ảnh trong R2 không đồng nhất với nguồn** (EXIF xóa, cắt 2560 px): kích thước R2 nhỏ hơn hoặc lớn hơn đến 8% so với nguồn, nên không dùng kích thước để chứng minh "đã chép đủ". Nên đối chiếu `etag`/`checksum` (cột `media.checksum` trống 100%).
3. **Không có `media.size_bytes` nào được điền** (21.452/21.452 rỗng): kích thước phải lấy từ R2 hoặc từ nguồn.
4. **Trùng lặp:** R2 có 390 nhóm tệp cùng `etag` (428 tệp thừa, 62.960.667 B ≈ 60 MB); 15 nhóm trong đó là cùng ảnh nằm ở `media-tunglamhoaphuc/…` và `s2-cnv03/tunglamhoaphuc2/…`. Có thể gom, nhưng đổi khóa thì phải đổi mọi tham chiếu: **không nên dọn trước khi chuyển xong**. Ngoài R2, ảnh giống nhau dưới hai địa chỉ (ví dụ 85 dòng WP trùng tên tệp với ảnh đã có trong R2 ở `tunglamhoaphuc2/…`, 80 dòng chỉ khác hậu tố kích thước) mới là ứng viên; chưa chứng minh được vì chưa tải về so byte.
5. **Chuỗi truy vấn, mã hóa, hoa thường:** 28 dòng `media` có chuỗi truy vấn (đều là Facebook, mất khi bỏ); 40 dòng dùng mã hóa phần trăm (tên tiếng Việt `l%C3%A0m-v%E1%BB%A3-…`); 0 dòng có khoảng trắng hoặc ký tự không ASCII; R2 không có khóa nào trùng nhau khi bỏ phân biệt hoa thường; khóa thật chứa `1..jpg`, `-jpg` (không đuôi) và `Hoa-Thuong-Thich-Thien-Phuoc-1924-1986-.gif`.
6. **Sai kiểu nội dung:** 15 tệp trong R2 (14 `.webp`, 1 `.gif`) mang `Content-Type: image/jpeg` (12 tệp `calendar_webp/thang-*.webp`, `mandala-tang-1-…webp`, `di-qua-kho-vui-cuoc-doi-bia-1.webp`, `Hoa-Thuong-Thich-Thien-Phuoc-1924-1986-.gif`); route chỉ kiểm `image/*` nên vẫn phục vụ. Có thêm 1 tệp không đuôi (`…/anh-hoa-thuong-tong-hop/-jpg`).
7. **Đuôi và kiểu:** `.jfif` 62 tệp (kiểu `image/jpeg`), `.png` 14, `.gif` 2, **không có `.svg` nào**. Hàm `isImagePath` chấp nhận `.jfif`, `.avif`; trong dữ liệu hiện có chưa gặp `.avif`.
8. **Route dự phòng che lỗi:** `serveMedia()` âm thầm lấy từ B2 khi R2 thiếu, nên ảnh B2 chưa có trong R2 (ví dụ 5 ảnh `s2-cnv03` hay ảnh của gương WordPress nếu đổi khóa) vẫn hiện được; chỉ ảnh qua `/anh-goc/wordpress/` mới hỏng vì WordPress trả 404. **Bỏ dự phòng trước khi chép đủ sẽ làm hỏng thêm ảnh.**
9. **Phụ thuộc id:** `media.id` là băm của địa chỉ ảnh lúc nhập (`storedMediaAddress`), `media_usage` và nội dung bài dùng id đó. Khi đổi `media.url` WordPress thành `media.r2_key`, **giữ nguyên `id`**.
10. **Ảnh không đi qua `/anh-goc/`:** các thẻ `<img src="https://…backblazeb2.com/…">` trong V3 (dòng 12 và 14 của bảng 1) và route `/images/[...path]`; sửa mã cho từng chỗ, không chỉ đổi route.
11. **Biên tập viên có thể đưa ảnh ngoài vào** (dòng 17 của bảng 1): nếu không thu hẹp `safeMediaSrc` và `picture`, "chỉ trên Cloudflare" sẽ bị phá lại.
12. **Ảnh bên thứ ba:** xem mục 4; ảnh `i.ytimg.com` ở `WelcomeSection.tsx:104` là thumbnail video YouTube do YouTube sinh, xử lý riêng (chủ quyết định có tải về R2 hay không).

## 7. Điều chưa đo được

- **Tổng dung lượng và số tệp thật của hai bucket B2** (`s2-cnv03`, `media-tunglamhoaphuc`): chưa có khóa B2 để liệt kê, nên "nguồn còn bao nhiêu byte chưa chép" chỉ biết với những địa chỉ mà D1 và mã nhắc tới; các con số "khoảng 2,9 GB" và "khoảng 70 MB" chỉ là ngoại suy từ mẫu 100 và 30 tệp.
- Số tệp thật trong `wp-content/uploads` của máy chủ WordPress `209.42.27.235` (không có quyền vào máy chủ; chỉ đo từng địa chỉ qua HTTP).
- Có bao nhiêu yêu cầu thật của khách đang rơi vào đường dự phòng B2/WordPress (chưa đọc Workers Logs); số này quyết định khi nào tắt được B2.
- Nội dung (byte) của tệp khác tên có trùng nhau không: chưa tải về, chỉ so `etag` trong R2 và tên tệp.
- Kích thước 2 ảnh `vnn-imgs-f.vgcloud.vn` (nguồn không trả `Content-Length`), 15 ảnh `img2.infonet.vn` (kết nối quá hạn từ mạng của tôi), 4 ảnh Facebook bị 403 (cần trình duyệt có phiên).
- Dung lượng Workers Assets sau build (chỉ cộng kích thước thư mục `public/` trong repo).
- Các tên miền ngoài đã thử chỉ từ một mạng (Đông Nam Á); `HEAD` có thể khác nếu thử từ nơi khác.
- Tổng số yêu cầu đã gửi: khoảng 1.650 `HEAD` hoặc `GET` một byte (≤ 4,5 mỗi giây), không có yêu cầu ghi nào.

## 8. Thứ tự chuyển và cỡ lô khuyến nghị (chưa làm, cần chủ đồng ý từng bước)

Mọi bước ghi (R2, D1, deploy) phải được chủ dự án đồng ý, theo CLAUDE.md.

| Bước | Việc | Số ảnh, dung lượng | Cỡ lô | Kiểm |
|---|---|---|---|---|
| 0 | Chủ quyết định số phận 158 ảnh không lấy được (mục 4) | 158 | không | danh sách trong `manifest` (`recommended_action`) |
| 1 | Sao chép **trong R2** 120 ảnh khóa bucket kia (hoặc sửa mã V3 đọc `s2-cnv03`) | 120, 16,7 MB | 1 lô | `HEAD` từng khóa đích |
| 2 | Chép 196 ảnh B2 `media-tunglamhoaphuc` (gồm 30 trang sách lật) vào `media-tunglamhoaphuc/<path>` | 196, 48,0 MB | 2 lô 100, `--at-once=14` | đối chiếu `etag`/kích thước, mở `/anh-goc/…` |
| 3 | Chép 483 ảnh WordPress cũ **từ gương B2** vào R2 (khóa `wordpress/<path>` để không đổi mã) | 483, 202,7 MB | 5 lô 100 (lô cuối 83) | mở mẫu 20 ảnh mỗi lô; 12 ảnh đã có chỉ đổi tham chiếu |
| 4 | Chép 1 ảnh `1..jpg` và 4 ảnh bên thứ ba còn sống; **đổi `media.url` thành `media.r2_key`** của các dòng đã chép (87 dòng bên thứ ba còn lại tùy bước 0) | 5, 0,33 MB | 1 lô | `media_has_place`, id giữ nguyên, `db.batch` kèm nhật ký, 100 dòng mỗi lô |
| 5 | Sửa mã V3 và www: bỏ địa chỉ B2/WordPress viết cứng (viết lại về `/anh-goc/…`), sửa route `/images/[...path]` đọc R2, thu hẹp `safeMediaSrc`, `remotePatterns`, CSP admin | xem mục 5 | theo tệp | `npm run typecheck && npm run lint && npm test`; quét lại bằng cùng tập lệnh kiểm kê |
| 6 | Quan sát nhật ký 1–2 tuần: **không còn yêu cầu nào rơi vào dự phòng** | | | Workers Logs |
| 7 | Bỏ đường dự phòng (`mediaSource().origin`, `fetchOrigin`, `/cdn-cgi/image` sang `admin.`), gỡ tên miền B2 và WordPress khỏi mã; sau đó mới tính tắt `admin.`/`old.` và B2 | | | quét lại: 0 địa chỉ ngoài |
| 8 | (Tùy chọn) gom 428 tệp trùng (60 MB) và xóa 24 tệp mồ côi (11,1 MB) | | | chỉ sau bước 7 và có sao lưu |

Phụ lục: tập lệnh dùng để đo (`q.mjs`, `r2list.mjs`, `an*.mjs`, `final.mjs`, `head*.mjs`) và kết quả trung gian (`media.json`, `usage.json`, `r2.json`, `head-results*.json`, `trung-lap-trong-r2.json`) nằm cùng thư mục `anh\` của scratchpad; có thể chạy lại, tất cả chỉ đọc.
