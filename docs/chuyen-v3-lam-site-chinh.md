# Chuyển V3 làm trang chính `www.tunglamhoaphuc.com`: rà soát sẵn sàng

> Ngày rà soát: 23/11/2026. Chỉ đọc mã và đo từ bên ngoài, **chưa sửa, commit, deploy hay đổi gì trên Cloudflare**.
> Phạm vi: V3 (`E:\tlhp-v3-doc`, nhánh `fix/v3-doc`, Worker `tlhp-v3`, đang chạy `v3.tunglamhoaphuc.com`, noindex) thay Worker `tlhp-web` (`E:\tlhp-av3`, nhánh `feat/content-positions`) ở `www.tunglamhoaphuc.com`; tên miền gốc `tunglamhoaphuc.com` chuyển 301 về `www`; admin CMS (`/quan-tri`) vẫn còn ở `tlhp-web`.
> Cách đo: `curl` GET/HEAD vào www và v3 (đọc công khai), cộng hai lệnh POST rỗng vào `/api/analyze` và `/api/ask-ai` (trả 400, không gọi AI). Không có khóa, không đăng nhập. Số liệu ở phụ lục A.
> Mã nguồn dẫn ở dạng `đường-dẫn:dòng`; V3 là `E:\tlhp-v3-doc`, www là `E:\tlhp-av3`. Bản chạy thủ tục chuyển www trước đây: `E:\tlhp-av3\docs\van-hanh\chuyen-www.md` (đã là kinh nghiệm cho tài liệu này).

---

## 0. Tóm tắt: những việc làm hỏng site hoặc SEO nếu bỏ qua

| # | Chặn chuyển | Vì sao | Mục |
|---|---|---|---|
| B1 | `/lien-he` là mục menu cấp 1 ("Liên hệ") và V3 không có trang này | V3 hiện đổi mọi địa chỉ ngoài `V3_ROUTES` thành `https://www.tunglamhoaphuc.com/...` (`v3-menu.ts:13,28`). Khi www = V3, liên kết đó thành 404 ngay trên menu, và trang `/lien-he` đang được lập chỉ mục (nằm trong sitemap www, đo: V3 trả 404) | 2.4, 4 |
| B2 | Không có lập chỉ mục đúng: noindex cứng, không sitemap, không canonical, không JSON-LD, tiêu đề trang danh sách trùng nhau | `layout.tsx:16` đặt `noindex, nofollow` cho mọi trang; `/sitemap.xml` 404; `/robots.txt` là bản do Cloudflare sinh (chỉ có chú thích, không có luật); 11 loại trang không có `title`/`description` riêng (đo: `/tong-chi-tu-hoc` và `/bao-tuong-phat-giao` đều ra "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc"; các loại còn lại xác định từ mã, mục 2.2) | 1, 2 |
| B3 | V3 không có chuyển hướng tên miền gốc → `www`, và không có tiêu đề noindex cho host khác | Gắn `tunglamhoaphuc.com` cho V3 mà không có luật chuyển thì nội dung bị phục vụ trùng ở hai host. Chuyển hướng trong app làm mất `?q=...` (đo: `tunglamhoaphuc.com/tim-kiem?q=a` → `www…/tim-kiem`, mất `?q=a`) nên phải dùng Redirect Rule của Cloudflare | 3.1, 6 |
| B4 | Admin: ai cũng đang vào `www.tunglamhoaphuc.com/quan-tri`, và admin chỉ trả lời ở đúng host trong `ADMIN_BASE_URL` | Chuyển www sang V3 mà chưa dời admin thì người biên tập mất admin (V3 trả 404 cho `/quan-tri` và `/api/quan-tri`). Dời sang host mới thì cookie `__Host-` không dùng lại được: **mọi người phải đăng nhập lại**, và mọi lần deploy `tlhp-web` phải mang `ADMIN_BASE_URL` mới | 5 |
| B5 | Bốn API AI/giọng đọc công khai của V3 (`/api/analyze`, `/api/ask-ai`, `/api/crop-analyze`, `/api/tts`) **không có giới hạn tần suất**, www có | www đã sửa ở `e1365e5` (`allow`, `OverLimit`, `tooMany`, `overLimit` trong `src/libs/tibetan/server.ts`); V3 giữ bản cũ. Trên host chính, ai cũng đốt được hạn mức Workers AI. `/api/tts/vi` (V3 riêng) cũng chuyển tiếp không giới hạn sang Google TTS | 4.3 |
| B6 | Thiếu tệp tĩnh: `/favicon.ico` (404), `/manifest.webmanifest`, `/brand/*` (logo, biểu tượng, ảnh chia sẻ), `public/_headers` | D1 lưu menu và nội dung trỏ `/brand/...` (`migrations/0004_admin-noi-dung.sql:215-223`, và `content/html.ts:215` cho phép ảnh `/brand/` trong bài). Hiện `absUrl` đẩy sang www nên chạy; khi www = V3 thì 404 nếu V3 không có thư mục này | 2.5, 7 |
| B7 | Quy trình đổi tên miền giữa hai Worker chưa diễn tập, và cache của Cloudflare giữ trang do `tlhp-web` dựng | Một Custom Domain thuộc một Worker; có khoảng trống giữa gỡ và gắn. Sau khi chuyển cần xóa cache cả vùng, nếu không có thể còn thấy giao diện cũ tới 5 phút | 6 |
| B8 | Nội dung chưa nên lên host chính | Thanh "tìm kiếm AI" giả (`SmartSearchAIBar.tsx:34`, "Mock AI delay", câu trả lời và liên kết viết cứng) có trên hầu hết trang kể cả 404; `/api/memorials` trả công khai họ tên, ngày sinh mất, địa chỉ, nơi an táng của cả danh sách; `/kiem-tra-anh` và `public/review_statues.html` là trang nội bộ đang mở | 4.4 |
| B9 | V3 trả 503 ngẫu nhiên khi bị quét song song | Quét 829 địa chỉ của sitemap www, 8 luồng: www 829/829 trả 200; V3 816 trả 200, **10 trả 503** (0,2 giây), thử lại từng cái đều 200. Trung bình V3 0,61 giây, www 0,32 giây. Cần tra Workers Logs tìm nguyên nhân (ghi nhận `exceededCpu`?) trước khi nhận Googlebot | 7.3 |

Khuyến nghị cho admin: **phương án (a)** (xem mục 5): giữ `tlhp-web` làm admin, dời sang `quantri.tunglamhoaphuc.com` làm **bước riêng, đảo ngược được**, làm và chạy thử xong *trước* khi chuyển www sang V3. Không gộp admin vào V3.

Điều đã đúng sẵn (không cần làm): ảnh `/anh-goc/` và `/cdn-cgi/image/` dùng đường dẫn tương đối, chạy được ở mọi host cùng zone; V3 đọc cùng D1 và R2 nên nội dung khớp; bảng chuyển hướng admin (`redirect`) đã được V3 đọc ở `[...missing]`; 820/829 địa chỉ trong sitemap hiện tại của www đã trả 200 ở V3 (phần còn lại: `/lien-he` 404, `/lich-tu-hoc` 307 về `/#lich-tu-hoc`, một địa chỉ cũ 308 hợp lệ, và 7–10 lần 503 thoáng qua).

---

## 1. V3 quyết định lập chỉ mục thế nào, và cần gì để chỉ host công khai được lập chỉ mục

### 1.1 Hiện trạng V3

| Thành phần | Có gì | Dẫn chứng |
|---|---|---|
| Thẻ meta | `robots: { index: false, follow: false }` trong `metadata` của layout gốc, áp cho **mọi** trang | `src/app/layout.tsx:16` (kèm chú thích `:15`) |
| Tiêu đề HTTP | **Không có** `X-Robots-Tag` (đo trên `v3.` trang chủ: không có) | `next.config.ts:41-52` chỉ có luật `X-Frame-Options` cho `/tibetan-study/:path*` |
| `robots.txt` | Không có `robots.ts`. Địa chỉ `/robots.txt` trả 200 nhưng là **bản Cloudflare tự sinh** (chỉ có chú thích về content signals, không có `User-agent`/`Disallow`), nên không chặn gì | đo 23/11 |
| `sitemap.xml` | Không có; 404 | đo 23/11; `docs/admin-cho-v3.md:37` ghi nhận |
| Chống lập chỉ mục theo host | Không có. www dùng luật `missing host` | www `next.config.js:70-76`, `src/libs/hosts.ts:3-9`, `src/app/robots.ts:22` |

### 1.2 Đề xuất (V3)

1. **Bỏ** `robots: { index: false, follow: false }` ở `src/app/layout.tsx:15-16`.
   - Tuyệt đối **không** thay bằng đọc host trong layout hay trang (`headers()`): vinext coi trang đọc `headers()`/`searchParams` là động và mất Workers Cache (đã ghi ở `src/app/page.tsx:1` và bộ nhớ dự án). Dùng tiêu đề HTTP như www.
2. Thêm vào `next.config.ts` (chép từ www `next.config.js:2-3,70-76`): luật `X-Robots-Tag: noindex, nofollow` với `missing: [{ type: "host", value: PUBLIC_HOST }]`, `PUBLIC_HOST = (www\.)?tunglamhoaphuc\.com(:\d+)?`. Nhờ đó `v3.`, `*.workers.dev`, `localhost` vẫn noindex dù cùng một bản build. Khuyến nghị **giữ `v3.tunglamhoaphuc.com` làm bản xem thử noindex** trong 2–4 tuần (xem mục 6).
3. Thêm `src/app/robots.ts` theo mẫu www (`E:\tlhp-av3\src\app\robots.ts:20-33`):
   - Host không công khai: `Disallow: /`.
   - Host công khai: `Allow: /`, `Disallow: /tim-kiem` (nếu có), `/cdn-cgi/`, `/anh-goc/`, `/api/`, và **thêm của V3**: `/tra-cuu-bai-vi`, `/kiem-tra-anh`; kèm `Sitemap: https://www.tunglamhoaphuc.com/sitemap.xml`.
   - Chép `src/libs/hosts.ts` và `robotsExtra.ts` của www (V3 đã có `getSettings()` ở `src/lib/tlhp-site/siteData.ts`: đọc `settings["seo.defaults"].robotsExtra` để mục SEO > robots.txt của admin tiếp tục có tác dụng). Lưu ý: ở www, ngoài `robotsExtra`, các ô "tiêu đề/mô tả/ảnh chia sẻ mặc định" của trang SEO admin **không trang công khai nào đọc** (`grep seo.defaults` chỉ ra `robots.ts` và `admin/ops/seo.ts`); V3 giữ nguyên như vậy, không mất gì.
