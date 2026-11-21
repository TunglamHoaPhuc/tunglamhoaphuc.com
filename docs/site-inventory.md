# Kiểm kê website tunglamhoaphuc.com

Ngày lập: 21/11/2026. Phạm vi: trang công khai `https://www.tunglamhoaphuc.com/` và mã nguồn trong repo này (nhánh `chore/khoi-tao-du-an`, commit `c796b92`).

Tài liệu này là đầu vào cho việc thiết kế Admin CMS (Pha 2). Nó chỉ mô tả hiện trạng, chưa đề xuất thiết kế.

## 0. Cách khảo sát và độ tin cậy

| Nguồn | Cách làm | Ký hiệu trong tài liệu |
|---|---|---|
| Trang thật | Mở trang chủ bằng Chrome (DOM sau khi chạy JS, console, danh sách request). Tải HTML đã render của trang chủ, 9 trang chỉ mục, 7 trang chi tiết mẫu, `sitemap.xml`, `robots.txt` | **[web]** |
| Mã nguồn | Ba tác tử đọc `src/`, `migrations/`, `data/snapshot/`, `docs/van-hanh/`, `tasks/` | **[mã]** |

Ba điều cần biết trước khi đọc tiếp:

1. **Trang www hiện chính là bản dựng từ repo này.** Commit `9987034` đã chuyển www và tên miền gốc sang Worker `tlhp-web`. Phản hồi của www mang header `X-Vinext-Build-Id`. [web]
2. **Nội dung được render sẵn ở máy chủ.** HTML trả về đã có đủ menu, bài viết, lịch, bảo tượng. Trình duyệt không gọi API dữ liệu nào; các request `fetch` chỉ là tải trước trang kế tiếp (RSC prefetch). Console không có lỗi. [web]
3. **Chưa có mã Admin mới nào.** Repo chỉ có schema D1 và script nhập liệu. Việc soạn nội dung vẫn làm ở admin cũ (Next.js trên Vercel, sau Cloudflare Access).

Những chỗ chưa kiểm chứng được ghi rõ "chưa kiểm chứng" ngay tại dòng đó.

## 1. Cây điều hướng và icon

### 1.1 Header

Toàn bộ menu khai báo cứng trong `src/config/site.ts:138-164`. Menu chỉ hỗ trợ 2 cấp (`NavItem.children`). [mã] Đã đối chiếu khớp với trang thật. [web]

| Cấp 1 | Cấp 2 | Đường dẫn | Icon |
|---|---|---|---|
| **Giới thiệu** (nút mở dropdown) | Lịch sử Bổn tự | `/gioi-thieu/lich-su-tung-lam-hoa-phuc` | ảnh `/brand/logo-tung-lam-hoa-phuc-tron-nga.webp` |
| | Chư Tôn Đức | `/gioi-thieu#nguoi-lien-quan` | không có, hiện chấm vàng CSS |
| | Thanh quy | `/gioi-thieu/van-hoa-ung-xu` | không có, hiện chấm vàng CSS |
| | Vũ Trụ Phật Giáo | `/vu-tru-phat-giao` | ảnh `icon-cac-khu-vuc-noi-bat.webp` |
| | Bảo Tượng Phật Giáo | `/bao-tuong-phat-giao` | ảnh `icon-cac-bao-tuong-noi-bat.webp` |
| **Tin tức – Pháp thoại** (nút mở dropdown) | Dòng Chảy Hoằng Pháp | `/dong-chay-hoang-phap` | ảnh `icon-dong-chay-hoang-phap.webp` |
| | Tông Chỉ Tu Học | `/tong-chi-tu-hoc` | ảnh `icon-tong-chi-tu-hoc.webp` |
| | Trí Tuệ Phật Pháp | `/tri-tue-phat-phap` | ảnh `icon-tri-tue-phat-phap.webp` |
| **Lịch tu học** | | `/lich-tu-hoc` | |
| **Liên hệ** | | `/lien-he` | |

Phần phụ của header (`src/components/layout/header/Header.js`):

- Logo `/brand/logo-moc-an.webp` (400×297) về `/`.
- Nút tìm kiếm (icon font `tji-search`), mở hộp tìm gửi `GET /tim-kiem?q=`. Tắt được bằng `site.features.search`.
- Nút gọi điện (`tji-phone`, `tel:0979345373`) và nút bản đồ (`tji-location`, Google Maps).
- Nút vàng "Đăng ký khóa tu" về `/lich-tu-hoc#khoa-tu`.
- Thanh thông báo `site.announcement`, hiện đang `null`.
- Header có bản sao dính đầu trang khi cuộn (`header-duplicate header-sticky`).

### 1.2 Menu di động (dưới 1280px)

Dùng chung `site.nav`, dạng accordion (`MobileMenu.js`, `MobileNavbar.js`, `MobileMenuItem.js`). Icon của mục con không hiện trên di động. Có thêm ô tìm kiếm, nút đăng ký, khối liên hệ (điện thoại, giờ mở cửa, địa chỉ) và khối mạng xã hội (`site.social`, hiện rỗng). [mã]

### 1.3 Footer

Footer không có menu liên kết, chỉ có 4 cột thông tin lấy từ `site.ts` (`src/components/layout/footer/Footer2.js`):

