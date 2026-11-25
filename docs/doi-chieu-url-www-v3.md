# Đối chiếu URL: www.tunglamhoaphuc.com và v3.tunglamhoaphuc.com

Đo ngày 23/11/2026 (bắt đầu lúc 04:46 UTC). Chỉ gửi yêu cầu GET, HEAD và OPTIONS bằng chương trình đọc không đăng nhập, không gửi biểu mẫu, không POST; ba luồng song song, nghỉ 0,12 giây giữa các yêu cầu; không theo chuyển hướng (ghi lại đích). Mọi con số dưới đây là số đo thực tế trong lần chạy này; chỗ nào không đo được thì ghi rõ ở mục 9.

Mục tiêu: khi V3 thay www làm trang chính thì URL công khai nào của www sẽ hỏng hoặc đổi hành vi (SEO, đường dẫn đã lưu).

## 1. Kết luận ngắn

- **Bài viết, trang chuyên mục, bảo tượng, tông chỉ tu học, giới thiệu: V3 có đủ.** Trong 830 URL của sitemap www, 827 URL trả 200 trên V3; 3 URL còn lại ở mục C.
- **Chưa thể chuyển nếu chưa sửa các điểm chặn ở mục C và D**: thiếu `/lien-he`, `/sitemap.xml`, `robots.txt` đúng nội dung, `/favicon.ico`, `/manifest.webmanifest`, thư mục `/brand/*`, `/tim-kiem`, trang danh sách `/lich-tu-hoc` (đang chuyển 307 về trang chủ), toàn bộ `/quan-tri` và `/api/quan-tri`; và V3 đang đặt `noindex, nofollow` trên mọi trang, không có thẻ canonical.
- Tiêu đề trang (`<title>`) khác nhau ở 956 trong 958 trang HTML so sánh được (V3 dùng dạng `Tên bài | Tùng Lâm Hòa Phúc`, www dùng `Tên bài – Chuyên mục – Tùng Lâm Hòa Phúc`; 281 trang V3 mang tiêu đề chung "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc"). Thẻ `<h1>` giống nhau ở 947 trong 958 trang (không phân biệt hoa thường).

## 2. Phạm vi đã so sánh

| Nguồn URL | Số URL | Ghi chú |
|---|---:|---|
| Sitemap www (`/sitemap.xml`) | 830 | đủ 830 thẻ `<loc>` |
| Liên kết trong trang www (menu, chân trang, nút phân trang, bộ lọc, tệp tĩnh) chưa có trong sitemap | 67 | lấy từ href/src của 830 trang www; chưa tính ảnh `/anh-goc` và `/cdn-cgi` (xem dưới) |
| URL thăm dò do tôi thêm (robots, WordPress cũ, API, dấu `/` cuối, chữ hoa, `-2` bỏ đuôi, quét phân trang, `?q=`, `?sap-xep=`) | 189 | |
| Liên kết chỉ có trong trang V3 (không có trong www) | 75 | chỉ để ghi nhận |
| **Tổng URL đường dẫn đã so sánh (www và V3 cùng được hỏi)** | **1161** | 2322 yêu cầu |
| Ảnh mẫu `/anh-goc/...` và `/cdn-cgi/image/...` (hai máy chủ cùng được hỏi) | 229 | mẫu ngẫu nhiên, không phải toàn bộ: www trỏ tới khoảng 19.666 đường dẫn `/anh-goc` khác nhau trong HTML |

Trong 1161 URL, **1015 URL www trả 200 hoặc chuyển hướng 3xx** (URL thật của www); 146 URL còn lại www trả 404/405 (thăm dò, hoặc liên kết chỉ có ở V3).

Cách chia nhóm (áp dụng cho 1015 URL thật của www):

- **A giống hệt**: cùng mã trạng thái, cùng đích chuyển hướng, cùng loại nội dung; với HTML thì thêm `<title>`, `<h1>`, canonical đều trùng.
- **B khác nhưng vô hại**: cùng trạng thái 200 nhưng `<title>`/`<h1>`/canonical khác (canonical thiếu được tính riêng ở D).
- **C thiếu hoặc khác trên V3**: www trả 200/3xx còn V3 trả 404 hoặc chuyển hướng khác. Đây là điểm chặn.
- **D khác về SEO**: nhóm chồng lên A/B/C, đếm theo hiện tượng (noindex, canonical, robots, sitemap, liên kết trỏ lại www...).