4. Thêm `src/app/sitemap.ts` (`export const revalidate = 3600` như www `sitemap.ts:8`), dựng từ `getContentRepository()` của V3. Mục tiêu: **cùng tập địa chỉ với sitemap www hiện tại (830 địa chỉ, đo 23/11)** trừ:
   - `/lich-tu-hoc` (V3 chuyển hướng, không được nằm trong sitemap; xem 4.2),
   - thêm `/lien-he` khi có trang (B1).
   Danh sách cố định theo www `src/libs/seo.ts:33-45` và vòng lặp `:50-72` (bài của 2 chuyên trang theo `listPosts`, chủ đề Giới thiệu, bài Tông Chỉ, khu vực, tượng, sự kiện và khóa lễ). V3 có sẵn `listAboutTopics/listTongChi/listAreas/listStatues/getSchedule` trong `src/lib/tlhp-content`; chỉ phần dựng đường dẫn sự kiện/khóa lễ cần dùng đúng hàm đặt slug của V3 (`src/lib/schedule-detail.ts`, đã kiểm: 18 địa chỉ `/lich-tu-hoc/<slug>` của www đều 200 ở V3).
   - **Kiểm tương đương ngay khi viết xong**: lấy sitemap www lúc đó và so với sitemap V3 (lệnh ở mục 8, "kiểm trước chuyển").
5. Thêm test đơn vị (V3 chạy `node --test`): trang chủ `Metadata` không còn `robots`, `robots()` trả `Disallow: /` cho `v3.`/`localhost` và `Allow: /` cho `www`, sitemap không chứa `/lich-tu-hoc`, `/kiem-tra-anh`, `/tra-cuu-bai-vi`, không có địa chỉ trùng. Tham khảo www `tests/e2e/seo.spec.ts`.

Hiệu ứng phụ nên biết: gỡ noindex là lúc Google bắt đầu quét V3 theo đúng cấu trúc, nên **thứ tự làm**: xong mục 1 và 2 trên bản V3 → chạy kiểm → mới chuyển tên miền (mục 6). Không bỏ noindex trước khi tên miền đã chuyển, nếu không `v3.` bị lập chỉ mục trùng www.

---

## 2. Canonical, Open Graph, JSON-LD, địa chỉ cứng

### 2.1 Canonical và metadata dùng chung

- V3 **không có canonical** ở đâu cả (`grep canonical` rỗng; đo trang bài: không có `<link rel="canonical">`). www có `alternates: { canonical: "./" }` trong layout gốc (`E:\tlhp-av3\src\app\layout.js:33`) nên mỗi trang tự trỏ về chính nó trên `metadataBase`.
- **Đề xuất**: ở `src/app/layout.tsx` đặt `metadataBase: new URL("https://www.tunglamhoaphuc.com")` (đang là `V3_ORIGIN`, `:14`) và thêm `alternates: { canonical: "./" }`. Thêm `openGraph` mặc định (`siteName`, `locale: "vi_VN"`, ảnh `/brand/og-tung-lam-hoa-phuc.jpg` 1200×630), `twitter: { card: "summary_large_image" }`, `applicationName`, `icons`, `manifest`, `viewport.themeColor`, như www `layout.js:28-51`. Hiện V3 chỉ có `title` và `description` mặc định (`layout.tsx:17-19`), không có ảnh chia sẻ mặc định.
- Trùng nội dung bên trong V3: **`/bao-tuong/{slug}` và `/bao-tuong-phat-giao/{slug}` đều trả 200 cùng một trang** (đo; www trả 404 cho dạng sau). Địa chỉ `bao-tuong-phat-giao/[slug]` ở `src/app/(public)/bao-tuong-phat-giao/[slug]/page.tsx:1-7` chỉ dùng cho liên kết cũ. Đề xuất: biến nó thành `permanentRedirect('/bao-tuong/<slug>')`, hoặc ít nhất canonical về `/bao-tuong/{slug}` (và không đưa vào sitemap). Địa chỉ `/bao-tuong` (V3: 307 về `/bao-tuong-phat-giao`, `bao-tuong/page.tsx:4`, www: 404) nên đổi sang 308 hoặc xóa.
- Địa chỉ `/lich-tu-hoc` hiện là `redirect("/#lich-tu-hoc")` (307, `(public)/lich-tu-hoc/page.tsx:6`), trong khi **www có trang danh sách thật** và nó nằm trong sitemap đang được lập chỉ mục. Phải quyết: (i) vẽ trang danh sách như www, hoặc (ii) đổi thành `permanentRedirect` (308) và chấp nhận mất trang này khỏi chỉ mục. Hiện 307 là tạm thời nên Google còn giữ trang cũ lâu và treo "soft 404".

### 2.2 Tiêu đề và mô tả theo trang

Trang V3 có `generateMetadata`/`metadata`: `dong-chay-hoang-phap/[slug]`, `gioi-thieu/[slug]` và 6 trang `gioi-thieu/*` tĩnh, `tong-chi-tu-hoc/[slug]`, `tri-tue-phat-phap/[slug]`, `vu-tru-phat-giao/[slug]`, `tra-cuu-bai-vi`. **Không có** (nên dùng tiêu đề mặc định của layout, đo xác nhận): `/`, `/gioi-thieu`, `/tong-chi-tu-hoc`, `/dong-chay-hoang-phap`, `/tri-tue-phat-phap`, `/tri-tue-phat-phap/hoc-tieng-tang`, `/vu-tru-phat-giao`, `/bao-tuong-phat-giao`, `/bao-tuong/[slug]`, `/lich-tu-hoc/[slug]`, `/kiem-tra-anh`.
Đề xuất: thêm `metadata` (tiêu đề như www: `"<Tên> – Tùng Lâm Hòa Phúc"`; xem www `src/app/(site)/*/page.tsx`) cho các trang danh sách, và `generateMetadata` cho `bao-tuong/[slug]` (dùng tên, mô tả, ảnh tượng) và `lich-tu-hoc/[slug]` (tên sự kiện).
Khác biệt định dạng tiêu đề bài: www `"<Tiêu đề> – Dòng Chảy Hoằng Pháp – Tùng Lâm Hòa Phúc"`, V3 `"<Tiêu đề> | Tùng Lâm Hòa Phúc"` (`v3-seo.ts:55`). Không sai, nhưng 830 tiêu đề đã lập chỉ mục sẽ đổi dạng; nếu muốn giữ, sửa `build()` ở `v3-seo.ts:49-69` để thêm tên chuyên trang.

### 2.3 Địa chỉ tuyệt đối đang gắn cứng vào `v3.` hoặc `www`

| Chỗ | Nội dung | Đề xuất |
|---|---|---|
| `src/lib/v3-seo.ts:17` `V3_ORIGIN = "https://v3.tunglamhoaphuc.com"`; `:25` `metaImageUrl` | Ảnh chia sẻ (`og:image`, `twitter:image`) của mọi bài dùng `v3.` (đo: `og:image` = `https://v3.tunglamhoaphuc.com/anh-goc/...`, www dùng `www.`). `v3-seo.ts:1-4` còn ghi "V3 vẫn là bản xem trước" | Đổi hằng sang `https://www.tunglamhoaphuc.com` (đổi tên `PUBLIC_ORIGIN`), cập nhật chú thích đầu tệp và `tests/unit/v3-seo.test.ts` |
| `src/app/layout.tsx:14` | `metadataBase = V3_ORIGIN` | như 2.1 |
| `src/lib/v3-data.ts:11,16` `WWW_ORIGIN` trong `absUrl` | Mọi đường dẫn tương đối **không** bắt đầu `/anh-goc/` (vd `/brand/...`, `/images/...`) được ghép `https://www.tunglamhoaphuc.com`. Hôm nay thì trỏ ra www (còn `/brand`); khi www = V3 thì trỏ vào chính V3 nên chỉ đúng nếu V3 có các tệp đó (B6) | Sau chuyển có thể giữ nguyên; tốt hơn đổi thành đường dẫn tương đối (`return src`) để chạy được ở `v3.` và host khác |
| `src/lib/v3-menu.ts:13,19,28` | `menuHref`: địa chỉ đầu tiên không thuộc `V3_ROUTES` → `https://www.tunglamhoaphuc.com${href}`. Hôm nay `/lien-he` ra `https://www…/lien-he` (đo trên v3: có đúng một liên kết đó) | **Vòng lặp/404 khi www = V3** (B1). Sửa: trả `href` nguyên (tương đối) và thêm các trang còn thiếu vào `V3_ROUTES`/làm trang. `tests/unit/v3-chrome*.test.ts` đang giả định hành vi cũ nên phải sửa theo |
| `src/utils/image.ts:100,110` `WWW_ANH_GOC` | Cắt tiền tố `https://www…/anh-goc/` để dùng `/anh-goc/` nội bộ | Vẫn đúng sau chuyển; giữ để xử lý dữ liệu D1 cũ có địa chỉ tuyệt đối |
| `src/lib/tlhp-site/redirects.ts:10` `OWN_HOSTS` | Chuyển hướng admin chỉ nhận đích tại `tunglamhoaphuc.com`/`www` | Đúng; không có `v3.` |
| `src/components/gioi-thieu/SuToEventToolkit.tsx:231`, `TieuSuSuToOdysseyView.tsx:682` | Mặc định `https://tunglamhoaphuc.com` cho mã QR (sau đó ghi đè bằng `window.location.origin`) | Đổi mặc định thành `https://www.tunglamhoaphuc.com` (tránh QR đi qua một lần chuyển hướng) |
| `src/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer.tsx:169` | `OWN_HOSTS` gồm cả `v3.` | Giữ hoặc bỏ `v3.` sau cùng; vô hại |
| `admin.tunglamhoaphuc.com` (`utils/image.ts:2`, `tlhp-content/media.ts:16`, `app/cdn-cgi/image/[...rest]/route.ts:7`, `next.config.ts:14`) | Máy chủ WordPress cũ (`209.42.27.235`), vẫn là nguồn dự phòng của `/anh-goc/wordpress/*` | Không liên quan chuyển www; **không tắt** WordPress trước khi R2 có đủ ảnh |