| Cột | Nội dung |
|---|---|
| Bổn tự | Dấu tròn về `/`, đoạn giới thiệu, địa chỉ "Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội" |
| Thời khóa tu học | Giờ mở cửa "Sáng 7:30 – 10:30 · Chiều 13:30 – 17:30", nút "Xem lịch tu học" |
| Liên hệ | 7 người theo 3 vai trò (Trưởng ban lãnh chúng, Thư ký, Hỗ trợ thông tin), mỗi người một số `tel:` |
| Bản đồ chùa | `site.mapImage` đang `null` nên hiện địa chỉ, kèm nút "Mở Google Maps" |

Dưới cùng: dải chữ chạy khẩu hiệu, dòng bản quyền (ghi cứng "Phật lịch 2570") và nút lên đầu trang.

### 1.4 Sidebar và điều hướng trong trang

Trang công khai không có sidebar chuyên mục. Điều hướng trong trang gồm:

| Vị trí | Dạng | Tham số | Nguồn |
|---|---|---|---|
| Danh sách bài (Dòng Chảy, Trí Tuệ) | Hàng nút chuyên mục kèm số bài, ô sắp xếp, phân trang 12 bài | `?danh-muc=&sap-xep=&trang=` | dữ liệu |
| Lịch tu học | Nút lọc loại sự kiện có icon, chuyển tháng | `?thang=&loai=` | dữ liệu |
| Bảo Tượng | Form lọc | `?q=&chung-hoi=&khu-vuc=&loai=&trang=` | dữ liệu |
| Trang chi tiết | Mục lục neo (Tổng quan, Nội dung chính, Album ảnh, Tìm hiểu thêm…) | `#...` | `AnchorTabs.tsx` |
| Mọi trang con | Breadcrumb "Trang chủ › mục › tiêu đề" | | mỗi trang tự truyền |
| Trang chủ | 6 "lối vào" chuyên mục | | `site.entrances`, ghi cứng |

### 1.5 Icon

**Icon chuyên mục là ảnh WebP, không phải SVG.** Có 14 tệp 128×128 trong `public/brand/icons/` (bộ nhận diện gốc có 21 biến thể ở `bo-nhan-dien/03_Bo_Icon_Chuyen_Muc/`, không đưa lên web hết).

| Tệp | Gắn với | Nơi dùng |
|---|---|---|
| `icon-tong-chi-tu-hoc` | Tông Chỉ Tu Học | menu, lối vào, tiêu đề khối, thẻ nhóm tông chỉ |
| `icon-dong-chay-hoang-phap` | Dòng Chảy Hoằng Pháp | menu, lối vào, khối tin tức, khối lời chào |
| `icon-tri-tue-phat-phap` | Trí Tuệ Phật Pháp | menu, lối vào |
| `icon-cac-khu-vuc-noi-bat` | Vũ Trụ Phật Giáo | menu, lối vào, khối khu vực, thẻ khu vực |
| `icon-cac-bao-tuong-noi-bat` | Bảo Tượng Phật Giáo | menu, lối vào, thẻ bảo tượng |
| `icon-lich-tu-hoc` | Lịch tu học | khối khóa tu sắp tới |
| `icon-tin-moi-nhat` | tab "Tin mới nhất" | khối tin tức trang chủ |
| `icon-dau-an-hoang-phap` | tab "Dấu ấn hoằng pháp" | khối tin tức, đầu mọi trang con |
| `icon-quote-chu-de` | Lời Thầy dạy | khối lời Thầy dạy |
| `icon-khoa-le-truyen-thong` | loại sự kiện Khóa Lễ Truyền Thống | ô lịch (24px), chú giải (20px) |
| `icon-cong-tu` | loại sự kiện Cộng Tu | ô lịch, chú giải |
| `icon-dai-le-su-kien` | loại sự kiện Đại Lễ Sự Kiện | ô lịch, chú giải |
| `icon-phap-am` | (chưa dùng) | có trong kiểu `SectionMark`, không thấy nơi gọi |
| `icon-tinh-do-nhan-gian` | (chưa dùng) | có trong kiểu `SectionMark`, không thấy nơi gọi |

Dấu tròn `/brand/logo-tung-lam-hoa-phuc-tron-nga.webp` (320×320) thế chỗ khi mục không có icon riêng (Giới thiệu, Lịch sử Bổn tự, Chư Tôn Đức).

Các loại icon khác:

| Loại | Chi tiết |
|---|---|
| Icon font Bexon `tji-*` | `src/app/assets/css/bexon-icons.css`, khoảng 63 lớp, đang dùng khoảng 30 (mũi tên, tìm kiếm, điện thoại, vị trí, nhà, lịch, play) |
| Font Awesome Brands | khoảng 6 lớp cho mạng xã hội (hiện danh sách rỗng) |
| Font Awesome Pro | có tệp trong `src/app/assets` (khoảng 4.700 lớp) nhưng không được nạp |
| SVG inline | chỉ 2 nút đóng "×" (menu di động, hộp tìm kiếm) |

Chuyên mục con của bài viết (Cộng Tu Định Kỳ, Pháp Âm…) chưa gắn icon nào; nút lọc chỉ có chữ. Bảng `category` có cột `color_token` nhưng chưa có cột icon.

## 2. Loại trang và thực thể dữ liệu

### 2.1 Bảng route

Sitemap thật có **829 URL**. [web] Mẫu hiển thị do thư mục route quyết định, không do dữ liệu. [mã]