| Nhóm | Số URL |
|---|---:|
| A. giống hệt | 9 |
| B. khác nhưng vô hại | 957 |
| C. thiếu hoặc khác trên V3 | 48 |
| D (riêng): `/robots.txt` cùng 200 nhưng nội dung khác hẳn | 1 |
| **Cộng** | **1015** |

D là nhóm chồng: các hiện tượng D ở mục 6 tác động lên cả những URL đã nằm trong A, B (ví dụ noindex trên 956 trang).

## 3. Nhóm A: giống hệt (9 URL)

| URL | www | V3 |
|---|---|---|
| `/bao-tuong-phat-giao/` | 308 → /bao-tuong-phat-giao | 308 → /bao-tuong-phat-giao |
| `/bao-tuong/` | 308 → /bao-tuong | 308 → /bao-tuong |
| `/dong-chay-hoang-phap/` | 308 → /dong-chay-hoang-phap | 308 → /dong-chay-hoang-phap |
| `/feed/` | 308 → /feed | 308 → /feed |
| `/gioi-thieu/` | 308 → /gioi-thieu | 308 → /gioi-thieu |
| `/lich-tu-hoc/` | 308 → /lich-tu-hoc | 308 → /lich-tu-hoc |
| `/tibetan-study/index.html` | 200 text/html | 200 text/html |
| `/tibetan-study/index.html?v=20260901_1505` | 200 text/html | 200 text/html |
| `/wp-json/` | 308 → /wp-json | 308 → /wp-json |

Hai trang tĩnh `/tibetan-study/index.html` giống từng byte (42.642 byte). Tệp `/tibetan-study/app.js` khác 529 byte (www có xử lý mã 429 giới hạn tần suất, V3 chưa có); `style.css` và `pages/page_1.webp` giống nhau. Không có trang HTML nào của bài viết nằm ở nhóm A vì `<title>` luôn khác.

## 4. Nhóm B: khác nhưng vô hại (957 URL)

| Điểm khác | Số trang HTML (trong 958 so sánh được) |
|---|---:|
| `<title>` khác | 956 |
| `<h1>` khác (không phân biệt hoa thường) | 11 |
| Canonical khác (V3 không có canonical ở cả 958 trang; www có ở 956 trang, trừ 2 trang tĩnh Tibetan) | 956 |

Chín trang có `<h1>` khác thuộc sitemap: trang chủ (`NƠI ĐỂ TA TRỞ VỀ` so với `Tùng Lâm Hòa Phúc – Nơi để trở về, chốn thiêng bình yên`), `/gioi-thieu`, bốn trang `/tong-chi-tu-hoc/lo-trinh-tu-hoc-*` (V3 cắt còn "Lộ Trình Tu Học"), `/tong-chi-tu-hoc/tam-quy`, `/tong-chi-tu-hoc/tam-quy-ngu-gioi-nen-tang-nguoi-phat-tu`, và `/tri-tue-phat-phap/hoc-tieng-tang` (V3 không có thẻ h1).

Ghi nhận thêm (chỉ dòng đầu nằm trong 957; các dòng sau là URL www trả 404 hoặc trả giống V3 nên không thuộc A/B/C):