### 2.4 JSON-LD

V3 không có JSON-LD (đo: không có `application/ld+json`). www có: `Organization/BuddhistTemple` ở trang chủ, `Place` ở `/lien-he`, `Article` ở bài (Dòng Chảy, Trí Tuệ), `Event` ở `/lich-tu-hoc` và từng sự kiện (www `src/libs/seo.ts:75-157`, dùng ở `(home)/page.tsx:53`, `PostArticle.tsx:52`, `lich-tu-hoc/page.tsx:114`, `lich-tu-hoc/[slug]/page.tsx:81`, `lien-he/page.tsx:29`; thành phần `components/shared/others/JsonLd.tsx`).
Đề xuất: chép `jsonLdText`, `organizationJsonLd`, `placeJsonLd`, `articleJsonLd`, `eventJsonLd` và `JsonLd.tsx` sang V3, đặt `PUBLIC_ORIGIN`, cắm vào trang chủ, bài, sự kiện, khóa lễ. Thông tin cơ sở (`site.name`, `site.phone`, địa chỉ, `hasMap`, `sameAs`) www lấy từ `src/config/site.ts` chứ không từ D1; V3 cần một bản `site` tương đương (hoặc lấy từ `site.info` của D1 qua `v3-menu.ts:115 infoFromSetting`). Đây là hạng mục SEO, không làm site hỏng, nhưng mất rich result nếu bỏ.

### 2.5 Tệp gắn thương hiệu còn thiếu

V3 `public/` chỉ có `fonts/`, `images/`, `tibetan-study/`, `UTM*.TTF`, `review_statues.html`. **Thiếu so với www:** `src/app/favicon.ico`, `src/app/manifest.ts` (www trả `/manifest.webmanifest`), `public/brand/` (favicon 16/32, apple-touch, icon 192/512, `og-tung-lam-hoa-phuc.jpg`, logo, `icons/*.webp`), và `public/_headers`. Đo trên V3: `/favicon.ico` 404. V3 hiện chèn logo thẳng từ B2 (`media-tunglamhoaphuc.s3...backblazeb2.com/.../logo-moc-an.webp` trong thẻ `<link rel="preload">`, đo). Đề xuất: chép `public/brand/**`, `src/app/favicon.ico`, `src/app/manifest.ts` từ www (513 KB); thêm `icons`/`manifest`/`openGraph.images` vào metadata (2.1).

---

## 3. Tiêu đề bảo mật và chuyển hướng

### 3.1 So sánh cấu hình

| Hạng mục | www (`next.config.js`) | V3 (`next.config.ts`) | Việc cần làm ở V3 |
|---|---|---|---|
| HSTS | `Strict-Transport-Security: max-age=31536000` (`:19`, mọi trang, không `includeSubDomains`) | **Không có** | Thêm. www đã gửi HSTS 1 năm cho `www`, nên V3 phục vụ `www` bắt buộc HTTPS (Cloudflare đã bật) |
| `X-Frame-Options` | `SAMEORIGIN` (`:20`) | không (chỉ luật `/tibetan-study/:path*` ở `:44-49`, vô tác dụng vì thư mục này chạy ngoài Worker) | Thêm `SAMEORIGIN` (`/hoc-tieng-tang` dùng iframe cùng nguồn, vẫn chạy) |
| COOP | `Cross-Origin-Opener-Policy: same-origin` (`:21`) | không | Thêm (đo trên www: có) |
| `X-Content-Type-Options`, `Referrer-Policy` | `nosniff`, `strict-origin-when-cross-origin` (`:22-23`) | không | Thêm |
| CSP công khai | không có (chủ ý, `:14-17`) | không | Giữ không có |
| `X-Robots-Tag` theo host | có (`:70-76`) | không | Thêm (mục 1.2) |
| Tên miền gốc → `www` | 308 (`:64`) | **không** | Thêm cùng luật, **và** Redirect Rule ở Cloudflare giữ chuỗi truy vấn (3.2) |
| `/admin`, `/login`, `/van-hanh` → `quantri.` (307) | có (`:8-12`) | không | Xem 3.3 |
| `/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam` → `…/tiep-buoc-thay-toi` | không (www dùng bảng `redirect` của admin) | có 308 (`:53-60`) | Giữ; vô hại |
| `poweredByHeader: false` | không đặt | đặt | không |

Chép nguyên khối `SECURITY_HEADERS` và `PUBLIC_HOST/BARE_HOST` của www. Lưu ý: tiêu đề do `next.config` đặt vẫn áp được lên trang lấy từ Workers Cache (đo trên www: `CF-Cache-Status: HIT` mà vẫn có đủ tiêu đề); nên cách này an toàn với cache.

### 3.2 Tên miền gốc

www ghi rõ (`chuyen-www.md:23`): vinext không mang chuỗi truy vấn sang tên miền khác. Đo lại hôm nay: `curl -I https://tunglamhoaphuc.com/tim-kiem?q=a` → `308 Location: https://www.tunglamhoaphuc.com/tim-kiem` (mất `?q=a`).
Đề xuất: Redirect Rule (Single Redirect) ở Cloudflare cho `http.host eq "tunglamhoaphuc.com"` → 301 tới `concat("https://www.tunglamhoaphuc.com", http.request.uri.path)` kèm **Preserve query string**, để luật chạy ở rìa trước Worker; luật trong `next.config.ts` chỉ là lớp dự phòng. Tạo luật **trước** khi chuyển DNS, kiểm bằng `curl -I`.

### 3.3 Địa chỉ admin cũ và `/quan-tri` trên V3

- V3 với `/quan-tri` và `/api/quan-tri`: không có route nào; địa chỉ rơi vào `src/app/[...missing]/page.tsx:13-16` → `notFoundOrMoved` (`v3-redirect.ts:36-39`) → 404. `RESERVED_PREFIXES` (`tlhp-site/redirects.ts:7`) gồm `/quan-tri`, `/api`, `/anh-goc`, `/cdn-cgi`, `/admin`, `/login`, `/van-hanh`, `/_next` nên bảng chuyển hướng không bao giờ chạm tới chúng. Đo trên `v3.`: `GET /quan-tri` 404, `GET /api/quan-tri/v1/me` 404, `POST /api/quan-tri/v1/auth/login` 404. Đúng như mong muốn (không rò admin).
- **Nhưng người biên tập đang đánh dấu trang** `https://www.tunglamhoaphuc.com/quan-tri/dang-nhap`. Sau chuyển, đường dẫn đó thành 404. Đề xuất ở V3 `next.config.ts`: `/quan-tri` và `/quan-tri/:path*` → `https://quantri.tunglamhoaphuc.com/quan-tri/:path*` (307, chỉ cho host công khai; `OLD_ADMIN_PATHS` của www dẫn tới `quantri.` ở `/admin`, không phải `/quan-tri`, nên **không dùng lại** bản đó). Chuỗi truy vấn của trang đặt lại mật khẩu (`?token=`) sẽ mất khi chuyển tới host khác, nhưng thư đặt lại mật khẩu sẽ mang địa chỉ `quantri.` ngay (5.1); thư cũ gửi trước ngày chuyển sẽ hỏng, nên **không chuyển lúc đang có yêu cầu đặt lại mật khẩu**.
- `/admin`, `/login`, `/van-hanh` trên `www` hiện bị **Cloudflare Access** chặn (ứng dụng "Admin site cũ", đo: `GET /admin` → 302 tới `lingering-heart-cb52.cloudflareaccess.com`). Access nằm trước Worker nên vẫn chặn sau chuyển; vô hại, dọn sau (ứng dụng Access `f9305e45…`, `docs/van-hanh/admin-cu.md`). `tlhp-admin-guard` (route `www/api/*`): đo `POST www/api/analyze` trả **400** (không phải 403 của guard) nên **suy ra** guard không còn chặn; **vẫn phải xác nhận** ở bảng điều khiển trước khi chuyển (nếu còn thì mọi POST công khai của V3 bị 403).

---

## 4. Trang và API: www có gì, V3 có gì

### 4.1 Bảng đối chiếu

Danh sách www lấy từ `src/app/**/page.*` và `route.*` (không tính `quan-tri`); V3 từ cùng cách.