| Route | Số URL | Loại | Nguồn dữ liệu |
|---|---|---|---|
| `/` | 1 | Trang chủ | `loadHomeData` (`src/libs/home.ts`) |
| `/gioi-thieu`, `/gioi-thieu/[slug]` | 1 + 6 | Trang giới thiệu | `gioi-thieu.json` → bảng `page`, `milestone` |
| `/tong-chi-tu-hoc`, `/[slug]` | 1 + 25 | Bài tông chỉ theo 5 nhóm | `tong-chi.json` → `teaching_article` |
| `/dong-chay-hoang-phap`, `/[slug]` | 1 + 471 | Tin, ký sự | `posts.json` → `post` |
| `/tri-tue-phat-phap`, `/[slug]` | 1 + 158 + 2 trang riêng | Bài viết, pháp âm, video, sách | `posts.json` → `post` |
| `/vu-tru-phat-giao`, `/[slug]` | 1 + 14 | Khu vực trong chùa | `vu-tru.json` → `area` |
| `/bao-tuong-phat-giao`, `/bao-tuong/[slug]` | 1 + 126 | Bảo tượng | `bao-tuong.json` → `statue`, `statue_cluster`, `art_variation` |
| `/lich-tu-hoc`, `/[slug]` | 1 + 18 | Lịch, sự kiện | `schedule.json` → `calendar_event`, `featured_program`, `month_theme` |
| `/lien-he` | 1 | Liên hệ | `src/config/site.ts` |
| `/tim-kiem` | (noindex) | Tìm kiếm | chỉ mục trong bộ nhớ |
| `/styleguide`, `/demo-bo-cuc`, nhóm `(mau-bexon)` | | Nội bộ, mẫu Bexon | 404 trên tên miền công khai |

Hạ tầng liên quan: `robots.ts`, `sitemap.ts` (làm mới mỗi giờ), `manifest.ts`, trang 404 chung, `error.js` theo nhóm. Chuyển hướng nằm trong `next.config.js`: tên miền gốc về www (301), `/admin`, `/login`, `/van-hanh` về `quantri.tunglamhoaphuc.com` (307). **Chưa có bảng chuyển hướng link cũ**; bảng `redirect` đã có trong schema nhưng chưa dùng.

### 2.2 Bài viết giới thiệu tĩnh

Có 6 chủ đề trong 3 nhóm:

| Nhóm | Slug | Tiêu đề |
|---|---|---|
| Lịch Sử Chùa | `lich-su-tung-lam-hoa-phuc` | Lịch sử Tùng Lâm Hòa Phúc |
| Người Liên Quan | `dai-su-lien-dang` | Đôi nét về Đại sư Liên Đăng |
| | `su-ong-hoang-phap` | Đôi nét về Đại sư Thanh Lương |
| | `su-phu-tru-tri` | Tiểu sử Sa môn Thích Tâm Hòa |
| | `tieu-su-su-to` | Tiểu sử Sư tổ Ngộ Chân Tử |
| Thanh Quy & Văn Hóa | `van-hoa-ung-xu` | Văn hóa ứng xử thiền môn |

Trường dữ liệu: tiêu đề, phụ đề, nhãn, nhóm, ảnh banner và ảnh chân dung (kèm vị trí cắt), tóm tắt, khối trích dẫn (tiêu đề, các dòng, tác giả), **mốc niên biểu** `[{năm, tiêu đề, mô tả}]` (năm có thể là chữ như "Thời Cổ Tự"), nội dung (Markdown nhẹ; 1 bài là HTML), album ảnh, sách nguồn, thứ tự, trạng thái.

Bố cục trang chi tiết: Tổng quan → Mốc niên biểu → Nội dung → Album ảnh → Cùng mục. [web]

### 2.3 Bài viết theo chuyên mục

| Mục | Chuyên mục con (slug: tên, số bài) |
|---|---|
| Dòng Chảy Hoằng Pháp (471) | `cong-tu`: Cộng Tu Định Kỳ 189 · `tinh-do-nhan-gian`: Tịnh Độ Nhân Gian 126 · `khoa-le-truyen-thong`: Khóa Lễ Truyền Thống 121 · `dai-le-su-kien`: Đại Lễ Sự Kiện 35 |
| Trí Tuệ Phật Pháp (158) | `bai-viet`: Bài Viết 126 · `phap-am`: Pháp Âm 15 · `video`: Video Phật Pháp 15 · `an-pham-sach`: Ấn Phẩm & Sách 2 |
| Tông Chỉ Tu Học (25) | Tông Phong Truyền Thừa 3 · Nền Tảng Tu Học 5 · Phương Pháp Hành Trì 8 · Lộ Trình Tu Học 4 · Nếp Sống Thiền Gia 5 |

Số bài lấy từ trang thật. [web]

Trường của một bài (`posts.json`, kiểu `Post` trong `src/libs/content/types.ts`):

- Định danh: `id`, `wpPostId`, `slug`, mục (`mainCategory`), chuyên mục con (`subCategory`, `categoryName`).
- Nội dung: `title`, `subtitle`, `summary`, `content`, `author`, `publishedDate`, `status`, `viewsCount`.
- Ảnh: `thumbnailUrl`, `bannerUrl`, mỗi ảnh kèm vị trí cắt (ví dụ "center 50%").
- Mở rộng: `keywords[{keyword,title,description}]`, `photoGallery[{imageUrl,title,caption,isInline}]`, `sourceBook{…}`.

Bài tông chỉ có thêm `videoBlock`, `featuredArticle`, `authorLink`, `excerpt`.