- `/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam` (trong sitemap): www 200, V3 308 → `/tong-chi-tu-hoc/tiep-buoc-thay-toi` (V3 200, tiêu đề bài "Tiếp Bước Thầy Tôi" giống nội dung www). Chuyển 308 hợp lệ; sitemap V3 nên ghi địa chỉ mới. www không có địa chỉ `/tiep-buoc-thay-toi` (404).
- 18 địa chỉ bài theo mã số cũ (ví dụ `/dong-chay-hoang-phap/17649`, `/tri-tue-phat-phap/4862`): www trả 404 (www chỉ có `.../17649-2`), V3 trả 200 cùng nội dung với bản `-2`. Đây là hai URL cho một bài trên V3, không có canonical (xem D).
- 41 URL www trả 404 nhưng V3 trả 200: 18 bài mã số cũ nói trên, 15 ảnh `/images/icons/*`, 2 phông `/fonts/*.ttf`, 4 API `/api/memorials`, `/api/home/news-carousel`, `/api/public/dharma-featured`, `/api/public/dong-chay` (JSON công khai, GET), `/kiem-tra-anh`, `/tra-cuu-bai-vi`. Là trang/đường dẫn mới của V3; sau khi chuyển chúng sẽ lộ ra trên tên miền chính.
- Dấu `/` cuối, `//` đôi, `/feed/`, `/wp-json/`: hai bên cùng trả 308 về địa chỉ không có dấu `/` cuối (nhóm A).
- 404: hai bên cùng trả 404 với 45 URL thăm dò (WordPress cũ `/wp-content/...`, `/index.php`, `/xmlrpc.php`, `/category/...`, chữ hoa `/GIOI-THIEU`, `-2` bỏ đuôi không có bản gốc, ...). Cùng trả 405 với `GET` vào `/api/analyze`, `/api/ask-ai`, `/api/crop-analyze`, `/api/tts` (OPTIONS cả hai bên cùng 204, `Allow: OPTIONS, POST`).
- `http://` không chuyển sang `https://` ở cả hai (200). Tên miền trần `tunglamhoaphuc.com` chuyển 308 về `www` (đo ở www; V3 không có tên trần).
- Lần chạy gặp 6 lần 503 thoảng qua (5 ở www, 1 ở V3) trên các URL khác nhau; chạy lại từng URL thì đều ra 200/200 hoặc 404/404 (không tính là lỗi).

## 5. Nhóm C: www có, V3 thiếu hoặc khác (48 URL, điểm chặn)

| # | URL | Số URL | www | V3 | Tác động |
|---|---|---:|---|---|---|
| C1 | `/lien-he` | 1 | 200 text/html | 404 text/html | Có trong menu (V3 gắn đường dẫn tuyệt đối `https://www.tunglamhoaphuc.com/lien-he` ở 956 trang), có trong sitemap www. Sau khi chuyển thành liên kết chết. |
| C2 | `/sitemap.xml` | 1 | 200 application/xml | 404 text/html | V3 không có sitemap; www liệt kê 830 URL. Công cụ tìm kiếm mất nguồn báo URL. |
| C3 | `/favicon.ico`, `/manifest.webmanifest`, `/favicon.ico?8a97510a3b4e25ef` | 3 | 200 (`image/x-icon`; manifest `application/manifest+json`) | 404 text/html | V3 không có favicon, manifest, `<link rel="icon">` và `<link rel="manifest">` (trang chủ V3 đã kiểm tra). Biểu tượng tên miền trên kết quả tìm kiếm sẽ mất. |
| C4 | `/brand/og-tung-lam-hoa-phuc.jpg`, `/brand/logo-moc-an.webp`, `/brand/logo-tung-lam-hoa-phuc-tron-nga.webp`, `/brand/favicon/{favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png}`, `/brand/icons/*.webp` (12 tệp) | 18 | 200 (ảnh png, webp, jpg) | 404 text/html | Gồm ảnh chia sẻ trang chủ `/brand/og-tung-lam-hoa-phuc.jpg` (www dùng làm `og:image`), 3 favicon, 2 logo, 12 biểu tượng. |
| C5 | `/tim-kiem`, `/tim-kiem?q=test`, `/tim-kiem?q=`, `/tim-kiem?q=phap+hoi` | 4 | 200 text/html | 404 text/html | Trang tìm kiếm của www (`noindex, follow`, `robots.txt` cũng chặn). Ít ảnh hưởng SEO nhưng mất chức năng. |
| C6 | `/lich-tu-hoc`, `/lich-tu-hoc?loai={cong-tu, khoa-le-truyen-thong, dai-le-su-kien}`, `/lich-tu-hoc?thang={2026-10, 2026-12, 2027-01, 2027-02}` | 8 | 200 text/html | 307 → /#lich-tu-hoc | Trang danh sách lịch tu học (trong sitemap, trong menu www). V3 chuyển **tạm thời (307)** về mục neo trang chủ; bộ lọc `?loai=` và `?thang=` cũng bị chuyển như vậy. Các trang chi tiết `/lich-tu-hoc/<slug>` vẫn 200. |
| C7 | `/images/hero/toan-canh-chua-{1920, doc-760, nho}.webp`, `/images/shape/{pattern-2, pattern-3}.webp`, `/images/shape/{shape-blur, star}.svg`, `/images/404/error.webp` | 8 | 200 (ảnh webp, svg) | 307 → kho B2 `media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/...` (đích 404) | Tệp tĩnh www đang phục vụ. V3 chuyển 307 sang kho B2 `.../tunglamhoaphuc2/hero|shape|404/...`, **đích trả 404** (đã kiểm tra cả 9 đích). Chỉ trang www dùng các ảnh này; không phải trang có thể lập chỉ mục. |
| C8 | `/quan-tri`, `/quan-tri/dang-nhap`, `/api/quan-tri/v1/me` | 3 | 200 text/html | 404 text/html | Giao diện quản trị chạy trên www (`ADMIN_BASE_URL` là www). V3 chưa có `/quan-tri`. `/api/quan-tri/v1/me` cũng: www 405 (có tuyến), V3 404. Nếu www trỏ sang V3 mà không mang theo tuyến này thì admin ngừng hoạt động. |
| C9 | `/admin`, `/login`, `/van-hanh` | 3 | 302 → Cloudflare Access (đăng nhập) | 404 text/html | www bắt các đường dẫn này bằng Cloudflare Access (302 sang trang đăng nhập Access, không đăng nhập thử). V3 trả 404 khi không qua Access; hành vi phía sau Access chưa đo được (xem mục 9). |