| www | V3 | Ghi chú |
|---|---|---|
| `/` (`(home)/page.tsx`) | `/` (`app/page.tsx`) | giao diện khác; V3 chưa có JSON-LD (2.4) |
| `/gioi-thieu`, `/gioi-thieu/[slug]` | có, kèm 6 trang tĩnh `gioi-thieu/*` | đo: `/gioi-thieu/dai-su-lien-dang` 200 ở cả hai; tiêu đề khác nhau |
| `/tong-chi-tu-hoc`, `/[slug]` | có | tiêu đề danh sách thiếu (2.2) |
| `/dong-chay-hoang-phap`, `/[slug]` | có; V3 phân trang qua `/api/public/dong-chay` | |
| `/vu-tru-phat-giao`, `/[slug]` | có | |
| `/bao-tuong-phat-giao`, `/bao-tuong/[slug]` | có; **thêm** `/bao-tuong-phat-giao/[slug]` (trùng) và `/bao-tuong` (307) | 2.1 |
| `/tri-tue-phat-phap`, `/[slug]` | có | `di-qua-kho-vui-cuoc-doi` do `[slug]` + `sach-an-pham-data.json` phục vụ (đo: 200) |
| `/tri-tue-phat-phap/hoc-tieng-tang` | có (iframe `/tibetan-study/index.html`) | 200 |
| `/lich-tu-hoc` (trang danh sách thật) | **chuyển 307 về `/#lich-tu-hoc`** | 2.1 |
| `/lich-tu-hoc/[slug]` | có | 18/18 địa chỉ www đều 200 |
| `/lien-he` | **không có (404)** | **B1**. Cần trang (chép `lien-he/page.tsx`, đọc `site.info` từ D1) hoặc chuyển 308 về một neo ở chân trang; nên làm trang thật vì đã được lập chỉ mục và có `Place` JSON-LD |
| `/tim-kiem` | **không có (404)** | chức năng, không phải SEO (www đặt noindex ở `tim-kiem/page.tsx:20`). Đề xuất: chép `libs/search.ts`, `libs/searchIndex.ts` và trang; hoặc chủ quyết bỏ tìm kiếm. Thanh "tìm kiếm" của V3 là giả (4.4) |
| `/sitemap.xml`, `/robots.txt` | **không có / bản Cloudflare** | mục 1 |
| `/favicon.ico`, `/manifest.webmanifest`, `/brand/*` | **không có** | 2.5 |
| `(mau-bexon)/*` (blogs, contact…), `/styleguide` | không có | www trả 404 ở host công khai; không cần |
| `/anh-goc/[bucket]/[...key]` | có, mã giống nhau | cùng R2 `tlhp-media`, tệp cache 30 ngày + 7 ngày |
| `/cdn-cgi/image/*` | route dự phòng giống nhau | biến đổi ảnh chạy ở rìa, theo zone: chạy với mọi host của zone; nguồn là `/anh-goc/` của chính host đang phục vụ |
| `/images/[...path]` | V3 **riêng** (chuyển 307 về B2) | www không có; V3 vẫn cần cho đường dẫn cũ |
| `/tibetan-study/*` tĩnh | có (cùng 22 MB, cùng nội dung) | chạy ngoài Worker (`runWorkerFirst` loại trừ) |
| `/api/analyze`, `/ask-ai`, `/crop-analyze`, `/tts` | có nhưng **thiếu giới hạn** | 4.3 |
| Thông báo chào mừng | có (`WelcomeNoticeModal`, đọc `site.announcement`) | |
| API riêng của V3 | `/api/admin/{posts,gioi-thieu,danh-tang,reference-books,schedule,tong-chi}`, `/api/memorials`, `/api/public/{dharma-featured,dong-chay,increment-view}`, `/api/home/news-carousel`, `/api/tts/vi`, `/tra-cuu-bai-vi`, `/kiem-tra-anh`, `public/review_statues.html` | 4.4 |

### 4.2 Nhận xét về chuyển hướng bảng `redirect`

V3 xử lý đúng như www ở `[...missing]` (`src/app/[...missing]/page.tsx:13-16`): chống vòng, chỉ đích trong site, 301/302 theo hàng. V3 **không đếm lượt** (`v3-redirect.ts:3-4`), nên cột "hits" của trang Chuyển hướng admin sẽ ngừng tăng sau chuyển. Đo thực: một địa chỉ cũ có hàng chuyển hướng cho 308 ở V3.

### 4.3 API công khai thiếu giới hạn (B5)

- www: `analyze/route.ts:11-18` gọi `allow(request, "analyze", 60)`, `ask-ai` 20/phút, `crop-analyze` 40/phút, `tts` `overLimit(..., 240)`, đếm theo /64 IPv6, trả 429 + `Retry-After` (`libs/tibetan/server.ts`, hàm `overLimit` cuối tệp, `allow`, `tooMany`).
- V3: `src/app/api/analyze/route.ts:6-11`, `ask-ai/route.ts:6-20`, `crop-analyze/route.ts:8-28`, `tts/route.ts:7-22` gọi thẳng `cachedJson(...)`; `src/lib/tibetan/server.ts` không có `allow/overLimit/tooMany/OverLimit`. Hàm `overLimit` của www gọi `throttleIp` từ `@/admin/auth/throttle` (không có trong V3), nên cần chép riêng phần gộp /64.
- `src/app/api/tts/vi/route.ts:15-40`: `GET ?text=` chuyển tiếp đến `translate.googleapis.com` (tối đa 260 ký tự), không giới hạn: dùng được như một proxy TTS. Dùng bởi `SuToKaraokeReader.tsx:295`.
- Đề xuất: chép nguyên các hàm giới hạn và sửa 4 route theo www (kèm các ca giới hạn trong `tests/unit/tibetan.test.ts` của www); thêm cùng `overLimit` cho `/api/tts/vi`; giữ **trần chi phí toàn cục** cho Workers AI (Rate Limiting của Cloudflare + cảnh báo ngân sách) là việc của chủ tài khoản, www cũng chưa có (`memory: đợt 5`).

### 4.4 Nội dung và trang nội bộ không nên lên host chính

1. **Thanh tìm kiếm AI giả** `src/components/public/SmartSearchAIBar.tsx:27-60`: `setTimeout` "Mock AI delay" rồi trả một đoạn viết cứng và ba liên kết viết cứng (vd `/tong-chi-tu-hoc/bo-de-tam`, có thể 404). Được dùng ở trang chủ (`HomeClient.tsx:81`), mọi trang chuyên trang, trang chi tiết và cả trang 404 (`app/not-found.tsx:91`). Trên host chính, đây là nội dung giả đóng vai trợ lý Phật học. Đề xuất: gỡ hoặc nối vào tìm kiếm thật (cần `/tim-kiem`, mục 4.1).
2. **`/api/memorials`** (`src/app/api/memorials/route.ts:9-40`) trả công khai cả danh sách: họ tên, pháp danh, ngày sinh, ngày mất, tuổi, địa chỉ, nơi an táng, tên và số liên hệ đã che một phần (`memorial-types.ts:131-153`). Đo: trả `records` đầy đủ không cần tham số. Trang `/tra-cuu-bai-vi` là trang QR chủ ý công khai, nhưng danh sách đầy đủ bằng JSON thì dễ cào hàng loạt. Quyết định của Ban Trị Sự: giữ, giới hạn (chỉ trả khi có `?q=` ≥ 3 ký tự, bỏ địa chỉ), hoặc bỏ. Thêm `robots: { index:false }` cho `/tra-cuu-bai-vi` (`tra-cuu-bai-vi/page.tsx:10-14` hiện không có).
3. **`/kiem-tra-anh`** (`(public)/kiem-tra-anh/page.tsx`, trang đối soát ảnh tượng) trả 200 ở V3 (www: 404) và `public/review_statues.html` (75 KB, "Review All Statues Orientation") trả 200. Hai thứ nội bộ: xóa hoặc đặt sau đăng nhập, và không đưa vào sitemap.
4. **`/api/admin/{posts,gioi-thieu,danh-tang,reference-books}`**: không có nơi nào trong giao diện V3 gọi (`grep "api/admin/"` chỉ thấy `tong-chi` ở `TongChiArticleSwitcherModal.tsx:51` và `schedule` ở `CalendarSection.tsx:277`). `/api/admin/posts` trả ~900 KB JSON công khai (đo). Xóa 4 route thừa; đổi tên `/api/admin/{tong-chi,schedule}` thành `/api/public/...` để không gây hiểu lầm (tên "admin" trên host chính dễ khiến tưởng có admin).
5. `/api/public/increment-view`: V3 trả `counted:false` (không đếm); www cũng không ghi lượt xem công khai (không thấy câu `INSERT` vào `page_view` ngoài `db/import.ts`), nên **không có hồi quy**; chỉ cần biết số lượt xem công khai không tăng ở cả hai.

---

## 5. Kế hoạch admin

### 5.1 Hai phương án

**(a) Giữ `tlhp-web` làm Worker admin trên host mới `quantri.tunglamhoaphuc.com`. Khuyến nghị.**
**(b) Gộp admin vào V3. Không khuyến nghị.**

Lý do chọn (a):

1. Admin là phần lớn mã của `tlhp-web` (`src/admin`, `src/components/admin`, `src/app/quan-tri`, 5 migration, Argon2id 236–605 ms CPU mỗi lần đăng nhập) và cần gói Workers Paid; V3 hiện nhẹ, chỉ đọc, không ghi gì. Gộp là kéo cả schema ghi, bí mật (`ADMIN_JWT_SECRET`, `ADMIN_ENC_KEY`), bucket `tlhp-backup`, `admin.css`, CSP riêng và e2e admin 40+ ca vào một ứng dụng có giao diện khác hẳn (Tailwind + shadcn so với Bootstrap/SCSS của www). Rủi ro bề mặt tấn công và kích thước bản build tăng, không có lợi ích người dùng.
2. Cookie phiên là `__Host-tlhp_at/_rt` (`src/admin/http/cookies.ts:2`): host-only, không `Domain`, nên không chia sẻ giữa hai host; admin ở host riêng cũng không bị rò sang trang công khai.
3. Đảo ngược được: mọi thay đổi ở (a) nằm ở `tlhp-web` và một biến build; không đụng D1.
4. Việc "xem trước nháp" dùng thành phần của www (`SiteShell`, `PostPreview`...) nên vẫn chạy trọn trong `tlhp-web`.

