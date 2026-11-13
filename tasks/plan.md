# Kế hoạch triển khai: Dựng lại giao diện Tùng Lâm Hòa Phúc trên nền Bexon Home-02 × Design System TLHP

> Lập ngày 02/11/2026, sửa lần 2 cùng ngày · Danh sách task chi tiết: [todo.md](todo.md)
> Mã nguồn gốc: gói Bexon đã mua (`themeforest-QEdDqHKE-bexon-corporate-business-react-nextjs-template.zip`, trang mẫu [Home-02](https://bexon-react.vercel.app/home-02)) · Bộ nhận diện: [design-system/](../design-system/) v1.0.0

## Tổng quan

Lấy bản LTR của gói Bexon làm mã nguồn gốc của ứng dụng, chạy trên Cloudflare Workers (Worker `tlhp-web`). Giữ nguyên markup, lưới Bootstrap, SCSS, icon font, Swiper, glightbox và **toàn bộ hiệu ứng** của Bexon. Chỉ đổi màu, font và nội dung: màu và font đi qua một lớp cầu nối gán biến `--tj-*` của Bexon bằng token `--tlhp-*` (Mộc `#835414` · Hoại sắc `#D4A373` · Ngà `#FAFAF5`, Noto Serif + Be Vietnam Pro); nội dung là dữ liệu thật của chùa, giữ nguyên toàn bộ URL hiện có.

Lộ trình có 3 mốc:
1. **Xem thử** trên `v2.tunglamhoaphuc.com` (noindex).
2. **Ra mắt sớm** trên `www`: giao diện mới đọc trực tiếp dữ liệu JSON trên B2 mà admin cũ đang ghi; admin cũ chuyển sang `quantri.tunglamhoaphuc.com` sau Cloudflare Access.
3. **Chuyển hẳn**: dữ liệu sang D1, admin mới (Bootstrap cùng theme) thay admin cũ, bật đăng ký khóa tu và Hỏi AI.

## Quyết định của chủ dự án (02/11/2026)

| Chủ đề | Quyết định | Ảnh hưởng tới bảng khảo sát |
|---|---|---|
| Hướng làm | Dựng mới trong thư mục này; chưa có mã nguồn site cũ trên máy | – |
| Phạm vi | Site công khai + trang quản trị | – |
| Nền giao diện | Lấy gói Bexon làm gốc, giữ Bootstrap 5 + SCSS, chỉ đổi màu, font, nội dung | – |
| Hiệu ứng | **Giữ toàn bộ hiệu ứng Bexon**: hiện dần khi cuộn, cuộn mượt + parallax, slider tự chạy, nút lên đầu trang nổi, preloader, con trỏ hiệu ứng, số đếm chạy, chữ chạy ở footer | **Đảo ngược UX-01, UX-03** (đang "Đã chốt") và GD-02 (hero 1 khung). Cần cập nhật bảng khảo sát và BRAND-GUIDELINES mục 1.2, 5.6 |
| Menu | Giới thiệu ▾ (Lịch sử Bổn tự · Chư Tôn Đức · Thanh quy · Vũ Trụ Phật Giáo · Bảo Tượng Phật Giáo) · Tin tức – Pháp thoại ▾ (Dòng Chảy Hoằng Pháp · Tông Chỉ Tu Học · Trí Tuệ Phật Pháp) · Lịch tu học · Đăng ký khóa tu · Liên hệ | Chốt GD-01, ND-01 (phần menu) |
| Trang chủ | Ưu tiên nội dung chùa: Hero → Lối vào chuyên mục → Khóa tu sắp tới → Tin mới nhất → Lời chào → Tông Chỉ → Khu vực nổi bật → Lộ trình tu học → Lời Thầy dạy → Chư Tôn Đức | – |
| Khẩu hiệu hero | "Nơi để trở về" + dòng phụ "Chốn thiêng bình yên" | Chốt TH-06 |
| Soạn thảo admin mới | TipTap, lưu HTML đã làm sạch; nhập WordPress + Google Sheets một lần rồi bỏ đồng bộ | Chốt QT-03 |
| Ra mắt | Ra mắt sớm trên `www` sau khi xong site công khai; admin cũ ở `quantri.tunglamhoaphuc.com` sau Access | Ảnh hưởng HT-01 (được giải quyết luôn) |
| Tính năng mới | Đăng ký khóa tu, Hỏi AI, module Danh Tăng làm **sau** ra mắt sớm | – |
| Tên miền xem thử | `v2.tunglamhoaphuc.com` (Worker `tlhp-web` đã gắn sẵn, noindex) | – |

## Đầu vào sẵn có

| Tài liệu | Dùng cho |
|---|---|
| Gói Bexon (zip ở thư mục gốc) | Mã nguồn gốc của app |
| [design-system/tokens.css](../design-system/tokens.css) | Biến `--tlhp-*` (màu gốc, màu vai trò 3 chủ đề, cỡ chữ, khoảng cách), import thẳng vào app |
| [design-system/brand-tokens.json](../design-system/brand-tokens.json) | Token JSON cho ảnh OG, email, biểu đồ admin |
| [design-system/tailwind.config.js](../design-system/tailwind.config.js) | Không dùng trong app (app không có Tailwind); giữ làm tài liệu tham chiếu |
| [BRAND-GUIDELINES.md](../design-system/BRAND-GUIDELINES.md) | Bảng màu, kiểu chữ, đặc tả thành phần, ánh xạ số đo Bexon → TLHP (mục 1.3). Ví dụ code viết bằng lớp Tailwind, khi làm thì dịch sang SCSS |
| [dac-ta-ky-thuat-tunglamhoaphuc.md](../dac-ta-ky-thuat-tunglamhoaphuc.md) | Sitemap, cấu trúc JSON thực tế (mục 3.1b), mô hình D1 (mục 3.1), 10 module admin |
| [tunglamhoaphuc-cloudflare-migration.md](../tunglamhoaphuc-cloudflare-migration.md) | Kiến trúc đích Workers + R2 + D1 + Access |
| [khao-sat-yeu-cau-v2.csv](../khao-sat/khao-sat-yeu-cau-v2.csv) | Bản sao bảng khảo sát (bảng gốc trên Google Sheets là nguồn chuẩn) |

### Gói Bexon: giữ gì, bỏ gì

| Hạng mục | Trong gói | Xử lý |
|---|---|---|
| Khung | Next.js 16, React 19, App Router, JavaScript; 2 bản LTR + RTL | **Giữ** bản LTR. Component Bexon giữ `.js`; mã mới (dữ liệu, admin, xác thực) viết TypeScript (`allowJs`) |
| Giao diện | Bootstrap 5.3 + SCSS (biến `--tj-*` sinh từ `utilities/_colors.scss`, `_typography.scss`) | **Giữ**, đổi theme qua cầu nối biến; xóa partial của các home khác (h4–h11) và ecommerce |
| Icon | `bexon-icons`, Font Awesome Pro | **Giữ** |
| Hiệu ứng | `ClientWrapper`: GSAP smooth-scroller, parallax, stack/zoom/swipe, text reveal, magic cursor; wow.js + animate.css; odometer; preloader; `BackToTop` | **Giữ toàn bộ**, thêm công tắc tắt hết khi hệ điều hành bật "giảm chuyển động" |
| Slider | Swiper 11 (hero, logo, dự án, cảm nhận, blog), tự chạy | **Giữ tự chạy**, mỗi khung ≥ 7 giây, có nút tạm dừng, dừng khi di chuột hoặc focus (WCAG 2.2.2) |
| Header | Header nổi trên hero + header dính nhân đôi trượt xuống khi cuộn; hamburger offcanvas; popup tìm kiếm | **Giữ**; bản nhân đôi `inert` khi đang ẩn; offcanvas và popup tìm kiếm đóng bằng Esc, bẫy focus; popup tìm kiếm gửi sang `/tim-kiem` |
| Lightbox, biểu đồ | glightbox, chart.js | **Giữ** |
| Thông báo nổi | sweetalert2 (hộp thông báo sau khi gửi form) | **Bỏ**: phản hồi form hiện in-line (UX-05 vẫn giữ: không popup sau đăng ký) |
| Thư viện chỉ cho trang bỏ đi | isotope (lọc portfolio), react-range-slider-input (shop), nice-select2 (select tùy biến) | **Bỏ**; lọc danh sách xử lý phía server, ô chọn dùng `<select>` gốc theo kiểu Bexon |
| Font | Mona Sans, chỉ subset `latin` | **Thay** bằng Noto Serif (`--tj-ff-heading`) + Be Vietnam Pro (`--tj-ff-body`), subset `latin` + `vietnamese` |
| Dữ liệu mẫu | `public/fakedata/*.json` + `src/libs/get*.js` | **Thay** bằng `ContentRepository`; trang (server) lấy dữ liệu rồi truyền props |
| Trang | home-01…11, about, blogs, services, portfolios, team, contact, faq, shop, cart, checkout, careers, login… | **Giữ** home-02 (thành `/`) và khuôn trang trong cần dùng; **xóa** phần còn lại, kể cả `login` |

## Việc cần chuẩn bị (không phải code)

| # | Việc | Ai | Cần trước |
|---|---|---|---|
| 1 | Sao chép 13 file JSON trong thư mục `database/` của Ổ Z: (B2) vào `data/snapshot/`. Tạm thời (03/11) `npm run snapshot:fetch` lấy riêng file bài viết qua API danh sách công khai của site cũ, thiếu album của 447 bài | Chủ site | T4 (tạm), T8 |
| 2 | ~~Sao chép thư mục `09-icon-minh-hoa/` (logo Mộc Ấn, logo tròn, icon minh họa) vào `public/brand/`~~ – **xong 02/11**: bộ nhận diện gốc ở `bo-nhan-dien/` (logo, favicon, 20 icon chuyên mục, font UTM, bảng màu; không đưa vào git). Bản dùng cho web chép sang `public/brand/`: 2 logo, 6 favicon, 14 icon thu về 128px (112 KB). Font UTM không dùng (đã chốt Noto Serif + Be Vietnam Pro) | Chủ site | T5a |
| 3 | Node.js 20 LTS trở lên. Cloudflare **đã có**: tài khoản sở hữu zone (id `b91a395bd9b7ab86ef4cba41d1d828ae`), `cf` profile `tlhp`, Worker `tlhp-web` gắn `v2.tunglamhoaphuc.com`. Khi chạy lệnh đặt `CLOUDFLARE_ACCOUNT_ID` | Đội kỹ thuật | T1 |
| 4 | Xác định bucket B2 chứa 13 file JSON mà admin cũ đang ghi; tạo **khóa ứng dụng B2 chỉ đọc** cho đúng bucket đó | Chủ site | T19 |
| 5 | Quyền vào project Vercel của site cũ (gắn tên miền `quantri.`, bật Deployment Protection) | Chủ site | T21 |
| 5b | ~~Bật Cloudflare Zero Trust (Access)~~ – **đã bật 02/11**, nhóm `lingering-heart-cb52`, gói Free. Chi tiết ở [docs/van-hanh/admin-cu.md](../docs/van-hanh/admin-cu.md) | Chủ tài khoản | T21 |
| 7 | ~~Bucket R2 `tlhp-media` và tên miền `media.tunglamhoaphuc.com`~~ – **không cần nữa** (chủ dự án chọn ngày 04/11 xử lý ảnh bằng Cloudflare). Thay vào đó đã **bật Image Transformations cho zone ngày 04/11**: dashboard → Images → Transformations, gói Free (5.000 lần biến đổi khác nhau mỗi tháng, vượt không tính tiền), nguồn ảnh "This zone only". Theo dõi mức dùng ở trang Usage của mục đó | Chủ tài khoản | T41d |
| 6 | Cập nhật bảng khảo sát theo quyết định 02/11: UX-01, UX-03, GD-02 (giữ hiệu ứng), GD-01 (menu), TH-06 (khẩu hiệu), QT-03 (soạn thảo); báo Ban Trị Sự và Trưởng nhóm kỹ thuật | Chủ dự án | Checkpoint A |

## Quyết định kiến trúc

1. **Gói Bexon là mã nguồn gốc**, chạy trên Cloudflare Workers bằng **vinext** (Next.js API trên Vite, do Cloudflare duy trì, là cách Cloudflare khuyến nghị cho dự án Next.js mới), Worker `tlhp-web` trong tài khoản sở hữu zone, cấu hình bằng `cloudflare.config.ts` + lệnh `cf` (không dùng Wrangler/OpenNext). T1 (02/11/2026) đã chứng minh:
   - `vinext check` cho 95% tương thích, 0 lỗi.
   - Chỉ phải sửa cách import GSAP để chạy được trên Workers.
   - Worker 623 KB nén.
   Giới hạn cần nhớ: `next/image` của vinext chỉ tối ưu ảnh nằm trong app, không tối ưu ảnh ở B2/R2, nên ảnh nội dung đi qua Image Transformations của zone (quyết định 8); bộ đệm dữ liệu cho ISR dùng KV (T19 bật).
2. **Đổi theme qua cầu nối biến, không sửa từng component.** `layout.js` import `design-system/tokens.css` trước `globals.scss`. Partial mới `utilities/_tlhp-bridge.scss` (nạp cuối) gán biến Bexon bằng token vai trò TLHP, khai báo trên `:root, [data-theme], .tlhp-dark` để đổi chủ đề theo từng phần tử. Chỉ sửa SCSS ở chỗ Bexon viết cứng mã màu (18 chỗ teal, 157 mã màu, phần lớn ở partial sẽ xóa) hoặc giãn chữ âm (34 chỗ). Bảng ánh xạ chính:

   | Biến Bexon (giá trị gốc) | Vai trò trong Bexon | Gán bằng token TLHP |
   |---|---|---|
   | `--tj-color-grey-1` (`#ECF0F0`) | Nền trang | `--tlhp-bg` (Ngà `#FAFAF5`) |
   | `--tj-color-theme-bg` (`#D8E5E5`), `-bg-2` | Section xen kẽ | `--tlhp-bg-alt` (Kem `#F4ECDD`), `--tlhp-nen-do` |
   | `--tj-color-common-white` | Bề mặt thẻ, chữ trên nền tối | `--tlhp-nen-ngoc` (`#FFFEFA`) |
   | `--tj-color-theme-primary` (teal `#1E8A8A`) | Nút, nhấn, liên kết | `--tlhp-primary` (Mộc `#835414`) |
   | `--tj-color-theme-dark`, `-dark-2`, `-dark-3` | Section tối, footer | `--tlhp-moc-950`, `--tlhp-moc-900`, `--tlhp-moc-800` |
   | `--tj-color-heading-primary` | Tiêu đề | `--tlhp-heading` (`#2C1C11`) |
   | `--tj-color-text-body`, `-body-3` | Thân bài, chữ phụ | `--tlhp-fg` (`#35302B`), `--tlhp-muted` |
   | `--tj-color-text-body-2` | Chữ trên nền tối | `--tlhp-da-300` (`#C4BDAF`, 9.9:1 trên đen mun) |
   | `--tj-color-border-1`, `-border-2` | Viền thẻ sáng / tối | `--tlhp-border`, viền tối `#3D2C1F` |
   | `--tj-ff-heading`, `--tj-ff-body` | Mona Sans | Noto Serif, Be Vietnam Pro (`next/font`, subset `vietnamese`) |
   | `--tj-fs-h1…h6`, `--tj-fs-body` (74/48/32/24/20/18, 16px) | Cỡ chữ | Thang `--tlhp-text-*` (display 44→80 … body 17→18px), line-height tiêu đề ≥ 1.15 |

3. **Giữ hiệu ứng nhưng có công tắc.** Mọi hiệu ứng trong `ClientWrapper`, wow.js, autoplay Swiper, preloader, magic cursor, odometer, chữ chạy tắt khi `prefers-reduced-motion: reduce`; magic cursor tắt trên thiết bị cảm ứng. Cuộn mượt không được làm hỏng cuộn bằng bàn phím, liên kết neo và tìm trong trang. Vẫn cấm: toast/hộp thông báo nổi, hộp thoại tự bật khi tải trang (kể cả popup chào mừng của site cũ), banner cookie nổi, bong bóng chat nổi.
4. **Kho mã phải riêng tư** (chứa mã Bexon và Font Awesome Pro theo giấy phép ThemeForest). File zip và bản gốc chưa sửa (`reference/bexon/`) nằm trong `.gitignore`.
5. **Lớp nội dung có "đường nối".** Trang (server component) gọi `ContentRepository` rồi truyền props cho section Bexon. Ba nguồn cài đặt cùng một interface, đổi bằng biến `CONTENT_SOURCE`:
   - `snapshot`: đọc file trong `data/snapshot/` (phát triển, test);
   - `b2`: đọc trực tiếp 13 file JSON trên B2 bằng khóa chỉ đọc, làm mới theo ISR 5 phút (ra mắt sớm);
   - `d1`: D1 + Drizzle (chuyển hẳn).
   Cả ba dùng chung bộ chuẩn hóa (zod, ngày, URL ảnh, Markdown/HTML → HTML đã làm sạch); script nhập D1 cũng dùng bộ này.
6. **Giữ nguyên URL công khai** (`/dong-chay-hoang-phap/{slug}`, `/bao-tuong/{slug}_{mã}`…). Chỉ redirect 301 URL WordPress cũ (ở bước chuyển hẳn).
7. **Danh sách lọc, sắp xếp, phân trang phía server** qua query string (12 bài/trang công khai, 20 dòng/trang admin), thay cho tải 472 thẻ một lần.
8. **Ảnh đi qua `mediaUrl()` và `imageAt()`, thu nhỏ bằng Image Transformations của zone** (chốt 04/11, chủ dự án chọn xử lý bằng Cloudflare, không cần R2 hay tên miền `media.`; thay cho phương án bản thu nhỏ tạo sẵn trên R2 chốt cùng ngày).
   - `imageAt(src, width)` trả `/cdn-cgi/image/width=…,quality=75,format=auto,onerror=redirect/<nguồn>`; trình duyệt nhận AVIF hoặc WebP.
   - Ba cỡ, ít có chủ đích vì mỗi cỡ của mỗi ảnh tính một lần vào hạn mức: 640 (thẻ, ảnh nhỏ), 1280 (ảnh bìa, chân dung), 1920 (khung hero, lightbox).
   - Zone chỉ nhận ảnh nguồn của chính nó ("This zone only"), nên người ngoài không dùng được hạn mức. Ảnh WordPress (`admin.`) đã ở trong zone; ảnh B2 đi qua `/anh-goc/<bucket>/<key>` của site (chỉ hai bucket của admin cũ, bộ đệm 7 ngày).
   - Vượt 5.000 lần biến đổi trong tháng: ảnh đã biến đổi vẫn phục vụ từ bộ đệm; ảnh mới chuyển về ảnh gốc nhờ `onerror=redirect` (chỉ chạy khi nguồn cùng tên miền, nên B2 phải qua `/anh-goc/`).
   - Album chỉ biến đổi ảnh WordPress (`albumImageAt`), vì ảnh B2 trong album đã nhỏ (trung vị 92 KB) và album lớn sẽ tiêu hạn mức.
   - Ảnh đã biến đổi vẫn tải ưu tiên thấp, không preload: quá hạn mức thì nó là ảnh gốc 7–9 MB.
   - Cục bộ (`dev`, `preview`) không có `/cdn-cgi/image`; route `/cdn-cgi/image/` trong app chuyển về ảnh gốc. Trên Cloudflare, edge trả lời trước nên route không chạy.
   - Ảnh mới ở admin mới (T30) chỉ cần một bản ≤ 2560px; `imageAt()` lo các cỡ, miễn nguồn nằm trong zone.
9. **Chế độ đọc đặt `data-theme` trên khung đọc**, không đặt trên `<html>`, để Giấy dó / Đêm thiền chỉ đổi phần bài đọc.
10. **Trong thời gian chuyển tiếp, admin cũ là nơi soạn duy nhất.** Site mới chỉ đọc B2, không bao giờ ghi vào file JSON của admin cũ. Lượt xem mới ghi vào bảng `PageView` trong D1 (từ T25); số hiển thị = số cũ trong JSON + số mới trong D1.
11. **Admin mới dùng cùng Bootstrap + cầu nối theme**, thêm `components/_admin.scss`. Không có trang `/login`: Cloudflare Access chặn ở cửa, middleware và mọi server action tự kiểm JWT Access phía server. Phân quyền 3 vai trò theo QT-05 (Super Admin · Ban Biên Tập · Điều Phối Viên) lưu trong D1; mọi thao tác ghi tạo `AuditLog`; xóa = chuyển Lưu trữ có xác nhận và khôi phục. Trang sửa riêng thay modal khổng lồ; phản hồi lưu hiện in-line, không toast.
12. **Soạn thảo:** TipTap, lưu HTML đã làm sạch. Không dựng "Đồng bộ từ WordPress" và "Nhập từ Google Sheets".
13. **Kiểm thử:** Vitest (chuẩn hóa dữ liệu, âm lịch, validate form, repository), Playwright + axe (luồng chính, tiếp cận, bàn phím), **test canh gác hiệu ứng & thông báo** (mọi hiệu ứng tắt khi giảm chuyển động, slider tự chạy có nút dừng, không toast, không hộp thoại tự bật) chạy trên mọi trang, Lighthouse trên `v2.`.

## Ánh xạ Bexon Home-02 → trang chủ TLHP

Thứ tự theo quyết định "ưu tiên nội dung chùa". Thứ tự khai báo bằng một mảng trong trang chủ, đổi được không cần sửa component.

| Thứ tự | Component Bexon | Khối TLHP | Hiệu ứng giữ lại | Dữ liệu | Task |
|---|---|---|---|---|---|
| – | `layout/header/Header` (×2) | Header nổi trên hero + header dính khi cuộn; menu 5 mục + 2 menu thả; nút Gọi điện, Chỉ đường, "Đăng ký khóa tu" | Header dính trượt xuống, popup tìm kiếm, offcanvas | Cấu hình site | T5a, T5b |
| 1 | `sections/hero/Hero2` | Hero 3 khung: (1) "Nơi để trở về" / "Chốn thiêng bình yên" · (2) khóa tu kế tiếp + "Còn N ngày" · (3) pháp sự mới nhất | Slider tự chạy ≥ 7 giây, có nút dừng | Bài viết, lịch | T10, T12 |
| 2 | `sections/brands/Brands2` | Dải 6 lối vào chuyên mục (icon minh họa) | Trượt tự chạy, dừng khi di chuột/focus | Tĩnh | T10 |
| 3 | `sections/pricing-plan/PricingPlan` | Khóa tu sắp tới: 3 chương trình tiêu biểu | Hiện dần khi cuộn | Lịch (featuredPrograms) | T12 |
| 4 | `sections/blogs/Blogs2` | Tin mới nhất + Dấu ấn hoằng pháp (tab) | Slider tự chạy | Bài viết | T10 |
| 5 | `sections/about/About2` | Lời chào Bổn tự + số liệu (bài viết, tôn tượng, khu vực, Phật lịch 2570) | Số đếm chạy (odometer), parallax ảnh | Giới thiệu | T13b |
| 6 | `sections/services/Services2` | Tông Chỉ Tu Học: 5 nhóm trên nền đen mun | Thẻ xếp chồng khi cuộn, tiêu đề dính | Tông chỉ | T14 |
| 7 | `sections/portfolios/Portfolios2` | Khu vực nổi bật (Vũ Trụ Phật Giáo) | Slider tự chạy | Vũ trụ | T15 |
| 8 | `sections/process/Process` | Lộ trình tu học: Người mới · Người trẻ · Người bận rộn · Người chuyên tu | Hiện dần khi cuộn | Tông chỉ | T14 |
| 9 | `sections/testimonials/Testimonials2` | Lời Thầy dạy: các câu kệ chủ đề tháng, chữ `scripture` | Slider tự chạy | Lịch (monthThemes, quoteGallery) | T12 |
| 10 | `sections/teams/Team1` | Chư Tôn Đức: 4 thẻ chân dung 3:4 | Hiện dần khi cuộn | Giới thiệu | T13b |
| – | `sections/cta/Cta` | Khối kết trang: "Xem lịch tu học"; sau T40 thành "Hỏi AI Hòa Phúc" | Hiện dần khi cuộn | Tĩnh / Dify | T6, T40 |
| – | `layout/footer/Footer2` | Footer đen mun 4 cột, chữ chạy "Nơi để trở về – Chốn thiêng bình yên" | Chữ chạy ngang | Cấu hình site | T6 |
| – | `BackToTop`, preloader, magic cursor | Giữ, đổi màu theo theme | – | – | T2, T6 |

## Sơ đồ route

**Site công khai** (giữ slug cũ, thêm trang mới đánh dấu ★)

| Route | Khuôn Bexon | Task | Có từ |
|---|---|---|---|
| `/` | `home-02` | T10, T12, T13b, T14, T15 | Ra mắt sớm |
| `/gioi-thieu`, `/gioi-thieu/[slug]` | `team`, `TeamDetails1` | T13a | Ra mắt sớm |
| `/tong-chi-tu-hoc`, `/tong-chi-tu-hoc/[slug]` | `Services2`, `ServiceDetailsMain` | T14 | Ra mắt sớm |
| `/dong-chay-hoang-phap`, `/dong-chay-hoang-phap/[slug]` | `BlogMain`, `BlogDetailsMain` | T7–T9 | Ra mắt sớm |
| `/vu-tru-phat-giao`, `/vu-tru-phat-giao/[slug]` | `Portfolios2`, `PortfolioDetailsMain` | T15 | Ra mắt sớm |
| `/bao-tuong-phat-giao`, `/bao-tuong/[slug]_[mã]` | `TeamCard`, `TeamDetails1` | T16 | Ra mắt sớm |
| `/tri-tue-phat-phap`, `/tri-tue-phat-phap/[slug]` | `BlogMain`, `BlogDetailsMain` | T17 | Ra mắt sớm |
| ★ `/lich-tu-hoc` | `PricingPlan` + lưới tháng tự dựng | T11 | Ra mắt sớm |
| ★ `/lien-he`, ★ `/tim-kiem` | `ContactTop`, `Contact3`, popup tìm kiếm | T18 | Ra mắt sớm |
| `/sitemap.xml`, `/robots.txt`, trang 404 | `ErrorPrimary` | T20, T6 | Ra mắt sớm |
| `/admin/*`, `/login` | – | T22 | Chuyển hướng sang `quantri.` |
| ★ `/dang-ky`, ★ `/dang-ky/thanh-cong` | `Contact3` (form) | T26 | Chuyển hẳn |

Trước khi có `/dang-ky`, mục menu và nút "Đăng ký khóa tu" dẫn tới `/lich-tu-hoc#khoa-tu` (thông tin liên hệ đăng ký).

**Trang quản trị mới** (có từ bước chuyển hẳn; Cloudflare Access chặn ở cửa)

| Route | Module | Task |
|---|---|---|
| `/admin` | Tổng quan | T28 |
| `/admin/posts` | Dòng Chảy Hoằng Pháp | T29, T31 |
| `/admin/thu-vien-anh` | Thư viện ảnh R2 (thay Kho Ảnh S3) | T30 |
| `/admin/lich-tu-hoc` | Lịch tu học & sự kiện | T32 |
| `/admin/dang-ky` ★ | Đăng ký khóa tu | T33 |
| `/admin/tong-chi`, `/admin/tri-tue-phat-phap` | Tông Chỉ, Trí Tuệ | T34 |
| `/admin/gioi-thieu`, `/admin/danh-tang` | Giới thiệu, Danh Tăng & Tổ Sư | T35 |
| `/admin/vu-tru-phat-giao` | Vũ Trụ Phật Giáo | T36 |
| `/admin/bao-tuong` | Bảo Tượng | T37 |
| `/admin/cau-hinh`, `/admin/tai-khoan`, `/admin/nhat-ky` ★ | Cấu hình, tài khoản, nhật ký | T38 |

## Đồ thị phụ thuộc

```
gói Bexon (zip) + design-system/tokens.css          T21 Admin cũ → quantri. + Access (HT-01)
  └─ T1 Chạy nguyên trạng Bexon trên Workers (v2)        (hạ tầng, làm ngay được)
       ├─ T1b Kho GitHub + CI (khi có kho)
       ├─ T2 Gỡ thừa + công tắc giảm chuyển động
       │    └─ T3a Cầu nối màu/font ─ T3b Quét màu, chữ Việt, styleguide
       │         └─ T5a Header/menu ─ T5b Tìm kiếm, dải thông báo ─ T6 Footer/Cta/404
       │                          ══ Checkpoint A: duyệt giao diện trên v2 ══
       └──── T4 Lớp nội dung (snapshot), song song T2–T6
                 └─ T7 Danh sách Dòng Chảy (cần T6)
                      ├─ T8 Chi tiết bài ─ T9 Video/album
                      ├─ T10 Trang chủ: hero, lối vào, tin mới
                      │     ══ Checkpoint B: lát cắt đầu-cuối ══
                      ├─ T11 Lịch ─ T12 Khóa tu sắp tới, Lời Thầy dạy, đếm ngày
                      ├─ T13a Giới thiệu ─ T13b Lời chào, Chư Tôn Đức · T14 Tông Chỉ   ══ Checkpoint C ══
                      ├─ T15 Vũ Trụ ─ T19a Nạp dữ liệu theo trang · T41c Ảnh sửa nhanh ─ T16 Bảo Tượng
                      ├─ T17 Trí Tuệ
                      └─ T18 Liên hệ + tìm kiếm
                            ══ Checkpoint D: site công khai đủ trên v2 ══
          ┌─────────────────────┴──────────────────────┐
  RA MẮT SỚM                                     DỮ LIỆU D1 (song song)
  T19 Nguồn dữ liệu B2 trực tiếp                 T23 Schema D1 + nhập
  T20 SEO trước ra mắt                            └─ T24 Repository D1 (chỉ v2)
  T41d Ảnh qua Image Transformations (đã xong)          ├─ T25 Lượt xem theo ngày (bật luôn trên www)
  T21 (đã xong) ─┐                                     └─ T26 Đăng ký khóa tu (bật ở T39)
  T41f Font, hiệu ứng khởi động sau ─ T41a Gọn CSS, bớt hydrate
  T41e Cache HTML/RSC ở edge (cần T19)
  T22 Kiểm thử + chuyển www ◄─┘ (cần T19, T20, T41d, T41f, T41a, T41e)
  ══ Checkpoint E: ra mắt www ══                  ══ Checkpoint F ══
                                                        └─ ADMIN MỚI
                                                           T27a Access + RBAC + nhật ký ─ T27b Khung giao diện
                                                           ├─ T28 Tổng quan
                                                           ├─ T29 Bảng dùng chung ─ T30 Ảnh R2 ─ T31 Sửa bài
                                                           │     ══ Checkpoint G ══
                                                           ├─ T32 Lịch · T33 Đăng ký · T34 Tông Chỉ+Trí Tuệ
                                                           ├─ T35 Giới thiệu+Danh Tăng   ══ Checkpoint H ══
                                                           ├─ T36 Vũ Trụ ─ T37 Bảo Tượng
                                                           └─ T38 Cấu hình · T38b Sao lưu D1   ══ Checkpoint I ══
CHUYỂN HẲN: T39 Đóng băng admin cũ → nhập lần cuối → www đọc D1 → admin mới (cần E + I)
            T40 Hỏi AI (cần thông tin Dify)
            T41b Đo toàn site, ngân sách (cần T41a, T41f)   ══ Checkpoint J ══
```

## Danh sách task

Chi tiết từng task (mô tả, file Bexon liên quan, tiêu chí nghiệm thu, cách kiểm chứng, file dự kiến, quy mô) nằm trong [todo.md](todo.md). Task có hậu tố a/b được tách từ một task lớn để mỗi phần ≤ 5 file. Tổng cộng 53 task, 10 checkpoint.

### Giai đoạn 1 – Nền móng
- [x] T1: Chạy nguyên trạng Bexon trên Cloudflare Workers (`v2.`)
- [ ] T1b: Kho mã GitHub riêng tư và CI
- [x] T2: Gỡ trang, thư viện thừa và thêm công tắc giảm chuyển động
- [x] T3a: Cầu nối theme TLHP: màu, font, cỡ chữ
- [x] T3b: Quét màu viết cứng, chỉnh chữ tiếng Việt và trang styleguide
- [x] T4: Lớp nội dung: snapshot JSON → repository (lát Dòng Chảy)
- [x] T5a: Header và menu
- [x] T5b: Popup tìm kiếm và dải thông báo
- [x] T6: Footer, khối kết trang, nút lên đầu trang và trang 404
- [ ] **Checkpoint A** – duyệt giao diện nền trên `v2.` với Ban Truyền Thông

### Giai đoạn 2 – Site công khai (đọc snapshot)
- [x] T7: Dòng Chảy Hoằng Pháp – trang danh sách
- [x] T8: Trang chi tiết bài viết và chế độ đọc
- [x] T9: Video, album ảnh, lightbox
- [x] T10: Trang chủ – hero, lối vào chuyên mục, tin mới nhất
- [ ] **Checkpoint B** – lát cắt đầu-cuối
- [x] T11: Lịch tu học – dữ liệu, âm lịch, trang `/lich-tu-hoc`
- [x] T12: Trang chủ – khóa tu sắp tới, Lời Thầy dạy và đếm ngày trên hero
- [x] T13a: Giới thiệu – trang chủ đề
- [x] T13b: Trang chủ – Lời chào và Chư Tôn Đức
- [x] T14: Tông Chỉ Tu Học
- [ ] **Checkpoint C** – trang chủ đủ khối chính
- [x] T15: Vũ Trụ Phật Giáo – bản đồ 2D và trang khu vực
- [x] T19a: Mỗi trang chỉ nạp dữ liệu nó cần (phần nạp theo nhu cầu của T19, làm trước T16 ngày 04/11)
- [x] T41c: Ảnh – sửa nhanh trong code (phần ảnh của T41, làm trước T16; chốt 04/11 sau review tốc độ)
- [x] T16: Bảo Tượng Phật Giáo (làm song song với T41c ngày 04/11 trên hai nhánh, gộp sau; ảnh tượng theo quy tắc của T41c)
- [ ] T17: Trí Tuệ Phật Pháp
- [ ] T18: Liên hệ và tìm kiếm từ khóa
- [ ] **Checkpoint D** – site công khai hoàn chỉnh trên `v2.`

### Giai đoạn 3 – Ra mắt sớm trên www
- [ ] T19: Đọc dữ liệu trực tiếp từ B2
- [ ] T20: SEO trước ra mắt
- [ ] T21: Đưa admin cũ sang `quantri.tunglamhoaphuc.com` sau Cloudflare Access (làm được ngay, giải quyết HT-01)
- [x] T41d: Ảnh nội dung qua Image Transformations của Cloudflare (điều kiện của T22; đổi từ bản thu nhỏ trên R2, xong 04/11)
- [x] T41f: Font, icon font, hiệu ứng khởi động sau và ảnh tĩnh (đợt 1 tối ưu hiệu suất, thêm 04/11; điều kiện của T22; xong 04/11)
- [x] T41a: Gọn CSS, icon font và bớt phần phải hydrate (đợt 2; kéo lên từ giai đoạn 6 ngày 04/11, điều kiện của T22; xong 05/11, còn 2 tiêu chí chuyển sang T41e)
- [x] T41e: Cache HTML và RSC ở edge (đợt 3, điều kiện của T22; phần cache xong 05/11, TTFB p75 86–105 ms; còn "Làm mới site" chờ T19, trang có tham số truy vấn, HTML ≤ 120 KB, kiểm chi phí yêu cầu trên gói Free)
- [ ] T22: Kiểm thử trước ra mắt và chuyển `www`
- [ ] **Checkpoint E** – ra mắt `www`, theo dõi 48 giờ

### Giai đoạn 4 – Dữ liệu D1 (song song với giai đoạn 3)
- [ ] T23: Schema D1 và script nhập
- [ ] T24: Repository D1 và contract test
- [ ] T25: Đếm lượt xem theo ngày
- [ ] T26: Đăng ký khóa tu (công khai)
- [ ] **Checkpoint F** – dữ liệu khớp, đăng ký chạy đầu-cuối trên `v2.`

### Giai đoạn 5 – Trang quản trị mới
- [ ] T27a: Xác thực Access, phân quyền, nhật ký
- [ ] T27b: Khung giao diện admin
- [ ] T28: Admin – Tổng quan
- [ ] T29: Bảng quản trị dùng chung và danh sách Dòng Chảy
- [ ] T30: Admin – Thư viện ảnh R2
- [ ] T31: Admin – Trang sửa bài và trình soạn thảo
- [ ] **Checkpoint G** – admin lõi, review bảo mật
- [ ] T32: Admin – Lịch tu học và sự kiện
- [ ] T33: Admin – Đăng ký khóa tu
- [ ] T34: Admin – Tông Chỉ và Trí Tuệ
- [ ] T35: Admin – Giới thiệu và Danh Tăng
- [ ] **Checkpoint H** – nội dung chính quản trị được trên `v2.`
- [ ] T36: Admin – Vũ Trụ Phật Giáo
- [ ] T37: Admin – Bảo Tượng
- [ ] T38: Admin – Cấu hình, tài khoản, nhật ký
- [ ] T38b: Sao lưu D1 và diễn tập khôi phục
- [ ] **Checkpoint I** – admin hoàn chỉnh, sao lưu chạy, Ban Biên Tập dùng thử trên `v2.`

### Giai đoạn 6 – Chuyển hẳn và hoàn thiện
- [ ] T39: Chuyển hẳn sang D1 và admin mới
- [ ] T40: Khối "Hỏi AI Hòa Phúc"
- [x] T41b: Đo toàn site, ngân sách ảnh và Lighthouse CI (xong 13/11; LCP 3,9–5,2 s, chưa đạt mục tiêu < 2,0 s, chờ chủ dự án quyết)
- [ ] **Checkpoint J** – hoàn tất, tắt admin cũ và WordPress theo kế hoạch Cloudflare

## Làm song song

- **Làm ngay, không phụ thuộc code:** T21 (đưa admin cũ sau Access). T1b làm ngay khi có kho GitHub.
- **Phải tuần tự:** T1 → T2 → T3a → T3b → T5a → T5b → T6; T23 → T24; T27a → T27b trước mọi module admin; T29 → T30 → T31.
- **Song song được:** T4 với T2–T6.
- **Sau Checkpoint B:** T11, T13a, T14, T15, T17 song song. Điểm chạm chung là mảng khối của trang chủ và `_tlhp-bridge.scss`: mỗi task chỉ thêm dòng của mình.
- **Ảnh:** T41c và T41d đã xong ngày 04/11. Còn chân dung, tác phẩm ở trang tượng và ảnh chèn trong thân bài (ghi ở T41d).
- **Sau Checkpoint D:** giai đoạn 3 (ra mắt) và giai đoạn 4 (D1) chạy song song.
- **Sau Checkpoint G:** T32, T33, T34, T36, T38, T38b song song; T35 chờ T34 (dùng chung trường lặp), T37 chờ T36.
- **Hiệu suất:** T41f làm ngay, rồi T41a (đo riêng từng đợt); T41e sau T19. Cả ba trước T22. Không đổi giao diện, giữ hiệu ứng.
- **T40** làm được bất cứ lúc nào sau khi có thông tin Dify; theo quyết định thì xếp sau ra mắt.

## Rủi ro và cách xử lý

| Rủi ro | Mức | Cách xử lý |
|---|---|---|
| Phạm vi lớn (48 task, 3 mốc ra mắt) | Cao | Mỗi mốc dùng được độc lập; mỗi checkpoint có người duyệt; góp ý ghi thành task mới |
| Admin cũ còn lỗ hổng `/login` (HT-01) trong suốt thời gian chuyển tiếp | Cao | T21 làm ngay: Access cho `quantri.` và cho `/admin`, `/api/admin`, `/login` trên `www`; bật Vercel Deployment Protection cho địa chỉ `*.vercel.app` |
| Giữ hiệu ứng làm khó người lớn tuổi, trình đọc màn hình, người dùng bàn phím | Cao | Công tắc giảm chuyển động (T2); slider có nút dừng; kiểm cuộn bàn phím, liên kết neo, tìm trong trang khi bật cuộn mượt; test canh gác chạy mọi trang |
| Đảo ngược UX-01, UX-03 đang "Đã chốt" | TB | Chuẩn bị #6: cập nhật bảng khảo sát, báo Ban Trị Sự; T3b sửa BRAND-GUIDELINES mục 1.2, 5.6 cho khớp |
| Preloader + GSAP + CSS nặng làm trượt mục tiêu LCP < 2,0 s (UX-03) | TB | Đo mốc ở Checkpoint B; preloader ẩn ngay khi có nội dung đầu tiên; nếu vẫn trượt, chủ dự án chọn giữa preloader và mục tiêu LCP (Câu hỏi mở #6); T41a cắt Bootstrap và icon font |
| Điểm hiệu suất trên điện thoại thấp khi ra mắt `www` (PageSpeed 44 ngày 04/11: LCP 7,4 s, TBT 1.380 ms), ảnh hưởng Core Web Vitals và thứ hạng tìm kiếm | **Cao** | Ba đợt trước T22: T41f (xong 04/11: font 722 → 201 KB, hiệu ứng khởi động từng bước; Lighthouse trang chủ 53–70 → 71–74), T41a (xong 05/11: CSS 141 → 50 KB br, JS ban đầu 235 → 175 KB br, giao diện không đổi), T41e (cache HTML ở edge). Mục tiêu PageSpeed điện thoại ≥ 80, LCP < 2,5 s, TBT < 300 ms. Không thêm tag quảng cáo, đo lường bên thứ ba (nguồn TBT của divineshop.vn) |
| Ảnh gốc máy ảnh (6048 px, 7–9 MB) được đưa thẳng cho khách. Đo 04/11 trên `v2.` (điện thoại 4G): LCP trang bài 47,9 s, trang danh sách 11,9 s, trang chủ 8,4 s. Admin cũ không nén ảnh, nên bài mới nào cũng thêm ảnh nặng | TB (đã giảm từ Cao) | T41c và T41d đã xong 04/11: ảnh qua Image Transformations, trang bài còn 186 KB ảnh, LCP 4,6 s. Còn lại: quá 5.000 lần biến đổi mỗi tháng thì ảnh mới về ảnh gốc (theo dõi trang Usage; nếu thường xuyên vượt thì chủ tài khoản cân nhắc gói Images trả phí, 0,5 USD mỗi 1.000 lần); trang tượng và ảnh trong thân bài chưa đổi; T41b đặt ngân sách ảnh trong Lighthouse CI |
| Đọc JSON trên B2 đúng lúc admin cũ đang ghi đè file | TB | Parse lỗi thì giữ bản trang cũ (ISR không thay); log lỗi; nút "Làm mới site" ở `/van-hanh/lam-moi` |
| ISR cần bộ đệm dữ liệu (vinext dùng KV); tải lại ~12 MB JSON cho mỗi trang sẽ chậm | TB | T19 bật bộ đệm KV; mỗi file JSON tải 1 lần mỗi chu kỳ theo `ETag` |
| Hiệu ứng tách chữ (SplitText) làm trình đọc màn hình đọc từng ký tự, hoặc lệch dấu tiếng Việt | TB | T3b giữ `aria-label` nguyên câu, kiểm dòng "Ẫ Ộ Ữ Ỹ" khi hiệu ứng đang chạy |
| Chưa có sao lưu khi D1 thành nguồn chính | TB | T38b sao lưu hằng ngày + diễn tập khôi phục, là điều kiện của Checkpoint I trước khi chuyển hẳn |
| Từ ngày ra mắt tới T40 site không có khối Hỏi AI (site cũ đang có) | TB | Báo trước Ban Trị Sự; nếu có sớm thông tin Dify thì kéo T40 lên trước T22 |
| Chuyển `www` gặp sự cố | TB | Diễn tập quay lại trên `v2.`; ghi sẵn các bước trả `www` về Vercel (≤ 15 phút) |
| Hai nguồn dữ liệu lệch nhau lúc chuyển hẳn (admin cũ vẫn ghi JSON sau khi nhập D1) | TB | T39 đóng băng admin cũ trước, nhập lần cuối, rồi mới chuyển nguồn |
| Màu viết cứng trong SCSS; chữ tiếng Việt chạm dòng do giãn chữ âm | TB | T3b quét và thay; styleguide có dòng "Ẫ Ộ Ữ Ỹ" ở mọi cấp tiêu đề; test không còn màu teal |
| Snapshot JSON khác cấu trúc ghi trong đặc tả 3.1b | TB | Schema zod khoan dung, báo cáo `snapshot:check`; phát hiện ngay ở T4 |
| Tài khoản đang ở gói Workers **Free** (10 ms CPU mỗi lượt). Đo trên `v2.` ngày 03/11: trang Bexon trung vị 14 ms, p90 126 ms; lần đầu đọc snapshot bài viết 154–557 ms. Cloudflare vẫn trả "ok" nhưng có thể báo lỗi 1102 khi lượt truy cập tăng | **Cao** | Câu hỏi mở #8: bật Workers Paid (5 USD/tháng, 30 s CPU) trước khi ra mắt `www`; T19 dù sao cũng chuẩn hóa sẵn dữ liệu (theo lịch hoặc khi làm mới) để mỗi lượt chỉ đọc phần cần |
| API danh sách của admin cũ để trống album của 447 bài (`galleryCount` > 0, `photoGallery` rỗng); chỉ API chi tiết từng bài có ảnh | TB | Chuẩn bị #1: xem file gốc trên B2 có đủ album không; nếu không, T8/T19 phải tìm nguồn album (file khác trên B2 hay WordPress) |
| vinext chưa phủ 100% Next.js; thư viện chạy việc lúc nạp module (như GSAP) bị Workers chặn; kích thước Worker khi thêm TipTap | TB | T1 đã chạy thật trên `v2.` (95% tương thích, sửa GSAP); mỗi task chạy e2e trên bản build workerd; đo bundle ở Checkpoint G; tách code admin |
| Âm lịch tính sai | TB | Thuật toán Hồ Ngọc Đức (múi giờ +7), bộ test ngày lễ đã biết 2025–2027 |
| Trộn JavaScript (Bexon) và TypeScript (mã mới) | Thấp | File Bexon giữ `.js`, file mới `.ts/.tsx`; `allowJs` |
| Giấy phép Bexon và Font Awesome Pro | Thấp | Kho mã riêng tư; xác nhận loại giấy phép (Regular đủ cho một website không bán cho người dùng cuối) |
| Lỗi dữ liệu có sẵn (soft 404, `su-phu-tru-tri` sai nội dung, 12 vs 14 khu vực, ngày đăng trùng) | Thấp | Báo cáo snapshot liệt kê để Ban Biên Tập sửa trong admin cũ (giai đoạn chuyển tiếp) hoặc admin mới |

## Câu hỏi mở

1. **Logo SVG (TH-02) và font nội dung (TH-03):** kế hoạch dùng tạm logo WebP và Be Vietnam Pro; đổi font chỉ sửa 1 dòng trong `layout.js`.
2. **Bucket B2 nào chứa 13 file JSON** admin cũ đang ghi (`tunglamhoaphuc2` hay `media-tunglamhoaphuc`), và hai bucket có đồng bộ với nhau không (T19 cần).
3. **Ai giữ quyền project Vercel** của site cũ (T21 cần).
4. **Trợ lý AI (ND-03):** tiếp tục Dify? Cần URL API, khóa, người quản lý nguồn tri thức (T40 cần).
5. **Danh Tăng & Tổ Sư (91 vị):** có công khai trên site không? Kế hoạch hiện chỉ dựng module admin (T35).
6. **Preloader và LCP:** nếu đo ở Checkpoint B thấy preloader làm trượt mục tiêu LCP < 2,0 s, ưu tiên giữ preloader hay giữ mục tiêu?
7. **Kho mã GitHub riêng tư (HT-02):** tạo bằng tài khoản của chùa khi nào? (T1b cần)
8. **Gói Workers:** bật Workers Paid (5 USD/tháng) cho tài khoản sở hữu zone trước khi ra mắt `www`? Gói Free cho 10 ms CPU mỗi lượt, trang hiện đã vượt (xem bảng rủi ro). Chủ tài khoản quyết và tự bật; T19 cần biết trước khi chọn cách nạp dữ liệu.

## Định nghĩa "Hoàn thành" cho mọi task

- Đạt đủ tiêu chí nghiệm thu của task, đã chạy thử thật (không chỉ biên dịch).
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build` đều xanh; không phá test cũ.
- Test canh gác hiệu ứng & thông báo và axe xanh cho mọi trang mới; hiệu ứng mới thêm vào đều tắt được khi giảm chuyển động.
- Màu chỉ đi qua biến `--tj-*` đã cầu nối hoặc `--tlhp-*`; không thêm mã màu viết cứng vào SCSS.
- Section Bexon được dùng không còn tự đọc `fakedata`.
- Chữ tối thiểu 14px, đoạn văn tối thiểu 16px, vùng chạm ≥ 48px, giọng văn kính ngữ theo BRAND-GUIDELINES mục 5.5.
- Thay đổi đúng phạm vi task; quyết định đáng nhớ ghi vào file này.

## Lịch sử sửa kế hoạch (02/11/2026)

| Lần | Thay đổi |
|---|---|
| 1 | Bản đầu: dựng mới, chuyển mã Bexon sang TypeScript + Tailwind, bỏ hiệu ứng |
| 2 | Giữ Bootstrap/SCSS của Bexon, đổi theme qua cầu nối biến `--tj-*` → `--tlhp-*`; xem thử trên `v2.` |
| 9 | 04/11, sau báo cáo PageSpeed điện thoại 44 điểm và đo đối chiếu với divineshop.vn (Lighthouse 13.6): thêm T41f (font, icon font, hiệu ứng khởi động sau, ảnh tĩnh); kéo T41a lên giai đoạn 3 và thêm phần bớt hydrate, CSS màn hình đầu; font chuyển từ T41b sang T41f; T22 cần thêm T41f, T41a; thêm rủi ro điểm hiệu suất |
| 8 | 04/11, chủ dự án chọn xử lý ảnh bằng Cloudflare, không phụ thuộc bucket R2 `tlhp-media` và tên miền `media.`: T41d đổi sang Image Transformations của zone (đã bật, nguồn "This zone only", ảnh B2 qua `/anh-goc/`); quyết định 8 viết lại; chuẩn bị #7 bỏ; T30 chỉ cần một bản ≤ 2560px; T41b không còn phụ thuộc bản thu nhỏ trên R2 |
| 7 | 04/11, sau khi so với divineshop.vn: thêm T41e (cache HTML và RSC ở edge, trước T22) vì mỗi lượt xem đang dựng lại trang (TTFB 0,35–2,7 s); ghi ngân sách cụ thể cho T41a (CSS ≤ 60 KB br, JS ≤ 180 KB br) và T41b (≤ 2 preload font, font ≤ 150 KB); T22 cần thêm T41e |
| 6 | 04/11, sau review tốc độ tải trang: tách phần ảnh của T41 thành T41c (sửa nhanh, trước T16) và T41d (bản thu nhỏ trên R2, trước T22); T41b chỉ còn đo và ngân sách; quyết định 8 đổi sang bản thu nhỏ tạo sẵn thay cho Image Transformations; cập nhật T22, T30, T39; thêm chuẩn bị #7 và rủi ro ảnh |
| 3 | Giữ toàn bộ hiệu ứng Bexon; ra mắt sớm trên `www` đọc JSON B2, admin cũ sang `quantri.`; chốt menu, thứ tự trang chủ, khẩu hiệu, TipTap; dời đăng ký, Hỏi AI, Danh Tăng ra sau ra mắt |
| 5 | Sau T1: chạy trên Workers bằng vinext + `cf` thay cho OpenNext + Wrangler (khuyến nghị hiện tại của Cloudflare; `vinext check` 95% tương thích); cập nhật T19, T24, T38b, T39, Checkpoint G theo |
| 4 | Tự rà theo tiêu chuẩn lập kế hoạch: tách T3, T5, T13, T27, T41 thành a/b (mỗi phần ≤ 5 file); thêm T1b (CI, HT-02) và T38b (sao lưu D1, DL-06); thêm Checkpoint H giữa 7 task admin; bổ sung hạ tầng ISR và cách tải JSON cho T19; kiểm hiệu ứng tách chữ với tiếng Việt |