Bố cục bài chi tiết: Tổng quan (ảnh bìa 16:9) → Nội dung chính → Album ảnh tư liệu → Tìm hiểu thêm. [web]

Đặc điểm dữ liệu cũ cần lưu ý khi thiết kế:

- **Nội dung là Markdown nhẹ, không phải HTML.** 0/632 bài chứa thẻ HTML; `normalize.ts` chuyển sang HTML đã lọc khi hiển thị.
- **Slug bài viết không duy nhất.** Bài thứ hai trùng slug không truy cập được.
- Có 2 bài thuộc mục `vu-tru-phat-giao` không có route nào phục vụ.
- Mọi bài đang ở trạng thái "published"; dữ liệu cũ không có nháp hay hẹn giờ.
- Ngày tháng có 3 định dạng: `YYYY-MM-DD`, ISO và `dd.mm.yyyy`.
- Album: 441 album, 15.466 ảnh (`post-albums.json`).

Hai trang riêng trong Trí Tuệ Phật Pháp lấy nội dung từ mã nguồn, không từ CSDL:

| Trang | Nguồn |
|---|---|
| `/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi` (sách, 7 chương mục) | `src/config/triTue.ts`, `src/config/sachDiQuaKhoVui.ts` |
| `/tri-tue-phat-phap/hoc-tieng-tang` (giáo trình Sara Book 120 trang, 24 bài) | `src/config/triTue.ts`, ứng dụng tĩnh `public/tibetan-study/` |

### 2.4 Bảo Tượng Phật Giáo

126 bảo tượng, chia theo 9 chúng hội và 3 loại (Tượng chính, Nghệ thuật Phật giáo, Bảo vật).

| Hạng mục | Hiện trạng |
|---|---|
| Mã định danh | `code` dạng `TP0001`. **25/126 bảo tượng không có mã.** Schema mới chỉ đánh index, chưa ràng buộc duy nhất |
| Slug | Dạng gạch dưới, kết thúc bằng mã: `/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001` |
| Trường chính | tên, danh hiệu, phụ đề, loại, chúng hội, cụm tượng, khu vực đặt tượng, ảnh (kèm vị trí và góc xoay), trích dẫn và tác giả, tóm tắt, lịch sử (HTML), bài viết kèm (66 bảo tượng) |
| Biến thể nghệ thuật | `artVariations[{id,title,location,meaning,imgUrl}]`, có thể trỏ sang bảo tượng khác |
| Bảo tượng liên quan | **Tính tự động**: cùng cụm trước, rồi cùng chúng hội, tối đa 4 (`src/libs/baoTuong.ts:78`). Không có trường chọn tay |
| "Ban biên tập" | Không có trường này. Tác giả bài kèm trong dữ liệu là "Ban Văn Hóa Tùng Lâm" |
| Nhiều góc ảnh | Chưa có. Mỗi bảo tượng 1 ảnh chính và 1 ảnh đại diện |

Bố cục trang chi tiết: Tổng quan (ảnh 3:4, danh hiệu, chúng hội, khu vực) → Câu chuyện → Nghệ thuật Phật giáo → Bảo tượng liên quan. [web]

### 2.5 Vũ Trụ Phật Giáo (khu vực)

14 khu vực, có sơ đồ 2D với ghim đánh số. Trường: số ghim, slug, tên, phụ đề, ảnh bìa, vị trí ghim (%), mô tả, nội dung, danh sách tượng.

Ba phần đang bị ghi đè bằng cấu hình trong `src/config/vuTru.ts`: ảnh bìa theo slug, vị trí ghim (dữ liệu admin cũ sai ở 9 khu vực), và bảng nối mã khu vực của bảo tượng sang slug khu vực.

Lưu ý: khu vực "Lầu Kinh Luân" mang slug `ho-phong-sinh`. [web]

### 2.6 Khóa tu và sự kiện

| Thành phần | Dữ liệu | Ghi chú |
|---|---|---|
| Sự kiện riêng (15) | `solarDateStr` (dd.mm.yyyy), `endDateStr`, `isMultiDay`, tiêu đề, phụ đề, loại, 2 khung giờ (`timeSlot1/2 Label + Time`), địa điểm, mô tả, lưu ý, ảnh (kèm vị trí dọc), video | |
| Chương trình thường kỳ (3) | tiêu đề, lịch, tóm tắt, giờ, thời lượng, địa điểm, ảnh | Ngày âm lịch được **đọc ra từ câu chữ** trong phần tóm tắt ("ngày 14 và cuối tháng", "rằm") rồi sinh sự kiện từng tháng (`src/libs/calendar.ts:106-144`) |
| Chủ đề tháng (12) | tháng, ảnh, tiêu đề, các dòng thơ, tác giả | Dùng cho lịch và khối Lời Thầy dạy |
| Tranh trích dẫn (12) | ảnh, tiêu đề | Đã lưu nhưng chưa hiển thị |

- **Ngày âm lịch không được lưu.** Mọi giá trị âm lịch được tính từ ngày dương bằng thuật toán Hồ Ngọc Đức, múi giờ +7 (`src/libs/lunar.ts`).
- **Bộ đếm ngược** là nhãn theo ngày ("Còn 14 ngày", "Diễn ra hôm nay"), không phải đồng hồ giây (`src/libs/countdown.ts`).
- **Chọn sự kiện kế tiếp** (`src/libs/home.ts:217-221`): khối "Khóa tu sắp tới" lấy 3 sự kiện đầu có ngày kết thúc từ hôm nay trở đi, bỏ tiêu đề trùng; slide hero lấy sự kiện đầu có ngày bắt đầu từ hôm nay.
- **Đăng ký khóa tu chưa có.** Nút "Đăng ký khóa tu" chỉ dẫn về `/lich-tu-hoc#khoa-tu`. Schema đã có bảng `registration` và cột `registration_open`, chưa có mã dùng tới.