### 5.2 Danh sách thay đổi cho (a)

**Trong `tlhp-web` (`E:\tlhp-av3`)**

1. `cloudflare.config.ts:16`: `domains` của `tlhp-web` thành `["quantri.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com"]` (và, **chỉ trong giai đoạn 1**, giữ thêm `www`, `tunglamhoaphuc.com`; xem 8). Giữ **toàn bộ ứng dụng** `tlhp-web` (không cắt route công khai) trong thời gian chuyển: `v2.` là bản đối chứng và bản dự phòng nhanh.
2. Mọi deploy từ nay: `TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com npm run deploy:v2` (sửa `CLAUDE.md` và `docs/van-hanh/d1.md` mục 7, nơi đang ghi `ADMIN_BASE_URL=https://www…`). Thiếu biến thì admin trả 503 (`api/quan-tri/v1/[...path]/route.ts:37-41`).
3. `ADMIN_BASE_URL` điều khiển, **không cần sửa mã**:
   - kiểm host của API: `src/admin/http/api.ts:103`,
   - kiểm `Origin` chống CSRF: `api.ts:127`, `src/admin/http/origin.ts:15-27`,
   - kiểm host của trang xem trước: `app/quan-tri/xem-truoc/[loai]/[id]/page.tsx:60`,
   - đường liên kết trong thư đặt lại mật khẩu: `src/admin/auth/service.ts:329`.
   Hệ quả: **mọi người đăng nhập lại** ở host mới; hai bản ghi cookie cũ ở `www` vô hại. Thư đặt lại mật khẩu gửi trước ngày chuyển mang địa chỉ cũ nên vô hiệu.
4. Liên kết "Xem trên trang ↗" dùng đường dẫn **tương đối**: `components/admin/content/ContentEditor.tsx:363,569` (`ui.publicPath`, `types.ts:43,58,74`) và hiển thị ở `ContentList.tsx:217`. Trên `quantri.` đường dẫn đó mở **bản công khai cũ của chính `tlhp-web`** (noindex, giao diện Bexon) chứ không phải site thật. Sửa: ghép `PUBLIC_ORIGIN` (`src/libs/seo.ts:14`) vào `href` (giữ chữ hiển thị).
5. Trên host `quantri.`, đặt `/` → `/quan-tri` (307) trong `next.config.js` (điều kiện `has host quantri…`) để gõ tên miền là vào admin. Các route còn lại (`/anh-goc`, `/cdn-cgi`, `/brand`, `/images`, `/_next`) **phải còn** vì giao diện admin (thư viện ảnh, trình soạn bài, trang xem trước) tải ảnh `/anh-goc/...` và `/cdn-cgi/image/...` theo đường dẫn tương đối ở host `quantri.`; biến đổi ảnh của zone chạy với mọi host cùng zone.
6. Host `quantri.` không phải host công khai: `isPublicHost` (www `src/libs/hosts.ts:3-9`) trả sai nên `X-Robots-Tag: noindex, nofollow` và `robots.txt` `Disallow: /` đã đúng, không cần sửa.
7. Cloudflare Zero Trust (tùy chọn, "cửa thứ hai"): hiện `quantri.` chưa có gì (đo: 403 do bản ghi wildcard `*` proxied của zone). Có thể thêm ứng dụng Access cho `quantri.tunglamhoaphuc.com` dùng chính sách sẵn có "Quản trị TLHP – email được phép" (`30991a9d…`). Lưu ý: Access đặt trước admin sẽ chặn người biên tập không có trong chính sách; quyết định của chủ site. Admin vẫn có đăng nhập mật khẩu + 2FA tùy chọn.
8. Sau khi mọi người chuyển sang `quantri.`: xóa ứng dụng Access "Admin site cũ" (www `/admin`, `/login`, `/van-hanh`) và kiểm tra `tlhp-admin-guard`.

**Trong V3 (`E:\tlhp-v3-doc`)**

9. `next.config.ts`: chuyển `/quan-tri` và `/quan-tri/:path*` sang `https://quantri.tunglamhoaphuc.com/quan-tri/:path*` (3.3).

### 5.3 Xóa cache công khai khi admin ghi (B8 cũ của www)

Admin ghi xong gọi `revalidatePath("/", "layout")` và `bumpContentEpoch()` (`api/quan-tri/v1/[...path]/route.ts:54-64`), nhưng việc đó **chỉ tác động tới Worker `tlhp-web`**. Sau chuyển, trang công khai là V3, nên sửa ở admin chỉ tới V3 qua đồng hồ của V3: `D1_RENEW_MS = 15 giây` (`src/lib/tlhp-content/repository.ts:253`) và `revalidate = 30/60` của từng trang (`bao-tuong[slug]` 60, `dong-chay [slug]` 30, trang chủ 60...). Tức là bài vừa xuất bản hiện ra **chậm nhất khoảng 45–75 giây** (trước đây gần như tức thì nhờ `affectsPublicSite`, `src/admin/http/publicEffect.ts`). `docs/admin-cho-v3.md:41` đã ghi nhận.
Đề xuất hai bước:
- **Giai đoạn 1 (chấp nhận được)**: giữ nguyên và ghi dòng hướng dẫn trong giao diện xuất bản: "Bài hiện trên web trong khoảng 1 phút". Không đổi mã.
- **Giai đoạn 2 (khi có thời gian)**: thêm vào V3 một route `POST /api/revalidate` (chỉ nhận khi có chữ ký HMAC bằng bí mật dùng chung, binding mới `REVALIDATE_SECRET` ở cả hai Worker) gọi `revalidatePath("/", "layout")` và `bumpContentEpoch()`; ở `route.ts:57-63` của admin, sau khi xóa cache cục bộ, gọi `fetch("https://www.tunglamhoaphuc.com/api/revalidate")` trong `waitUntil`. ⚠️ `bumpContentEpoch` chỉ có tác dụng trong **một** isolate; cache của vùng (Workers Cache) mới là phần đáng xóa, và chưa xác nhận `revalidatePath` của vinext xóa cache toàn cầu hay theo vùng: cần thử trên `thu.` trước khi hứa "tức thì".

### 5.4 Điều admin không làm được sau chuyển

- **Xem trước nháp** vẫn dùng giao diện Bexon của www (`SiteShell` ở `xem-truoc/[loai]/[id]/page.tsx:9,60,91`), không phải V3: bản xem trước không giống trang thật. Tùy chọn sau này: route `/xem-truoc` của V3 xác thực token đã ký bằng cùng `ADMIN_JWT_SECRET` (cần thêm bí mật vào V3 và đọc nháp từ D1). Không bắt buộc cho đợt chuyển; **phải nói rõ với người biên tập**.
- Admin lưu địa chỉ ảnh dạng **tương đối** `/anh-goc/<bucket>/cms/<id>/v<n>/<tên>` (`admin/media/ids.ts:8-9`, `media/store.ts`); R2 `tlhp-media` dùng chung nên ảnh vừa tải lên hiện ngay ở V3 và `/anh-goc` của V3 chạy giống www.
- Nội dung bài cho phép ảnh/âm thanh `/anh-goc/...` và ảnh `/brand/...` (`admin/content/html.ts:211-215`): cần `public/brand` ở V3 (B6).
- Mã đọc nội dung của V3 là **bản chép** của www (`src/lib/tlhp-content` ← `src/libs/content`, chỉ khác dòng import). Mỗi lần schema/trình đọc D1 của www đổi, phải chép lại và chạy test V3 với `TLHP_REAL_DB`/`TLHP_WWW_SRC` (`docs/admin-cho-v3.md:44-46`). Đây là món nợ bảo trì kéo dài sau chuyển.

---

## 6. Rủi ro khi đổi DNS và Custom Domain trong Cloudflare Workers

Các điểm ⚠️ là suy luận từ tài liệu và kinh nghiệm chuyển www ngày 20/11; **chưa ai chạy cho cặp Worker này**, nên bắt buộc diễn tập trên một tên miền thử (vd `thu.tunglamhoaphuc.com`).