Tổng nhóm C = 48 URL. Dòng C8 hiển thị thêm `/api/quan-tri/v1/me` (www 405, V3 404): URL này không nằm trong 48 vì www không trả 200 hoặc 3xx.

## 6. Nhóm D: V3 khác về SEO

| # | Hiện tượng | Số đo | Ví dụ / ghi chú |
|---|---|---|---|
| D1 | `<meta name="robots" content="noindex, nofollow">` trên V3 (cố ý: `src/app/layout.tsx` đặt `robots: { index: false, follow: false }`, bản xem trước) | 956 trong 958 trang HTML so sánh được (trừ 2 trang tĩnh Tibetan); không có tiêu đề `X-Robots-Tag` | www không có noindex ở các trang này. **Phải bỏ khi chuyển**, nếu không toàn bộ trang bị gỡ khỏi chỉ mục. |
| D2 | Thiếu `<link rel="canonical">` | V3 thiếu ở 958 trang; www có ở 956 trang (trừ 2 trang tĩnh Tibetan) và canonical www đều trỏ tuyệt đối `https://www.tunglamhoaphuc.com/...` | Cần canonical trỏ `www` sau khi chuyển. Trang trùng nội dung (D6, D7) càng cần. |
| D3 | `/robots.txt` | www: 174 byte, `User-Agent: *`, `Allow: /`, 5 dòng `Disallow` (`/tim-kiem`, `/cdn-cgi/`, `/anh-goc/`, `/styleguide`, `/api/`) và `Sitemap: https://www.tunglamhoaphuc.com/sitemap.xml`. V3: 200 `text/plain`, 1.248 byte, 24 dòng chỉ gồm chú thích tín hiệu nội dung do Cloudflare chèn, không có `User-agent`, `Disallow`, `Sitemap` | Sau khi chuyển, `/anh-goc/`, `/api/`, `/cdn-cgi/` không còn bị chặn; không có dòng Sitemap. |
| D4 | `/sitemap.xml` | V3 trả 404 (xem mục 7) | |
| D5 | Tiêu đề trang | 956/958 khác; 281 trang V3 mang tiêu đề chung "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc", trong đó 152 là URL sitemap: trang chủ, 126 trang `/bao-tuong/<slug>`, 18 trang lịch, `/gioi-thieu`, `/bao-tuong-phat-giao`, `/tri-tue-phat-phap`, `/tri-tue-phat-phap/hoc-tieng-tang`, `/dong-chay-hoang-phap`, `/vu-tru-phat-giao`, `/tong-chi-tu-hoc` | Mô tả `<meta name="description">` có ở cả hai bên (8 trang mẫu). |
| D6 | Dữ liệu chia sẻ và dữ liệu có cấu trúc | `og:image` có ở 655 trang V3 (www 942). Ở 654 trang V3 `og:image` và `twitter:image` là địa chỉ tuyệt đối **`https://v3.tunglamhoaphuc.com/anh-goc/...`** (`V3_ORIGIN` ghi cứng), nên sau khi chuyển ảnh chia sẻ vẫn nằm ở tên miền v3. Trang chủ, `/gioi-thieu`, `/bao-tuong/*`, lịch, `/tri-tue-phat-phap` của V3 không có `og:title` (đã kiểm tra 8 trang mẫu). JSON-LD: www có ở trang chủ, một bài Dòng chảy Hoằng pháp, một trang lịch (3/8 trang mẫu), V3 0/8 | |
| D7 | Hai URL cho một bài | 18 địa chỉ mã số cũ (12 `/dong-chay-hoang-phap/<số>`, 6 `/tri-tue-phat-phap/<số>`) V3 trả 200 cùng nội dung với bản `-2`; www trả 404 ở địa chỉ không có `-2` | Cần canonical hoặc chuyển 301 về bản `-2`. Các địa chỉ này www không có nên không phải điểm gãy, chỉ là trùng lặp mới. |
| D8 | Phân trang và bộ lọc | V3 bỏ qua `?trang=N` và `?danh-muc=...`: trả 200, luôn là 12 bài của trang 1 (hoặc 1 liên kết bài ở `/tri-tue-phat-phap`), không canonical. Phân trang của V3 là nút bấm phía trình duyệt ("Trang 1 / 40 · 472 bài"), không có URL. Trên 97 URL phân trang/lọc kiểm tra, chỉ 8 URL có tập liên kết bài trùng www. Tham số lọc bảo tượng V3 là `?assembly=`, www là `?chung-hoi=` | www có 472 bài `/dong-chay-hoang-phap/*` đi tới được qua liên kết `?trang=N` (40 trang); trên V3 chỉ 12 bài đầu có liên kết dạng `<a href>` trong HTML trang danh sách. Cùng việc V3 chưa có sitemap, ~460 bài không còn đường vào cho robot. |
| D9 | Trang `/lich-tu-hoc` chuyển 307 (tạm thời) về `/#lich-tu-hoc` | 8 URL | Nên là trang thật hoặc chuyển 301/308. |
| D10 | Tiêu đề bảo mật HTML | www gửi `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`; V3 không gửi tiêu đề nào trong số này (đo trên `/` và `/gioi-thieu`) | |
| D11 | Liên kết trỏ về www trong HTML V3 | 956 trang V3 có liên kết `https://www.tunglamhoaphuc.com/lien-he` (mục "Liên hệ" của menu; cũng nằm trong JSON nhúng của trang). V3 không chuyển hướng về www ở URL nào đã đo, nên **không có vòng lặp chuyển hướng**. Sau khi chuyển, liên kết này thành liên kết nội bộ tới trang 404 (C1) | Đã quét mọi chuỗi `https://www.tunglamhoaphuc.com...` và `https://v3.tunglamhoaphuc.com...` trong HTML V3: địa chỉ www duy nhất là `/lien-he`. |
| D12 | Liên kết trỏ về v3 trong HTML V3 | 672 trang V3 chứa chuỗi `v3.tunglamhoaphuc.com`; cả 672 trang chỉ chứa nó trong giá trị `og:image`/`twitter:image` (D6), không trong liên kết `<a href>` | Sẽ lệch tên miền sau khi chuyển nếu không đổi `V3_ORIGIN`. |
| D13 | Trang tiện ích chỉ có ở V3 | `/kiem-tra-anh`, `/tra-cuu-bai-vi`, `/api/memorials`, `/api/home/news-carousel`, `/api/public/dharma-featured`, `/api/public/dong-chay` (200, JSON), `/api/public/increment-view` (OPTIONS 204) | Sau khi chuyển sẽ công khai trên tên miền chính, và robots không chặn `/api/`. |