Bố cục trang sự kiện: ảnh bìa → Thông tin thời khóa hành trì → Ý nghĩa và mục đích → Lưu ý khi tham dự → Ký sự liên quan. [web]

### 2.7 Lời Thầy dạy

Hiện không có thực thể "trích dẫn" riêng. Khối này lấy **các dòng thơ của chủ đề tháng**: tháng hiện tại đứng đầu, rồi các tháng kế tiếp xoay vòng quanh năm (`versesFrom`, `src/libs/home.ts:179`). Hiển thị bằng Swiper tự chạy có nút tạm dừng. Không có trường nguồn kinh hay bài giảng, không có chế độ ngẫu nhiên.

### 2.8 Các khối trên trang chủ

Thứ tự thật trên trang: [web]

| # | Khối | Nội dung | Sửa ở đâu hiện nay |
|---|---|---|---|
| 1 | Hero | 3 slide: slide tĩnh "Nơi để trở về / Chốn thiêng bình yên" + sự kiện kế tiếp + bài mới nhất có banner ("Pháp sự mới nhất · ngày"). Có nút tạm dừng | Slide 1 trong `site.hero`; 2 slide sau tự động |
| 2 | Lối vào | 6 chuyên mục kèm icon | `site.entrances` |
| 3 | Khóa tu sắp tới | Tối đa 3 sự kiện, nhãn đếm ngược, ngày dương và âm, thời khóa, địa điểm | tự động từ lịch |
| 4 | Tin tức hoằng pháp | 2 tab: Tin mới nhất (6 bài), Dấu ấn hoằng pháp (6 bài nhiều lượt xem) | tự động |
| 5 | Lời chào | Trích dẫn của Thượng tọa Thích Tâm Hòa, đoạn giới thiệu, video YouTube, số liệu | lấy từ bài lịch sử + `site.ts` |
| 6 | Con đường tu học | 5 nhóm tông chỉ và các bài | tự động + `src/config/tongChi.ts` |
| 7 | Khu vực nổi bật | Slider 14 khu vực, mở đầu bằng Lầu Kinh Luân | tự động |
| 8 | Lộ trình tu học | 4 lộ trình (người mới, người trẻ, người bận rộn, người chuyên tu) | tự động |
| 9 | Lời Thầy dạy | Thơ theo chủ đề tháng | tự động |
| 10 | Chư Tôn Đức | 4 vị trong nhóm Người Liên Quan | tự động |

Số liệu thống kê gồm 3 con số: tổng bài Dòng Chảy, tổng bài Trí Tuệ và năm Phật lịch. **Phật lịch được tính tự động**: năm dương + 544 sau lễ Phật đản, trước đó + 543 (`src/libs/lunar.ts:129-132`). Riêng dòng bản quyền ở footer ghi cứng "Phật lịch 2570".

### 2.9 Cấu hình chung và tìm kiếm

- **Thông tin chùa** nằm trọn trong `src/config/site.ts`: tên, khẩu hiệu, địa chỉ, điện thoại, 7 đầu mối liên hệ, giờ mở cửa, link bản đồ, mạng xã hội, thanh thông báo, menu, hero, video giới thiệu. Muốn đổi phải sửa mã và deploy lại.
- **Tìm kiếm** dùng chỉ mục trong bộ nhớ trên bài viết, tông chỉ, giới thiệu, khu vực, bảo tượng, lịch; khớp không phân biệt dấu (`/tim-kiem?q=&muc=&trang=`).
- **SEO**: mỗi trang chi tiết có `generateMetadata` (tiêu đề, mô tả, ảnh OG), trang chủ có JSON-LD `Organization` + `BuddhistTemple`. Chưa có trường SEO nhập tay; bảng `post` đã có cột `seo_*`.
- **Danh Tăng**: có 91 bản ghi trong dữ liệu và bảng `monk`, chưa có trang công khai.

## 3. Bản đồ media và tỷ lệ ảnh

### 3.1 Vị trí ảnh và khung hình