1. **Một Custom Domain chỉ thuộc một Worker.** Gắn `www` cho `tlhp-v3` khi `tlhp-web` còn giữ nó có thể bị từ chối (đúng như `chuyen-www.md` bước 3 ghi: "Cloudflare có thể từ chối thay vì ghi đè"). Cách gắn (`domains` trong `cloudflare.config.ts` rồi `deploy`) tự tạo bản ghi DNS proxied và chứng chỉ. ⚠️ Giữa lúc gỡ khỏi `tlhp-web` và gắn vào `tlhp-v3` có khoảng trống (vài chục giây đến vài phút): khách thấy lỗi Cloudflare (522/1xxx). Làm ngoài giờ lễ, hai lệnh liền nhau, đo thời gian khi diễn tập; đo xem có cách gắn sang không cần gỡ trước (ví dụ nút "chuyển/override" ở bảng điều khiển).
2. **Routes khác Custom Domains.** Zone có thể còn route Worker cũ: `tlhp-admin-guard` `www.tunglamhoaphuc.com/api/*` (`admin-cu.md`). Nếu còn, nó chặn mọi POST công khai của V3 (B5/3.3). Liệt kê routes của zone, gỡ nếu còn.
3. **Cloudflare Access** gắn theo host/đường dẫn nên vẫn áp dụng sau khi đổi Worker (`www/admin`, `www/login`, `www/van-hanh`, `beta.` toàn bộ). Không gây hỏng nhưng cần dọn (5.2.8). **Không** tạo ứng dụng Access phủ cả `quantri.*` nếu `/api/quan-tri/*` phải gọi từ trình duyệt mà người dùng chưa qua Access (sẽ nhận trang đăng nhập thay JSON).
4. **Cache cũ.** Trang do `tlhp-web` dựng có thể còn nằm trong Workers Cache/CDN của vùng đến 5 phút (`revalidate = 300` của www) cộng "stale-while-revalidate". Ngay sau khi gắn, kiểm bằng `curl -sI`/`CF-Cache-Status`/nội dung (giao diện V3 hay Bexon). Sau khi chuyển: **Purge Everything** (Caching → Configuration, gói Free cho phép) rồi kiểm lại; làm tương tự khi quay lại. Ảnh `/cdn-cgi/image/*` và `/anh-goc/*` không đổi (cùng R2), được giữ lại; các tệp `_next/static` của hai bản build có tên băm khác nhau nên không đụng nhau.
5. **HSTS**: `www` đã gửi `max-age=31536000` (không `includeSubDomains`, không preload) nên trình duyệt cũ đã nhớ HTTPS-only cho `www`. Không có lối quay về HTTP; mọi host con (`quantri.`, `v3.`) tự do. Đừng thêm `includeSubDomains` ở V3.
6. **Tên miền gốc**: bản ghi A `76.76.21.21` (Vercel) đã được thay khi chuyển www sang `tlhp-web` (20/11), nên gốc hiện là Custom Domain của `tlhp-web`. Dùng Redirect Rule (3.2); ⚠️ nếu Redirect Rule chạy ở rìa thì có thể không cần gắn gốc cho Worker nào, chỉ cần một bản ghi DNS proxied.
7. **Chứng chỉ**: Universal SSL cover `tunglamhoaphuc.com` và `*.tunglamhoaphuc.com` một cấp: `quantri.`, `www.`, `v3.`, `thu.` đều hợp lệ.
8. **Search Console / Google**: sitemap vẫn là `https://www.tunglamhoaphuc.com/sitemap.xml` (`chuyen-www.md` bước 6 chỉ ghi "cần gửi"; chủ site kiểm đã gửi chưa). Không cần "Change of Address" vì host không đổi. Sau chuyển: gửi lại sitemap, kiểm "Page indexing" và "Crawl stats" sau 48 giờ; theo dõi `5xx` ở Workers Logs.
9. **Chênh lệch giao diện**: trang chủ V3 khác hẳn bản Bexon (đã quen thuộc với khách). Thông báo nội bộ trước khi chuyển.
10. **Rủi ro CPU/503** (B9): `tlhp-v3` ở cùng tài khoản gói Workers Paid, nhưng đo thấy 503 ngẫu nhiên khi nhiều yêu cầu song song. Tra `cf o11y telemetry query --profile tlhp` (mẫu ở bộ nhớ dự án) tìm sự kiện `exceededCpu`, lỗi D1 ("too many requests", "database busy"), `Worker threw exception`.

### Quay lại (rollback)

- Giữ `tlhp-web` **nguyên vẹn** (đủ route công khai) và `v2.` còn chạy trong ít nhất 14 ngày sau chuyển: đó là bản dự phòng một bước.
- Quay lại: (1) gỡ `www` và gốc khỏi `domains` của `tlhp-v3`, deploy lại; (2) thêm lại `www`, gốc vào `domains` của `tlhp-web`, deploy lại với `TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com` (admin **vẫn ở `quantri.`**, không cần dời lại); (3) Purge Everything; (4) kiểm lại. Nếu còn kẹt ở bước (2), phương án cuối là bản DNS đã xuất (`docs/van-hanh/dns-truoc-khi-chuyen-www-2026-11-20.zone` là bản của lần trước; làm bản mới ngay trước khi chuyển).
- Bản Worker để lùi: ghi `cf workers deployments list --worker tlhp-web --profile tlhp` và `--worker tlhp-v3` ngay trước khi chuyển (hôm nay: `tlhp-web` www **ac9b547c** hoặc **edd6b3a4** theo ghi chú, V3 `175a956a`; lấy lại số thật).

---

## 7. Hiệu năng: www ~90, V3 ~98 (22/11)

Không đo PageSpeed được hôm nay (API trả 429 vì hết hạn mức ngày). Số đo bù bằng `curl` trên trang chủ live (23/11, nén brotli):

| | V3 | www |
|---|---|---|
| HTML (brotli) | 29,2 KB | 28,2 KB |
| JS tải (module + modulepreload) | 41 tệp, ~214 KB | 22 tệp, ~209 KB |
| CSS | 1 tệp 34 KB | 1 tệp 77 KB |
| Thẻ `<img>` trong HTML | 38 (36 `loading="lazy"`) | 87 |
| Nguồn ngoài | `fonts.googleapis.com`, `fonts.gstatic.com`, ảnh logo/biểu tượng từ B2 | không (phông tự lưu) |
| Phông tải trước | 2 tệp TTF (UTMNiagara 34 KB, UTMClassizismAntiqua 47 KB) + Google Fonts CSS (3 họ, 10 trọng lượng) nạp bằng script | 10 tệp woff2 tự lưu |
| Cache tệp tĩnh (`/images`, `/fonts`, `/tibetan-study`) | `public, max-age=0, must-revalidate` (đo) | 30 ngày + 7 ngày (`public/_headers`) |

### 7.1 Thứ có thể làm tụt điểm so với 98 (do thay đổi 23/11)

Từ `b2469ee` ("trang chủ nhẹ hơn trên điện thoại", đợt đo 98) đến nay trang chủ thêm: `Hero.tsx` +246 dòng (nhiều khung, video), `WelcomeSection.tsx` (mới, 200 dòng), `QuotesSection.tsx` (mới, 188), `Header.tsx` +61, `WelcomeNoticeModal.tsx` +65, `Footer.tsx` đổi 286 dòng (`git diff --stat b2469ee..HEAD`: 1.113 dòng thêm, 729 bớt).
Nghi phạm cụ thể:

1. **`lunar-javascript` (~38 KB brotli, chunk `gd5RXz8G.js`) nằm trong gói tải trước của trang chủ**: `CalendarSection.tsx` (client) nhập `@/lib/lunar-calendar` (`:21-24`) và `@/lib/v3-calendar` (nhập `convertSolarToLunar`, `v3-calendar.ts:14`). Đề xuất: tính âm lịch của tháng đang hiển thị ở máy chủ rồi đưa xuống dạng dữ liệu, hoặc nạp động (`import()`) khi cuộn tới phần lịch.
2. **Ảnh chặn LCP từ nguồn thứ ba**: hai `<link rel="preload" as="image">` trỏ thẳng B2 (`logo-moc-an.webp`, `bieu-tuong-tong-chi-tu-hoc-...webp`), nên mở thêm kết nối. Dùng `/brand/logo-moc-an-200.webp` cục bộ (có sẵn ở www) và `/images/icons/...`.
3. **Phông**: Google Fonts hai miền + hai TTF chưa nén. Chuyển sang woff2 tự lưu (Montserrat/Playfair/Noto Serif, chỉ các trọng lượng dùng) và bỏ tải trước hai TTF; hoặc `font-display: swap` + subset latin/vietnamese.
4. **Cache tệp tĩnh**: thêm `public/_headers` giống www (`/_next/static/*`, `/images/*`, `/brand/*`, `/tibetan-study/*`, `/fonts/*`, `/*.TTF`); thêm `!/images/*` và `!/brand/*` vào `runWorkerFirst` (`cloudflare.config.ts:22`) để không tốn CPU Worker cho ảnh tĩnh. `/images/[...path]/route.ts` của V3 vẫn còn cho đường dẫn không có tệp (Worker được gọi khi không tìm thấy tài sản).
5. **Số tệp JS** (41 so với 22): nhiều chunk nhỏ; gộp bằng cấu hình chunk của Vite nếu cần. Ít ảnh hưởng điểm.
6. HTML ~220 KB chưa nén (cả hai bằng nhau): dữ liệu RSC của trang chủ; theo dõi khi `loadHomeWelcome/Quotes/News` lớn lên.
7. Trang 404 nặng (có Header, Footer, `SmartSearchAIBar`): ít ảnh hưởng.

### 7.2 Làm gì để chắc

Sau khi sửa mục 7.1 (1–4), đo lại bằng PageSpeed/Lighthouse mobile trên `v3.` vài lần; mục tiêu ≥ 93 (không thấp hơn www ~90). Đo cả `/dong-chay-hoang-phap/<bài>` và `/bao-tuong/<tượng>`. Playwright `image-budget`, `performance`, `edge-cache` của www (`tests/e2e`) là mẫu cho ngân sách ảnh/cache nên sao sang V3.

### 7.3 Độ ổn định dưới tải

Quét toàn bộ 829 địa chỉ của sitemap www (không kể `/`), 8 luồng, từng host: www 829/829 trả 200, TB 0,32 giây, tối đa 1,55 giây; V3 816 × 200, 1 × 307 (`/lich-tu-hoc`), 1 × 308, 1 × 404 (`/lien-he`), **10 × 503**, TB 0,61 giây, tối đa 1,95 giây. Lần quét đầu có 7 × 503. Các địa chỉ 503 đổi từ lần này sang lần khác (`/dong-chay-hoang-phap/...`, `/bao-tuong/...`, `/vu-tru-phat-giao/tu-an`, `/lich-tu-hoc/...`), trả lời nhanh (0,2 giây) và thử lại từng cái đều 200: giống lỗi Worker/D1 khi nhiều isolate lạnh cùng đọc. Điều tra trước khi chuyển (Workers Logs) và thử lại với 4 luồng để biết ngưỡng.

---

## 8. Danh sách việc theo thứ tự

> Mọi lệnh bên dưới **chưa chạy**. Theo `CLAUDE.md`: không deploy hay đổi Cloudflare khi chủ dự án chưa đồng ý từng lần; không đổi gói cước. Deploy từ worktree sạch; dùng `npx cf auth activate tlhp <thư mục>` rồi `npx cf auth deactivate <thư mục>` (hồ sơ `tlhp` chỉ gắn với `E:\tlhp-x`).

### 8.1 Việc phải làm trước khi chuyển