## 7. Sitemap

| Mục | Kết quả |
|---|---|
| www `/sitemap.xml` | 200 `application/xml`, 121.304 byte, 830 thẻ `<loc>` (đều `https://www.tunglamhoaphuc.com/...`) |
| V3 `/sitemap.xml` | 404 `text/html` |
| 830 URL sitemap www hỏi trên V3 | 827 trả 200; **3 không trả 200**: `/lien-he` 404; `/lich-tu-hoc` 307 → `/#lich-tu-hoc`; `/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam` 308 → `/tong-chi-tu-hoc/tiep-buoc-thay-toi` (đích 200) |
| Canonical www so với sitemap | 819 trên 830 trang có canonical trùng địa chỉ sitemap; 11 trang còn lại chỉ khác chữ hoa/thường của mã `%XX` (slug có biểu tượng cảm xúc: sitemap viết `%f0...`, canonical viết `%F0...`), cùng một địa chỉ |

Phân bố 830 URL: `/dong-chay-hoang-phap` 473, `/tri-tue-phat-phap` 161, `/bao-tuong` 126, `/tong-chi-tu-hoc` 26, `/lich-tu-hoc` 19, `/vu-tru-phat-giao` 15, `/gioi-thieu` 7, và 1 mỗi địa chỉ `/`, `/lien-he`, `/bao-tuong-phat-giao`.