| Vị trí | Tỷ lệ khung | Cỡ phục vụ | Trường nguồn | Component |
|---|---|---|---|---|
| Hero trang chủ | tràn màn hình, ngang gần 16:9; bản dọc 760×1080 cho điện thoại | 1280 / 1920; ảnh nhỏ 80×80 | tĩnh `public/images/hero/*`; `event.image`; `post.banner` | `Hero2.js` |
| Icon chuyên mục, lối vào, menu | 1:1 | hiển thị 20–64px (tệp 128) | `public/brand/icons` | `Brands2.js`, `Navbar.js`, `SectionMark.tsx` |
| Thẻ tin trang chủ | gần 8:9, cao theo thẻ | 640 | `post.thumbnail ?? banner` | `BlogCard2.js` |
| Thẻ bài trong danh sách | **4:3** | 640 | `post.thumbnail` | `PostCard.tsx` |
| Ảnh bìa bài, khu vực, sự kiện | **16:9** | 1280 | `banner`, `cover`, `image` | `PostArticle.tsx` và các trang `[slug]` |
| Ảnh trong thân bài | tự do, rộng 100% | ảnh gốc | Markdown trong `content` | `normalize.ts` |
| Ảnh album và hộp xem lớn | **4:3** | 640 / 1920 | `album_item` | `PostGallery.tsx` |
| Ảnh poster video | 16:9 | 640 | `post.banner` | `PostVideos.tsx` |
| Thẻ sự kiện, chương trình thường kỳ | **16:9** | 640 | `calendar_event.image`, `featured_program.image` | `EventCard.tsx` |
| Hộp thoại ngày | dải ngang cao 180px | 640 | `calendar_event.image` | `DayDialog.tsx` |
| Tranh chủ đề tháng, Lời Thầy dạy | 1200:1015 (khoảng 6:5) | 1280 | `month_theme.poster` | `MonthTheme.tsx`, `Testimonials2.js` |
| Thẻ khu vực | **16:10** | 640 | `area.cover` | `AreaCard.tsx` |
| Slide khu vực trang chủ | cao tối thiểu 550px | 640 | `area.cover` | `PortfolioCard2.js` |
| Sơ đồ 2D | 1920:1087 | ảnh gốc | khóa B2 cố định | `TempleMap.tsx` |
| Thẻ bảo tượng | **3:4** | 360 / 640 | `statue.image` | `StatueCard.tsx` |
| Thẻ nghệ thuật Phật giáo | 4:3 | 360 / 640 | `art_variation.image` | `bao-tuong/[slug]` |
| Thẻ Chư Tôn Đức, Giới thiệu | **3:4** | ảnh gốc, không thu nhỏ | `page.portrait ?? banner` | `AboutCard.tsx` |
| Chân dung trang chi tiết | 3:4 | 1280 | `portrait`, `statue.image` | `gioi-thieu/[slug]`, `bao-tuong/[slug]` |
| Bìa sách | 3:4 | 360–640 | `book.cover` | trang tông chỉ, giới thiệu, sách |
| Logo header | khoảng 4:3 (400×297) | cao 40 / 48 / 104px | `public/brand/logo-moc-an.webp` | `Logo.js` |
| Dấu tròn footer, CTA | 1:1 | 320 | `public/brand/…-tron-nga.webp` | `Footer2.js`, `Cta.js` |
| Ảnh OG mặc định | 1.91:1 | 1200×630 | `public/brand/og-tung-lam-hoa-phuc.jpg` | `layout.js` |
| Ảnh OG từng trang | không cắt | ảnh gốc | `banner.src`, `cover.src`… | các `generateMetadata` |
| Favicon, icon ứng dụng | 1:1 | 16, 32, 180, 192, 512 | `public/brand/favicon` | `layout.js`, `manifest.ts` |
| Nền đầu trang con, họa tiết | khoảng 4,5:1; 740×1180 | | `src/app/assets/images`, `public/images/shape` | SCSS |

Các tỷ lệ in đậm là những khung cần preset cắt ảnh trong Admin: **16:9, 4:3, 3:4, 16:10**, cộng 1:1 cho icon và ảnh hero dọc cho điện thoại.

Mọi ảnh dữ liệu đều có trường vị trí cắt đi kèm (`*_position`, mặc định "center 50%") và được áp bằng `object-position`.

### 3.2 Đường phân phối ảnh

| Bước | Cơ chế | Tệp |
|---|---|---|
| Đổi địa chỉ cũ | Link B2 và WordPress được viết lại thành `/anh-goc/<bucket>/<khóa>` | `src/libs/content/media.ts` (`mediaUrl`) |
| Thu nhỏ | Cloudflare Image Resizing: `/cdn-cgi/image/width=W,quality=75,format=auto,onerror=redirect/anh-goc/…` | `imageAt` |
| Cỡ cho phép | 360, 640, 1280, 1920. Giữ ít cỡ vì gói miễn phí giới hạn 5.000 phép biến đổi mỗi tháng | `IMAGE_WIDTH` |
| Phục vụ ảnh gốc | Đọc R2 trước, không có thì lấy từ B2 hoặc WordPress. Chỉ nhận đuôi ảnh và 3 bucket cho phép. Cache 7 ngày | `src/app/anh-goc/[bucket]/[...key]/route.ts` |
| Ảnh hỏng | Thay bằng dấu tròn mờ, giữ URL lỗi trong `data-tlhp-src` | `PageEffects.tsx` |
| Tệp tĩnh | `/images/*`, `/brand/*` cache 1 ngày, không đi qua Worker | `public/_headers` |

### 3.3 Nơi lưu trữ

| Kho | Chi tiết |
|---|---|
| R2 `tlhp-media` (binding `MEDIA`, riêng tư) | 20.912 ảnh, 2,95 GB. Khóa theo quy ước `<bucket-b2>/<khóa>`, `wordpress/<đường dẫn>`, `site/<đường dẫn>`. Ảnh đã bỏ EXIF, thu về tối đa 2560px |
| Backblaze B2 | 2 bucket `s2-cnv03` (chính, tiền tố `tunglamhoaphuc2/0X-…`) và `media-tunglamhoaphuc` |
| WordPress | `admin.tunglamhoaphuc.com/wp-content/uploads/` |
| `public/` | logo, favicon, 14 icon, 4 ảnh hero, họa tiết, 279 tệp của giáo trình tiếng Tạng |