**V3 (nhánh mới từ `fix/v3-doc`, rồi PR vào `v3`)**

1. Chép từ www: `src/libs/hosts.ts`, `robotsExtra.ts`, `seo.ts` (phần JSON-LD), `JsonLd.tsx`, `config/site.ts` (hoặc nguồn tương đương), `app/favicon.ico`, `app/manifest.ts`, `public/brand/**`, `public/_headers`.
2. `layout.tsx`: bỏ noindex (`:15-16`), `metadataBase` → `https://www…`, thêm `alternates.canonical "./"`, `openGraph`, `twitter`, `icons`, `manifest`, `viewport` (1, 2.1).
3. `next.config.ts`: thêm `SECURITY_HEADERS` (HSTS, XFO, COOP, nosniff, Referrer-Policy), `X-Robots-Tag` theo host, chuyển tên miền gốc → www, chuyển `/quan-tri[/...]` → `quantri.` (3.1–3.3).
4. Thêm `robots.ts`, `sitemap.ts`; `Disallow` `/tra-cuu-bai-vi`, `/kiem-tra-anh`, `/api/`, `/anh-goc/`, `/cdn-cgi/` (1.2).
5. Trang `/lien-he` (B1) và quyết định `/tim-kiem`; sửa `menuHref` (`v3-menu.ts:13,28`) để không đẩy sang `www`; sửa test `v3-chrome*`.
6. Metadata cho các trang danh sách + `bao-tuong/[slug]` + `lich-tu-hoc/[slug]` (2.2); JSON-LD (2.4); `V3_ORIGIN` → `PUBLIC_ORIGIN` (2.3); `/bao-tuong-phat-giao/[slug]` → 308 về `/bao-tuong/{slug}`; quyết định `/lich-tu-hoc` (2.1).
7. Chép giới hạn tần suất sang 4 API Tạng và `/api/tts/vi` (4.3); chép test.
8. Gỡ `SmartSearchAIBar` giả (hoặc nối thật) (4.4.1); xử lý `/api/memorials` và `robots` cho `/tra-cuu-bai-vi` (4.4.2); xóa `/kiem-tra-anh`, `public/review_statues.html` (4.4.3); xóa 4 route `/api/admin/*` thừa, đổi tên hai route còn lại (4.4.4).
9. Hiệu năng 7.1 (1–4); đo lại PageSpeed (7.2).
10. Tìm nguyên nhân 503 (7.3).
11. Chạy `npm test` (V3) và, với `TLHP_REAL_DB`/`TLHP_WWW_SRC`, bộ test tương đương www; thêm test mục 1.2 (5).
12. **Kiểm tương đương địa chỉ**: dựng V3 mới, so sitemap V3 với sitemap www (lệnh dưới); mọi địa chỉ của www phải 200 (hoặc 301/308 có chủ ý) ở V3 sau khi sửa.

**tlhp-web (www)**

13. Sửa liên kết "Xem trên trang" thành tuyệt đối (5.2.4); thêm `/` → `/quan-tri` cho host `quantri.` (5.2.5); cập nhật `CLAUDE.md` và `docs/van-hanh/d1.md`.
14. Giai đoạn 1 (admin sang `quantri.`) triển khai **riêng**, trước ngày chuyển www (xem 8.2), vì đảo ngược được.

**Cloudflare / chủ tài khoản**

15. Xuất DNS (`npx cf dns records export --zone tunglamhoaphuc.com --profile tlhp`), ghi phiên bản Worker hiện tại của `tlhp-web` và `tlhp-v3`.
16. Liệt kê routes của zone; xác nhận `tlhp-admin-guard` không còn route `www/api/*`.
17. Tạo Redirect Rule gốc → www giữ chuỗi truy vấn (3.2).
18. Diễn tập đổi tên miền giữa hai Worker trên `thu.tunglamhoaphuc.com`, đo khoảng trống và cách gắn.
19. Thông báo người biên tập: địa chỉ admin mới, đăng nhập lại, bản xem trước vẫn kiểu cũ, độ trễ ~1 phút.
20. Ban Trị Sự duyệt V3 (điều kiện 4 của `chuyen-www.md`).

### 8.2 Lệnh chuyển (khi mọi mục 8.1 xong và chủ dự án đồng ý)

Giai đoạn 1: dời admin (đảo ngược được, www vẫn chạy `tlhp-web`)
```powershell
# trong worktree sạch E:\tlhp-av3, cloudflare.config.ts: domains = quantri., v2., www., apex
$env:TLHP_ADMIN="1"; $env:ADMIN_BASE_URL="https://quantri.tunglamhoaphuc.com"; npm run deploy:v2
curl.exe -sI https://quantri.tunglamhoaphuc.com/quan-tri/dang-nhap      # 200
curl.exe -s -o NUL -w "%{http_code}`n" https://www.tunglamhoaphuc.com/quan-tri/dang-nhap   # 404 (host sai)
# đăng nhập thử, tạo/sửa một bài nháp, mở bản xem trước
```
Giai đoạn 2: V3 thành trang chính (ngoài giờ lễ)
```powershell
# 1. tlhp-web: bỏ www và apex khỏi domains, deploy (giữ TLHP_ADMIN và ADMIN_BASE_URL quantri.)
# 2. NGAY SAU ĐÓ, tlhp-v3 (E:\tlhp-v3-doc): cloudflare.config.ts domains = www., apex, v3.
npm run deploy      # = node scripts/deploy.mjs, nguồn nội dung d1
# 3. Purge Everything ở Cloudflare (Caching → Configuration)
```

### 8.3 Kiểm sau chuyển (trong 5 phút, rồi 24 và 48 giờ)

```bash
for p in / /gioi-thieu /dong-chay-hoang-phap /lich-tu-hoc/le-quy-y-tam-bao-thang-9-binh-ngo /lien-he /sitemap.xml /robots.txt /favicon.ico /manifest.webmanifest; do
  echo "$p $(curl -sS -o /dev/null -w '%{http_code}' https://www.tunglamhoaphuc.com$p)"; done
curl -sI https://www.tunglamhoaphuc.com/ | grep -iE "x-robots|strict-transport|x-frame|cross-origin"   # không có X-Robots-Tag; có HSTS
curl -s https://www.tunglamhoaphuc.com/ | grep -o '<meta name="robots"[^>]*>'                          # không có
curl -s https://www.tunglamhoaphuc.com/ | grep -o '<link rel="canonical"[^>]*>'                        # có
curl -sI "https://tunglamhoaphuc.com/tim-kiem?q=niem+phat"                                              # 301 tới www, giữ ?q=
curl -sI https://v3.tunglamhoaphuc.com/ | grep -i x-robots                                              # noindex
curl -sI https://www.tunglamhoaphuc.com/quan-tri/dang-nhap | grep -i location                           # tới quantri.
curl -s -X POST -H 'content-type: application/json' -d '{}' -o /dev/null -w '%{http_code}\n' https://www.tunglamhoaphuc.com/api/analyze   # 400 (không phải 403)
```
- Quét toàn bộ sitemap (cùng cách đã dùng ở phụ lục A) và so với danh sách trước chuyển: mọi địa chỉ 200, 5xx < 0,1%.
- Chạy `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke seo` của www (có thể phải chỉnh vì giao diện khác) hoặc bộ tương đương của V3.
- Mở bằng điện thoại: trang chủ, một bài, Lịch tu học, Liên hệ, `hoc-tieng-tang`.
- Admin ở `quantri.`: đăng nhập, xuất bản một bài, kiểm hiện ở www sau ≤ 75 giây (và thông báo cho người biên tập).
- Workers Logs của `tlhp-v3` ở 24/48 giờ: `exceededCpu`, 5xx, lỗi D1; Cloudflare Analytics: tỷ lệ 404 không tăng.
- Search Console: gửi `https://www.tunglamhoaphuc.com/sitemap.xml`, Rich Results Test cho một bài và một sự kiện; "Page indexing" sau 48 giờ.
- PageSpeed mobile trên `/` và một bài (≥ 93).
- Giữ `v3.` (noindex) và `v2.` (noindex, `tlhp-web`) tới khi hết cửa sổ quay lại (14 ngày), rồi mới gỡ `v2.`.

### 8.4 Rollback

1. Gỡ `www` và gốc khỏi `domains` của `tlhp-v3`; deploy lại (`npm run deploy`).
2. Thêm lại `www` và gốc vào `domains` của `tlhp-web`; deploy lại với `TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com npm run deploy:v2` (admin không dời lại).
3. Purge Everything.
4. Kiểm: `/` trả giao diện Bexon, `/lien-he` 200, `/sitemap.xml` 200, `x-robots-tag` không có, đăng nhập `quantri.` vẫn được.
5. Nếu 1–2 không giải quyết: phục hồi DNS từ bản xuất mới (mục 8.1.15).
6. Ghi lại nguyên nhân; D1 và R2 không bị đụng nên không cần Time Travel.

---

## Phụ lục A. Số đo ngày 23/11/2026