## 8. Ảnh, API, trang Tibetan, địa chỉ cũ

| Mục | Kết quả |
|---|---|
| `/anh-goc/<kho>/<khóa>` | 159 đường dẫn mẫu ngẫu nhiên (từ HTML www, từ tập 21.303 đường dẫn ảnh của www, và từ HTML V3): 156 trả 200 ở cả hai, 3 trả 404 ở cả hai, 0 chênh lệch trạng thái hoặc loại nội dung. |
| `/cdn-cgi/image/width=...,onerror=redirect/anh-goc/...` | 70 mẫu: 51 trả 200 ở cả hai, 19 trả 307 ở cả hai (cùng hành vi `onerror=redirect`), 0 chênh lệch |
| Ảnh `/images/*` | xem C: `hero`, `shape`, `404` www 200, V3 307 sang B2 (đích 404); `/images/icons/*` chỉ V3 có |
| `/favicon.ico`, `/manifest.webmanifest`, `/brand/*` | xem C: V3 404 |
| `/tibetan-study/index.html`, `style.css`, `pages/page_1.webp` | 200 ở cả hai, giống nhau; `app.js` khác 529 byte (www thêm xử lý 429). `/tibetan-study` và `/tibetan-study/` cùng 404 ở cả hai. |
| API đo bằng GET/OPTIONS | `/api/analyze`, `/api/ask-ai`, `/api/crop-analyze`, `/api/tts`: GET 405 và OPTIONS 204 (`Allow: OPTIONS, POST`) ở cả hai. `/api/tts/vi`: www 404, V3 400. `/api/public/*`: www không có (404 cả ba đường đã thử), nên trang www không dùng. Không gửi POST. |
| `http://` | 200 ở cả hai, không chuyển về https |
| Tên miền trần | `https://tunglamhoaphuc.com/...` và `http://tunglamhoaphuc.com/...` → 308 → `https://www.tunglamhoaphuc.com/...` (đo trên www; V3 không có tên miền trần) |
| Dấu `/` cuối và `//` | 308 về địa chỉ chuẩn, giống nhau (trang chủ, `/gioi-thieu`, `/dong-chay-hoang-phap`, `/lich-tu-hoc`, `/bao-tuong-phat-giao`, `/bao-tuong`, `/feed`, `/wp-json`) |
| Chữ hoa (`/GIOI-THIEU`, `/Gioi-Thieu`) | 404 ở cả hai |
| Dạng WordPress cũ (`/wp-admin`, `/wp-login.php`, `/wp-content/uploads/...`, `/index.php`, `/xmlrpc.php`, `/wp-sitemap.xml`, `/sitemap_index.xml`, `/feed`, `/category/...`, `/author/admin`, `/?p=17649`, `/?s=test`) | giống nhau ở cả hai: 404, riêng `/?p=17649` và `/?s=test` trả 200 (trang chủ) |
| `-2` bỏ đuôi (39 địa chỉ lấy từ sitemap www) | 31 địa chỉ không phải trang riêng: www 404 ở cả 31; V3 trả 200 ở 18 địa chỉ mã số (D7) và 404 ở 13. 8 địa chỉ còn lại tồn tại ở cả hai bên dưới tên đã bỏ `-2` (cùng 200). Không thấy dòng chuyển hướng nào của www ở nhóm này |