Tổng kho ảnh cũ khoảng 21.600 tệp, 3,65 GB. Bảng `media` trong D1 đã có cột `r2_key`, `url`, `folder`, `filename`, `mime`, rộng, cao, dung lượng, `alt`, `caption`, người tải lên.

### 3.4 Vấn đề ảnh đã biết

- 558 ảnh không sao chép được sang R2 (557 lỗi 404 ở nguồn).
- 37 ảnh ngoài album trả 404: Tông Chỉ 25, Dòng Chảy 8, Giới thiệu 3, Vũ Trụ 1 (`docs/anh-hong-nguon.md`).
- 5/15 sự kiện đang mượn tranh chủ đề tháng, cần ảnh riêng 16:9 tối thiểu 1280×720 (`docs/anh-su-kien.md`).
- Thẻ Chư Tôn Đức, ảnh trong thân bài, ảnh OG từng trang và sơ đồ 2D đang phục vụ ảnh gốc (tới 2560px).
- Hầu hết ảnh có `alt=""`. [web]
- Hai tệp SCSS cùng đặt tỷ lệ cho thẻ bài, thẻ sự kiện, thẻ khu vực (3:2 ở `_tlhp-layout.scss`, 4:3 / 16:9 / 16:10 ở các tệp layout). Theo độ ưu tiên selector thì tệp layout thắng; chưa đo trên trình duyệt.
- Trên trang chủ, 4 trong 6 thẻ tin có `src` rỗng trong HTML ban đầu. Chưa kiểm chứng đây là tải chậm có chủ ý hay ảnh thiếu.

## 4. API và mô hình dữ liệu

### 4.1 Luồng dữ liệu hiện tại

Mọi trang đọc qua một cửa `getContentRepository()` (`src/libs/content/repository.ts`). Biến `CONTENT_SOURCE` chọn nguồn:

| Giá trị | Nguồn | Trạng thái |
|---|---|---|
| `snapshot` (mặc định) | Tệp JSON trong `data/snapshot/` | dùng cho máy cá nhân, dev, CI |
| `d1` | D1 `tlhp-db` qua binding `DB`, làm mới mỗi 60 giây | script deploy đặt giá trị này |
| `b2` | Bucket của admin cũ qua S3 API, khóa chỉ đọc | có mã, đang chờ tên bucket và khóa |

Trang được cache 300 giây (ISR), sitemap 3.600 giây. Chưa có `revalidateTag`, nên sau khi sửa dữ liệu phải chờ hết hạn cache.

Chưa kiểm chứng trực tiếp binding mà Worker www đang chạy; nhận định "www đọc D1" dựa trên `scripts/deploy-v2.mjs` và `docs/van-hanh/d1.md`.

### 4.2 Tám bộ dữ liệu JSON từ admin cũ

| Tệp | Số bản ghi | Điểm đáng chú ý |
|---|---|---|
| `posts.json` | 632 | nội dung Markdown nhẹ |
| `post-albums.json` | 441 album, 15.466 ảnh | bù album mà API danh sách bỏ trống |
| `schedule.json` | 15 sự kiện, 3 chương trình, 12 chủ đề tháng, 12 tranh | ngày dạng dd.mm.yyyy |
| `gioi-thieu.json` | 6 | có mốc niên biểu |
| `tong-chi.json` | 25 | `id` là số |
| `vu-tru.json` | 14 | vị trí ghim theo % |
| `bao-tuong.json` | 126 | `fullHistoryHtml` là HTML |
| `danh-tang.json` | 91 | chưa có trang công khai |

Tài liệu cũ nhắc "13 tệp JSON" nhưng repo chỉ ghi nhận 8 tệp này; tên 5 tệp còn lại không có ở đâu trong repo.

### 4.3 API

| Nhóm | Endpoint | Ghi chú |
|---|---|---|
| Trang mới, công khai | `POST /api/analyze`, `/api/ask-ai`, `/api/crop-analyze`, `/api/tts` | Chỉ phục vụ giáo trình tiếng Tạng (Workers AI). Không liên quan nội dung |
| Trang mới, ảnh | `GET /anh-goc/<bucket>/<khóa>`, `GET /cdn-cgi/image/…` | xem mục 3.2 |
| Admin cũ, đọc | `GET /api/admin/{posts,schedule,gioi-thieu,tong-chi,vu-tru,bao-tuong,danh-tang,views-summary}` | `scripts/fetch-snapshot.ts` dùng để lấy snapshot |
| Admin cũ, ghi | `upload`, `sync-wp`, `sync-wp-posts`, `wp-post-create`, `wp-media`, `repair-links`, `fetch-metadata`, `POST /api/public/increment-view` | Được chắn bằng Cloudflare Access và Worker `tlhp-admin-guard` (cần JWT `CF_Authorization`) |

**Trang mới chưa có API ghi nội dung nào.**

### 4.4 Schema D1 đã có

`migrations/0000_khoi-tao.sql` và `src/db/schema.ts` định nghĩa 24 bảng, 34 khóa ngoại. Khóa chính là chuỗi, giữ nguyên id cũ.