- **So địa chỉ**: sitemap www có 830 địa chỉ (472 `dong-chay-hoang-phap`, 160 `tri-tue-phat-phap`, 126 `bao-tuong`, 25 `tong-chi-tu-hoc`, 18 `lich-tu-hoc`, 14 `vu-tru-phat-giao`, 6 `gioi-thieu`, 9 trang gốc). Trên V3: 820 × 200; `/lien-he` 404; `/lich-tu-hoc` 307 → `https://v3…/#lich-tu-hoc`; `/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam` 308 → `…/tiep-buoc-thay-toi`; 7 × 503 lần đầu (thử lại đều 200).
- **Quét lần hai (829 địa chỉ, 8 luồng)**: www 829 × 200, TB 0,32 giây; V3 816 × 200, 307, 308, 404, 10 × 503, TB 0,61 giây.
- **Tiêu đề**: `/tong-chi-tu-hoc` www "Tông Chỉ Tu Học – Tùng Lâm Hòa Phúc", V3 "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc"; `/bao-tuong-phat-giao` tương tự.
- **Tiêu đề HTTP trang chủ**: www có HSTS, `X-Frame-Options`, COOP, `nosniff`, `Referrer-Policy`; V3 không có cái nào. `v2.` có `X-Robots-Tag: noindex, nofollow`.
- **`/robots.txt` V3**: chỉ chú thích của Cloudflare, không `User-agent`/`Disallow`; www: `Allow: /`, `Disallow: /tim-kiem, /cdn-cgi/, /anh-goc/, /styleguide, /api/`, `Sitemap`.
- **Host**: `quantri.` 403 (chưa cấu hình), `beta.` Access, `admin.`/`old.` 200 (WordPress), `v2.` 200 noindex.
- **Công cụ hạn chế**: không chạy được PageSpeed (hết hạn mức API) và không có quyền đọc Workers Logs/cấu hình Cloudflare trong lần rà soát này; các nhận định về route của zone, `tlhp-admin-guard`, và đổi Worker cho một tên miền đều **cần xác minh trong bảng điều khiển**.

---

## Phụ lục B. Đã làm trong mã V3: lập chỉ mục, metadata, tiêu đề, chuyển hướng (23/11/2026)

> Chỉ mã và kiểm thử; **chưa deploy, chưa đổi gì trên Cloudflare**. Kiểm thử: `tests/unit/v3-next-config.test.ts`, `tests/unit/v3-indexing.test.ts`, `tests/unit/v3-seo.test.ts`.

| Việc (mục trên) | Làm ở đâu | Hành vi |
|---|---|---|
| 1.2 lập chỉ mục theo host | `next.config.ts` `headers()`; `src/lib/v3-hosts.ts`; `src/app/layout.tsx` | www và tên miền gốc được lập chỉ mục; mọi host khác nhận `X-Robots-Tag: noindex, nofollow` (điều kiện `missing` host, như www). Layout **không** còn `robots` và không đọc host. |
| 1.2 robots.txt | `src/app/robots.ts`, `src/lib/v3-robots.ts`, `src/lib/robots-extra.ts` | Host công khai: `Allow: /`, `Disallow` `/tim-kiem`, `/cdn-cgi/`, `/anh-goc/`, `/styleguide`, `/api/`, `/tra-cuu-bai-vi`, `/kiem-tra-anh` cộng dòng admin thêm (SEO > robots.txt, đọc `seo.defaults`), kèm `Sitemap: https://www.tunglamhoaphuc.com/sitemap.xml`. Host khác: `Disallow: /`. |
| 1.2 sitemap | `src/app/sitemap.ts`, `src/lib/v3-sitemap.ts` | `revalidate = 3600`, không đọc host, mọi địa chỉ `https://www…`. Cùng tập với sitemap www trừ `/lich-tu-hoc` (V3 chuyển hướng) và địa chỉ đã chuyển (Tông Chỉ ghi `tiep-buoc-thay-toi`). `/lien-he` có trong danh sách cố định (trang do việc khác thêm). Slug emoji viết hoa `%XX` (www sitemap viết thường): cùng một địa chỉ, nhưng so chuỗi với sitemap www sẽ lệch ở ~11 dòng. |
| 2.1 canonical, og | `src/lib/site-url.ts`, `src/lib/v3-seo.ts`, `layout.tsx` | `metadataBase` = `https://www.tunglamhoaphuc.com`; canonical `"./"` mặc định; mỗi trang danh sách/chi tiết tự đặt canonical tuyệt đối (không chuỗi truy vấn), `og:url`, `og:image` tuyệt đối trên www (không còn `v3.`), `og:title`, twitter; trang không có ảnh dùng `/brand/og-tung-lam-hoa-phuc.jpg`. |
| 2.2 tiêu đề | các `page.tsx` dưới `(public)`; `hoc-tieng-tang/layout.tsx` (trang này là thành phần trình duyệt nên metadata đặt ở layout) | Trang chủ, `/gioi-thieu`, `/tong-chi-tu-hoc`, `/dong-chay-hoang-phap`, `/vu-tru-phat-giao`, `/bao-tuong-phat-giao`, `/tri-tue-phat-phap`, học tiếng Tạng, 6 chủ đề tĩnh, `bao-tuong/[slug]` (SEO title/description của tượng), `lich-tu-hoc/[slug]` đều có `<title>` riêng. Dạng tiêu đề giữ `Tên | Tùng Lâm Hòa Phúc` của V3 (www dùng `Tên – Chuyên mục – Tùng Lâm Hòa Phúc`). |
| 2.4 JSON-LD | `src/lib/v3-jsonld.ts`, `src/components/public/JsonLd.tsx` | Trang chủ: `Organization/BuddhistTemple`; bài Dòng Chảy và Trí Tuệ: `Article` + `BreadcrumbList`; sự kiện: `Event`; Giới thiệu, Tông Chỉ, khu vực, bảo tượng: `BreadcrumbList`. `placeJsonLd()` đã có sẵn cho trang `/lien-he` (việc khác). |
| 3.1 tiêu đề bảo mật | `next.config.ts` | HSTS `max-age=31536000` (không `includeSubDomains`), `X-Frame-Options: SAMEORIGIN`, COOP `same-origin`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` trên mọi host. Chỉ áp cho gì Worker trả; tệp tĩnh đi thẳng từ kho nên nhận `Cache-Control` ở `public/_headers`. |
| 7.1.4 cache tĩnh | `public/_headers`, `cloudflare.config.ts` `runWorkerFirst` | `/_next/static`, `/images`, `/fonts`: `public, max-age=31536000, immutable`; `/brand`, `/tibetan-study`, `/*.TTF`: một ngày + `stale-while-revalidate` một tuần. `/images/*` và `/brand/*` rời khỏi `runWorkerFirst` (nếu không `_headers` không có tác dụng và tốn CPU Worker). **Ảnh hay phông trong `public/images` và `public/fonts` thay nội dung thì phải đổi tên tệp**, nếu không khách cũ giữ bản cũ tới một năm. |
| 3.2, 3.3 chuyển hướng | `next.config.ts` `redirects()` | `/quan-tri`, `/api/quan-tri`, `/admin`, `/login`, `/van-hanh` (và `/:rest*`) sang `https://quantri.tunglamhoaphuc.com` cùng đường dẫn, 307, chỉ trên host công khai, đặt trước luật tên miền gốc. Tên miền gốc sang `https://www.tunglamhoaphuc.com/:path*`, 308, chỉ trên tên miền gốc. |
| 2.1 một tượng một địa chỉ | `next.config.ts` | `/bao-tuong-phat-giao/:slug` sang `/bao-tuong/:slug` và `/bao-tuong` sang `/bao-tuong-phat-giao`, 308 (hai trang cũ trở thành mã không dùng tới). |

### B.1 Địa chỉ bài theo mã cũ (18 địa chỉ, mục D7 của `doi-chieu-url-www-v3.md`): chọn 301 về địa chỉ bằng slug

Bằng chứng: `data/snapshot/posts.json` của www có id `post-17649` với slug `17649-2` ngay từ dữ liệu WordPress đã nhập (cả 18 bài đều dạng `<mã>-2`), nên `/dong-chay-hoang-phap/17649` **chưa từng là địa chỉ công khai**; www trả 404 và Google không có gì để giữ. V3 trả 200 ở đó chỉ vì `livePost` (`src/lib/v3-live.ts`) còn tìm bài theo id (`post-<mã>`). Giữ hai địa chỉ cùng 200 là nội dung trùng; 404 thì làm hỏng liên kết theo mã (nếu còn) mà không được gì. Làm: `src/lib/v3-canonical.ts` `legacyIdTarget`, gọi ở `dong-chay-hoang-phap/[slug]` và `tri-tue-phat-phap/[slug]` với `permanentRedirect`; canonical của bài luôn là địa chỉ bằng slug thật. Chỉ số thuần (`17649`, `post-17649`) mới chuyển.

### B.2 Chuyển tên miền gốc: Redirect Rule của Cloudflare là cửa tốt hơn, luật trong ứng dụng chỉ là dự phòng

Luật `tunglamhoaphuc.com/:path*` trong `next.config.ts` **làm mất chuỗi truy vấn** (vinext không mang `?q=…` sang host khác; đã đo ở mục 3.2). Redirect Rule (Single Redirect) ở Cloudflare cho `http.host eq "tunglamhoaphuc.com"` sang `concat("https://www.tunglamhoaphuc.com", http.request.uri.path)` với **Preserve query string**, 301, chạy ở rìa trước Worker, là cửa chính; tạo trước khi chuyển DNS. Cùng lý do, `?token=` của thư đặt lại mật khẩu mất khi `/quan-tri` chuyển sang `quantri.` (mục 3.3); thư mới mang địa chỉ `quantri.` ngay.

### B.3 Cần làm ở phía Cloudflare (không làm được trong mã)

1. Redirect Rule tên miền gốc giữ chuỗi truy vấn (B.2).
2. Sau khi gắn `www` cho `tlhp-v3`: **Purge Everything**, rồi kiểm `/robots.txt` (phải ra nội dung của `robots.ts`: nếu thấy chú thích "content signals" của Cloudflare chèn thêm hay đè lên, kiểm mục quản lý robots.txt của Cloudflare AI Crawl Control), `/sitemap.xml`, `curl -I` có HSTS và không có `X-Robots-Tag` ở `www`, có `noindex` ở `v3.`.
3. Gỡ route `www/api/*` của `tlhp-admin-guard` (nếu còn) và dọn ứng dụng Access "Admin site cũ" (mục 3.3).
4. Gửi lại `https://www.tunglamhoaphuc.com/sitemap.xml` ở Search Console sau khi chuyển.