## 9. Chưa đo được hoặc đo chưa đủ

- **Bảng chuyển hướng của admin (`redirects`)**: www không công khai danh sách; tôi không đăng nhập `/quan-tri`. Trong các URL đã thử (39 địa chỉ `-2` bỏ đuôi, các địa chỉ WordPress cũ ở mục 8, mã số cũ) www không trả 301/302 nào (chỉ 308 dấu `/` cuối và 302 của Cloudflare Access); vì vậy **chưa chứng minh được** V3 xử lý đúng từng dòng của bảng đó. V3 có mã đọc bảng này (`src/lib/v3-redirect.ts`) nhưng chưa có địa chỉ cũ để thử. Cần xuất bảng từ admin rồi chạy lại đối chiếu.
- **`/admin`, `/login`, `/van-hanh`**: www trả 302 sang trang đăng nhập Cloudflare Access; không đăng nhập nên không biết nội dung phía sau. Nếu ứng dụng Access gắn theo tên miền `www`, nó vẫn nằm trước V3 sau khi chuyển.
- **Ảnh**: mẫu 229, không quét hết 21.303 đường dẫn ảnh. Kết quả mẫu là không chênh lệch, không đủ để khẳng định cả tập khớp.
- **Nội dung**: so `<title>`, `<h1>`, canonical, robots; chưa so nội dung thân bài, ảnh trong bài hay liên kết trong bài.
- **JSON-LD, `og:title`, tiêu đề bảo mật**: đo trên 8 trang mẫu (và 2 trang cho tiêu đề bảo mật), không phải toàn bộ.
- **Phân trang**: so tập liên kết bài `<a href>` trong HTML trả về; V3 có thể nạp thêm bằng mã chạy trong trình duyệt, tôi không chạy mã đó.
- Thời điểm đo cố định (23/11/2026); www và V3 dùng chung D1 nên số liệu nội dung có thể đổi khi admin sửa bài.

## 10. Việc nên làm trước khi chuyển (theo thứ tự chặn)

1. Gỡ `noindex, nofollow` ở `src/app/layout.tsx` và thêm canonical về `https://www.tunglamhoaphuc.com/...` (D1, D2); đổi `V3_ORIGIN` (D6, D12).
2. Thêm `/sitemap.xml` (dùng slug mới `tiep-buoc-thay-toi`, bỏ địa chỉ mã số cũ) và `robots.txt` có `Disallow` như www cộng `Sitemap:` (C2, D3).
3. Thêm `/lien-he` (có trong menu và sitemap), trang danh sách `/lich-tu-hoc` (hoặc 301 thay cho 307) và `/tim-kiem` nếu vẫn muốn giữ (C1, C6, C5).
4. Mang theo `/favicon.ico`, `/manifest.webmanifest`, `/brand/*` (đặc biệt `og-tung-lam-hoa-phuc.jpg`, favicon, logo) (C3, C4).
5. Quyết định số phận của `/quan-tri` và `/api/quan-tri` (C8): chạy cùng Worker với V3 hoặc giữ www cho admin.
6. Làm phân trang thành URL (`?trang=N` hoặc đường dẫn) để robot đi tới đủ 472 bài (D8); thêm lại tiêu đề bảo mật (D10); thêm JSON-LD và `og:title` (D6).