| Nhóm | Bảng | Tình trạng |
|---|---|---|
| Nội dung | `post`, `teaching_article`, `page`, `milestone`, `category` | đã nhập liệu, trang đang đọc |
| Bảo tượng, khu vực | `area`, `statue`, `statue_cluster`, `art_variation` | đã nhập liệu, trang đang đọc |
| Lịch | `calendar_event`, `featured_program`, `month_theme`, `quote_image` | đã nhập liệu, trang đang đọc |
| Media | `media`, `album`, `album_item` | đã nhập liệu, trang đang đọc |
| Danh Tăng | `monk` | đã nhập liệu, chưa trang nào đọc |
| Lượt xem | `page_view` | trang đọc, chưa có gì ghi |
| Quản trị | `user`, `setting`, `notice`, `audit_log`, `redirect`, `registration` | chỉ mới định nghĩa |

Schema hiện tại **chưa có**: cột `deleted_at` (xóa mềm), bảng lịch sử phiên bản, bảng vai trò và quyền (chỉ có cột `user.role` với 4 giá trị cố định), mật khẩu, phiên đăng nhập, token đặt lại mật khẩu, 2FA, bảng menu, cột icon cho chuyên mục, bảng trích dẫn Lời Thầy dạy, cấu hình khối trang chủ, ràng buộc duy nhất cho `post.slug` và `statue.code`.

`post.status` hiện nhận `draft / review / published / archived`; chưa có `scheduled` và `hidden`.

## 5. Những gì đã được quyết định trước cho Admin

`tasks/plan.md` và `tasks/todo.md` (T27–T39, tất cả chưa làm) đã chốt các điểm sau, và chúng **khác với yêu cầu mới** ở nhiều chỗ:

| Chủ đề | Đã chốt trong `tasks/plan.md` | Yêu cầu mới |
|---|---|---|
| Đăng nhập | Không có trang `/login`. Cloudflare Access (mã một lần qua email) đứng cửa, máy chủ kiểm JWT của Access | Mật khẩu Argon2id/bcrypt, refresh token, danh sách phiên, 2FA TOTP, quên mật khẩu qua SMTP |
| Vai trò | 3 vai trò cố định: Super Admin, Ban Biên Tập, Điều Phối Viên (schema thêm `viewer`) | 4 vai trò mẫu + tạo vai trò mới, tick quyền theo hành động trên từng module |
| Trạng thái bài | Nháp / Đã xuất bản / Lưu trữ | Nháp → Chờ duyệt → Đã xuất bản / Hẹn giờ / Tạm ẩn |
| Xóa | "Xóa" nghĩa là lưu trữ, có khôi phục | Thùng rác với `deleted_at`, khôi phục và xóa vĩnh viễn |
| Lịch sử phiên bản | Không có | Snapshot mỗi lần lưu, xem diff, khôi phục |
| Ảnh | Trình duyệt nén WebP ≤2560px, tải thẳng lên R2; chặn xóa ảnh đang dùng | Thêm crop theo tỷ lệ, thay ảnh giữ nguyên ID, lọc ảnh không dùng |
| Menu | Ghi cứng trong `site.ts`, dự kiến chuyển vào bảng `setting` | Cây menu đa cấp kéo-thả, 3 kiểu icon |
| Nền tảng | Cùng ứng dụng vinext trên Cloudflare Workers, D1, R2, giao diện Bootstrap + SCSS, TipTap | "Đồng bộ theo stack có sẵn" (khớp) |
| Sao lưu | Cron xuất D1 sang R2, giữ 30 ngày | Xuất / sao lưu CSDL (khớp) |

Ràng buộc nền tảng ảnh hưởng thiết kế:

- **Workers gói Free: 10 ms CPU mỗi request.** Băm mật khẩu bằng Argon2id hoặc bcrypt vượt xa mức này. Đã có request bị `exceededCpu` trên bản thử (`tasks/plan.md`, câu hỏi mở số 8 về việc mua Workers Paid).
- **Gửi thư SMTP** làm được qua TCP socket của Workers ở cổng 465 hoặc 587; cổng 25 bị chặn.
- **Chuyển ảnh sang WebP và tạo thumbnail** không chạy được bằng `sharp` trong Worker; lựa chọn là nén ở trình duyệt hoặc dùng Cloudflare Images.
- D1 giới hạn 100 KB mỗi câu lệnh; script nhập liệu đang phải cắt nội dung lớn thành khúc 40 KB.

## 6. Khoảng cách giữa yêu cầu và hiện trạng

| Yêu cầu trong đề bài | Hiện trạng trên trang |
|---|---|
| Icon chỉ mục dạng SVG / thư viện icon | Icon là ảnh WebP 128px; chuyên mục con chưa có icon |
| Sidebar chuyên mục | Không có sidebar |
| Bảo tượng có "Ban biên tập", nhiều góc ảnh, chọn bảo tượng liên quan | Không có trường Ban biên tập; 1 ảnh mỗi tượng; liên quan được tính tự động |
| Sự kiện nhập ngày âm lịch | Ngày âm được tính từ ngày dương; lịch thường kỳ đọc từ câu chữ |
| Đồng hồ đếm ngược | Nhãn "Còn N ngày" |
| Lời Thầy dạy có nguồn kinh, sắp thứ tự, ngẫu nhiên | Là thơ của 12 chủ đề tháng, xoay theo tháng |
| Năm Phật lịch chỉnh trong Admin | Tính tự động; chỉ dòng bản quyền ghi cứng |
| Nhúng audio pháp âm | 15 bài Pháp Âm là bài viết; chưa xác định cách lưu tệp âm thanh |
| Mở đăng ký khóa tu | Chưa có form đăng ký công khai |
| Redirect 301 link cũ | Chưa có bảng chuyển hướng hoạt động |
