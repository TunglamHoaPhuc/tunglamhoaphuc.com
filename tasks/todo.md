# Danh sách task: Dựng lại giao diện Tùng Lâm Hòa Phúc trên nền Bexon

> Kế hoạch tổng: [plan.md](plan.md) · Lập 02/11/2026, sửa lần 2 cùng ngày
> Lệnh kiểm chứng chuẩn (tạo ở T1): `npm run lint` · `npm run typecheck` · `npm test` (Vitest) · `npm run test:e2e` (Playwright + axe) · `npm run build` (vinext/Vite) · `npm run preview` (chạy bản build trên workerd ở cổng 4173; dùng `npm run preview -- --port 4173 --strictPort`) · `npm run deploy:v2`. E2e chạy thẳng vào bản đã deploy: `BASE_URL=https://v2.tunglamhoaphuc.com npm run test:e2e`
> "File Bexon" = file trong mã nguồn gốc của app (chép từ gói Bexon ở T1), sửa tại chỗ: đổi nội dung, nhận dữ liệu qua props. Màu và font đổi qua cầu nối `_tlhp-bridge.scss`, không sửa trong từng component. **Giữ hiệu ứng của Bexon.**
> Quy ước: file Bexon giữ `.js`; file mới viết `.ts` / `.tsx`. Lệnh Cloudflare chạy với `CLOUDFLARE_ACCOUNT_ID=b91a395bd9b7ab86ef4cba41d1d828ae`.
> Quy mô: S = 1–2 file · M = 3–5 file · L = 5–8 file. Task có hậu tố a/b được tách từ một task lớn để mỗi phần ≤ 5 file.

---

## Giai đoạn 1 – Nền móng

### T1: Chạy nguyên trạng Bexon trên Cloudflare Workers (`v2.`)

**Mô tả:** Chép bản LTR `bexon-react-nextjs-template/bexon/` từ gói zip vào gốc dự án (`jsconfig.json` → `tsconfig.json` với `allowJs`); giải nén thêm bản gốc chưa sửa vào `reference/bexon/`. Chạy trên Workers bằng **vinext** (`vinext init --platform=cloudflare`, xem Quyết định 1 của plan.md): `vite.config.ts`, `cloudflare.config.ts` (Worker `tlhp-web`, tài khoản của zone, tên miền `v2.`, Workers Logs). Header `X-Robots-Tag: noindex` cho mọi trang. Vitest, Playwright, `@axe-core/playwright`, ESLint, script chuẩn. `.gitignore` gồm `*.zip`, `reference/`, `data/snapshot/`, `.dev.vars*`. Khởi tạo git cục bộ.

**Kết quả 02/11/2026:** xong.
- `vinext check`: tương thích 95%, 0 lỗi.
- Sửa 1 file Bexon (`src/libs/gsap.config.js`) để chạy được trên Workers: import GSAP bản ESM thay cho `gsap/dist/gsap`; chỉ đăng ký plugin khi có `window`, vì Workers cấm hẹn giờ lúc nạp module.
- Mã Bexon gốc có 306 cảnh báo lint (biến không dùng…), được hạ xuống mức cảnh báo cho file `src/**/*.js`; mã mới vẫn bị chặn nghiêm.
- Gói Bexon chỉ kèm ảnh giữ chỗ ghi kích thước (ví dụ "1890X820"), không kèm ảnh demo thật.
- Worker sau deploy: 2,6 MB (623 KB nén), khởi động 18 ms.

**Tiêu chí nghiệm thu:**
- [x] `npm run deploy:v2` thay Worker giữ chỗ `tlhp-web`; `https://v2.tunglamhoaphuc.com` hiện Home-02 nguyên bản của Bexon, còn header noindex
- [x] Đã ghi rõ cách build chạy được trên Workers (vinext/Vite; ghi vào Quyết định 1 của plan.md)
- [x] Đủ 6 lệnh chuẩn chạy xanh, mỗi loại test có 1 test mẫu

**Kiểm chứng:**
- [x] `npm run lint && npm run typecheck && npm test && npm run build`
- [x] `npm run test:e2e` cục bộ và với `BASE_URL=https://v2.tunglamhoaphuc.com` (4/4 xanh); `curl -I https://v2.tunglamhoaphuc.com` có `x-robots-tag: noindex, nofollow`

**Phụ thuộc:** Không (cần Node.js 20+, `cf` profile `tlhp`)

**File:** `package.json`, `tsconfig.json`, `next.config.js`, `vite.config.ts`, `cloudflare.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.gitignore`, `tests/unit/next-config.test.ts`, `tests/e2e/smoke.spec.ts`, `src/libs/gsap.config.js` (cộng toàn bộ mã Bexon chép vào)

**Quy mô:** M (chủ yếu file cấu hình)

---

### T1b: Kho mã GitHub riêng tư và CI

**Mô tả:** Theo HT-02: tạo kho GitHub riêng tư bằng tài khoản của chùa, đẩy mã từ T1 lên (zip, `reference/`, `.dev.vars` không lên kho). GitHub Actions chạy lint, typecheck, test, build, e2e trên mỗi pull request; nhánh `main` tự deploy lên `v2.` (Worker `tlhp-web`) bằng API token Cloudflare chỉ có quyền Workers trong tài khoản sở hữu zone. Secrets lưu trong GitHub, không nằm trong mã.

**Tiêu chí nghiệm thu:**
- [ ] Pull request làm hỏng 1 test thì CI báo đỏ, không merge được
- [ ] Merge vào `main` thì `v2.` cập nhật trong ≤ 10 phút
- [ ] `git ls-files` không có file zip, `reference/`, `.dev.vars` hay khóa bí mật nào

**Kiểm chứng:**
- [ ] Tạo pull request thử: hỏng test → đỏ; sửa → xanh → merge → `v2.` đổi

**Phụ thuộc:** T1; Câu hỏi mở #7 (kho GitHub). Không chặn task nào; trước khi có kho thì deploy bằng `npm run deploy:v2`.

**File dự kiến:** `.github/workflows/ci.yml`, `.github/workflows/deploy-v2.yml`, `docs/van-hanh/ci.md`

**Quy mô:** S

---

### T2: Gỡ trang, thư viện thừa và thêm công tắc giảm chuyển động

**Mô tả:** Đưa trang `home-02` thành `/`. Xóa các trang không dùng (home-01, 03–11, shop, cart, checkout, wishlist, careers, pricing-plan, coming-soon, password, **login**, terms, blog-grid/list/sidebar…), section và partial SCSS chỉ chúng dùng (`h4`–`h11`, `ecommerce/`). Gỡ sweetalert2 (+ `useSweetAlert`), isotope, react-range-slider-input, nice-select2 (+ `ReactNiceSelect`). **Giữ** `ClientWrapper`, GSAP, wow.js, Swiper, odometer, preloader, magic cursor, `BackToTop`. Thêm công tắc: khi `prefers-reduced-motion: reduce` thì `ClientWrapper` không khởi động GSAP / wow / magic cursor, Swiper tắt autoplay, preloader không hiện; magic cursor không chạy trên thiết bị cảm ứng. Viết test canh gác hiệu ứng & thông báo: không toast, không hộp thoại tự bật khi tải trang, slider tự chạy có nút dừng, mọi hiệu ứng tắt ở chế độ giảm chuyển động. Nếu cuộn mượt làm hỏng cuộn bằng phím, liên kết neo hoặc tìm trong trang mà không sửa được, tắt riêng cuộn mượt (giữ các hiệu ứng khác) và báo chủ dự án.

**File Bexon:** `src/app/home-02/page.js`, `src/components/shared/wrappers/ClientWrapper.js`, `src/libs/initSmoothScroller.js`, `src/libs/preloaderController.js`, `src/hooks/useSweetAlert.js`, `src/app/layout.js`, `src/app/globals.scss`

**Kết quả 02/11/2026:** xong, đã deploy `v2.`.
- **Đã xóa:**
  - 25 route và 241 file mã không còn được import (đồ thị import tính từ các trang giữ lại).
  - 97 partial SCSS, 9 file dữ liệu mẫu, 88 ảnh/video không ai dùng, `src/css/globals.css` (976 KB, file chết).
  - Có kiểm bằng so bộ chọn CSS khớp trên 13 trang trước/sau: **0 bộ chọn bị mất**. Phép so bắt được `_faq.scss` vẫn được `/services/1` dùng và đã giữ lại.
- **Dung lượng phía trình duyệt:** CSS 1.441 → 1.003 KB, JS 1.457 → 1.126 KB (110 → 49 file).
- **Giữ khác dự kiến:**
  - `ReactNiceSelect` là component do Bexon tự viết, không dùng gói `nice-select2`; giữ cho tới khi form được dựng lại ở T18/T22. Gói npm `nice-select2` đã gỡ.
  - Home-02 không có preloader và con trỏ hiệu ứng (hai thứ này chỉ có ở home khác), nên không có gì để tắt.
- **Sửa thêm 2 file Bexon:**
  - `_theme.scss`: tiêu đề `.title-anim` chỉ bị ẩn chờ GSAP khi cho phép chuyển động. Nếu không sửa, chế độ giảm chuyển động sẽ làm tiêu đề vô hình.
  - `initSmoothScroller.js`: Ctrl+F, `scrollIntoView` và liên kết neo cuộn khung `#smooth-wrapper` mà ScrollSmoother không theo dõi. Kết quả là trang không tới chỗ tìm thấy, rồi lần cuộn sau giật về chỗ cũ. Nay chuyển khoảng cuộn sang ScrollSmoother và nhảy tức thì; test đỏ trước khi sửa, xanh sau khi sửa. Phím Tab do ScrollSmoother tự trôi mượt tới phần tử (~1,5 giây).
- **Kiểm tra "slider tự chạy có nút dừng"** chuyển sang T10, khi các slider được dựng lại; ở T2 chỉ kiểm slider dừng hẳn khi giảm chuyển động.

**Tiêu chí nghiệm thu:**
- [x] Bật giảm chuyển động (Playwright `reducedMotion: 'reduce'`): không có transform cuộn mượt, không slider tự chuyển, mọi tiêu đề và khối `wow` hiện ngay (6 trang)
- [x] Khi cuộn mượt đang bật: cuộn bằng phím, nút về đầu trang, `scrollIntoView` (cơ chế của Ctrl+F và liên kết neo) và focus bằng phím đều đưa đúng tới đích. Ctrl+F thật trong Chrome nên được thử tay trên `v2.`
- [x] `package.json` không còn `sweetalert2`, `isotope-layout`, `nice-select2`, `react-range-slider-input`, `imagesloaded`; ESLint chặn import lại; build xanh; test canh gác xanh

**Kiểm chứng:**
- [x] `npm run build` và ghi dung lượng CSS/JS trước–sau làm mốc
- [x] `npm run test:e2e` cục bộ và với `BASE_URL=https://v2.tunglamhoaphuc.com`: 33 xanh, 5 bỏ qua (test bàn phím chỉ chạy ở desktop)

**Phụ thuộc:** T1

**File:** `src/app/page.js` (từ `home-02`), `src/components/shared/wrappers/ClientWrapper.js`, `src/libs/motion.ts`, `src/libs/initSmoothScroller.js`, `src/app/assets/sass/components/_theme.scss`, `src/app/assets/sass/components/_reduced-motion.scss`, `src/app/globals.scss`, `src/app/layout.js`, `eslint.config.mjs`, `tests/e2e/motion-guard.spec.ts` (cộng các file bị xóa)

**Quy mô:** M (phần lớn là xóa file)

---

### T3a: Cầu nối theme TLHP: màu, font, cỡ chữ

**Mô tả:** `layout.js` import `design-system/tokens.css` trước `globals.scss`; thay Mona Sans bằng Noto Serif (`--tj-ff-heading`) và Be Vietnam Pro (`--tj-ff-body`), subset `latin` + `vietnamese`; `<html lang="vi">`. Partial `utilities/_tlhp-bridge.scss` nạp cuối `globals.scss`, gán `--tj-color-*`, `--tj-ff-*`, `--tj-fs-*` theo bảng ở Quyết định 2 của plan.md, khai báo trên `:root, [data-theme], .tlhp-dark`.

**File Bexon:** `src/app/layout.js`, `assets/sass/utilities/_colors.scss`, `_typography.scss`, `_root.scss`

**Kết quả 02/11/2026:** xong, đã deploy `v2.`.
- **Font:** vinext tự host Noto Serif và Be Vietnam Pro (có bộ chữ tiếng Việt), không tải từ Google. Biến font đặt trên `<html>`, vì cầu nối đọc chúng ở `:root`.
- **Cầu nối:** `_tlhp-bridge.scss` gán toàn bộ biến màu Bexon, kể cả biến chưa dùng. Màu trong suốt dựng bằng `color-mix` từ token, không viết cứng mã màu.
- **Sửa thêm 3 chỗ để đạt tương phản:**
  - Chữ nhấn cuối tiêu đề section sáng: dùng `--tlhp-accent-text`. Bexon dùng chung một màu xám cho cả nền sáng và nền tối.
  - Tiêu đề trên nền tối (`text-white`) giữ màu đá sáng.
  - Chip "Our Solutions" trong section tối: dùng `--tlhp-hoaisac-300`.
- **Phát hiện và sửa lỗi của T2:** `.wow { visibility: hidden }` trong `_theme.scss` làm ẩn mọi khối có lớp `wow` (chip, nút, thẻ bảng giá, ảnh dự án) ở chế độ giảm chuyển động. Test T2 khi đó chỉ kiểm thuộc tính viết trực tiếp, nay đã kiểm `getComputedStyle` (đỏ trước khi sửa, xanh sau khi sửa).
- **Worker:** 488 KB nén (T1: 623 KB).
- **Còn lại cho T3b:** logo Bexon màu teal, quầng sáng teal cuối section dịch vụ, line-height và giãn chữ của tiêu đề.
- **Còn lại cho T13b:** số đếm odometer hiện 0 cho tới khi cuộn tới.

**Tiêu chí nghiệm thu:**
- [x] Nền trang, nền section xen kẽ, tiêu đề, thân bài, nút chính trên Home-02 lấy đúng màu TLHP (test đọc computed style của từng phần tử mẫu)
- [x] Chữ có dấu chồng (Ẫ, Ộ, Ữ, Ỹ) hiển thị bằng đúng 2 font mới: test tải bộ chữ tiếng Việt (`unicode-range` có U+1EA0) rồi `document.fonts.check`
- [x] Section tối của Bexon (`Services2`, `Footer2`) dùng đen mun và chữ kem; axe 0 lỗi tương phản trên Home-02 (1440px và 375px)

**Kiểm chứng:**
- [x] `npm run test:e2e -- theme` (6/6); toàn bộ e2e 39 xanh cục bộ và trên `v2.`
- [x] Ảnh chụp Home-02 trước–sau ở 375px và 1440px: `docs/anh/t3a-truoc-sau-desktop.png`, `docs/anh/t3a-truoc-sau-mobile.png`

**Phụ thuộc:** T2

**File:** `src/app/layout.js`, `src/app/assets/sass/utilities/_tlhp-bridge.scss`, `src/app/globals.scss`, `src/app/assets/sass/layout/_heading.scss`, `src/app/assets/sass/layout/_services.scss`, `src/app/assets/sass/components/_theme.scss`, `tests/e2e/theme.spec.ts`, `tests/e2e/motion-guard.spec.ts`

**Quy mô:** M

---

### T3b: Quét màu viết cứng, chỉnh chữ tiếng Việt và trang styleguide

**Mô tả:** Quét các partial SCSS còn giữ: thay màu teal viết cứng (`#1e8a8a`, `rgba(30,138,138,…)`) và mã màu khác bằng biến; line-height tiêu đề ≥ 1.15, bỏ giãn chữ âm lớn hơn −0.01em; nút viết hoa đầu câu, ô icon tròn nền hoại sắc, vòng focus kép. Tiêu đề có hiệu ứng tách chữ (`titleAnim*`, SplitText) phải giữ `aria-label` nguyên câu và không làm dấu tiếng Việt lệch khỏi chữ. Đổi màu preloader, magic cursor, `BackToTop` theo theme. Trang `/styleguide` (noindex, chỉ bật ở dev và `v2.`) hiển thị nút, chip sub-title, tiêu đề h1–h6 có dòng "Ẫ Ộ Ữ Ỹ", thẻ blog/team/service, form, ở nền sáng và section tối. Sửa BRAND-GUIDELINES: mục 1.2 và 5.6 theo quyết định giữ hiệu ứng, thêm mục 6 "Áp vào Bexon (Bootstrap/SCSS)".

**File Bexon:** `components/_buttons.scss`, `_preloader.scss`, `_cursor.scss`, `_backtotop.scss`, `layout/_heading.scss`, `src/libs/titleAnim*.js`

**Kết quả 02/11/2026:** xong, đã deploy `v2.`.
- **Màu:** thay 28 chỗ teal và đen-xanh viết cứng ở 12 partial bằng `var(--tj-…)` / `color-mix(…)`. Tô lại `shape-blur.svg` (quầng sáng section dịch vụ, nay hoại sắc đậm), `map.svg` (Contact2) và ảnh `404/error.webp`; xóa `h11-hero-img-shape.svg` không dùng. `--bs-code-color` của Bootstrap trỏ về `--tlhp-accent-text`. Logo Bexon vẫn teal, để T5a thay.
- **Chữ tiếng Việt:** tiêu đề h1 và tiêu đề hero dùng `--tlhp-leading-display` (1.15) và giãn chữ −0.01em; h2 1.25; mọi giãn chữ âm khác về 0 hoặc −0.01em. Nới 11 tiêu đề một dòng của Bexon đang để `line-height: 1` (hamburger, mega-menu, cảm nhận, bảng giá, page header, sidebar blog…). Test đo trên 11 trang còn giữ.
- **Tách chữ:** GSAP 3.13 SplitText tự gắn `aria-label` nguyên câu và tách theo cụm chữ (`Intl.Segmenter`), nên dấu không rời chữ. Lớp che dòng `.title-anim > div` đổi từ `overflow: hidden` sang `clip-path` có chừa chỗ, không còn cắt dấu chồng và dấu nặng.
- **Nút:** nền mộc, chữ ngà, ô icon tròn nền hoại sắc (đảo màu trong `.tlhp-dark`), cao ≥ 48px, vòng focus kép `--tlhp-shadow-focus`, hover đổi `primary-hover`. Hộp nhãn có đệm 0.3em và hiệu ứng cuộn nhãn dịch 2em để không cắt dấu. Ô icon `aria-hidden`. Bỏ `text-transform: capitalize` ở menu. Chip `style-2` dùng cặp `accent-soft` / `accent-text`.
- **Preloader và magic cursor:** Home-02 không có (T2 đã gỡ), không có gì để đổi màu. `BackToTop` đã đọc biến theme.
- **`/styleguide`:** màu, h1–h6 có "Ẫ Ộ Ữ Ỹ ạ ợ", 3 kiểu tách chữ, nút, thẻ blog/team/service, biểu mẫu có nhãn, section `.tlhp-dark`. `noindex`; trả 404 trên `www` và tên miền gốc (`src/libs/hosts.ts`, có unit test). Ảnh: `docs/anh/t3b-styleguide.png`.
- **Phát hiện và sửa lỗi của T2:** khi trình duyệt cuộn tới phần tử (tìm trong trang, `scrollIntoView`), cách "tạm tắt độ mượt rồi nhảy" chỉ chạy ở trang có nhiều ScrollTrigger; trên `/styleguide` nội dung đứng im. Nay dùng `smoother.scrollTo(y, false)` như ScrollSmoother tự làm khi focus (lướt khoảng 1,5 giây). Test chạy trên cả `/` và `/styleguide`.
- **Tên liên kết trong thẻ Bexon** (axe phát hiện trên styleguide; trang chủ cũng dính vì test trang chủ chỉ kiểm tương phản): ảnh đầu `BlogCard2` trùng đích với tiêu đề nên rút khỏi Tab và trình đọc màn hình; icon thư và mạng xã hội của `TeamCard` có `aria-label`.
- **Giới hạn đã biết:** đặt `data-theme="dark"` lên cả trang làm thẻ và biểu mẫu Bexon (nền `common-white` cố định) thành chữ sáng trên nền sáng. Theo quyết định 9, chủ đề chỉ đặt trên khung đọc hoặc `.tlhp-dark`, nên chưa xử lý; T8 làm khung đọc Đêm thiền thì kiểm lại.

**Tiêu chí nghiệm thu:**
- [x] Không còn màu teal trên Home-02 và styleguide (test quét computed style mọi phần tử, cả `::before`/`::after`, và nội dung các ảnh SVG đang hiển thị)
- [x] Tiêu đề h1–h6 có dòng "Ẫ Ộ Ữ Ỹ" không chạm dòng, kể cả khi đang chạy hiệu ứng tách chữ; trình đọc màn hình đọc nguyên câu
- [x] axe 0 lỗi WCAG A/AA trên styleguide (nền sáng và section tối, 1440px và Pixel 7); nút `md` cao ≥ 48px

**Kiểm chứng:**
- [x] `npm run test:e2e -- styleguide` cùng toàn bộ e2e: 78 xanh cục bộ và trên `v2.` (6 test bàn phím chỉ chạy trên desktop); unit 13 xanh; Worker 492 KB nén

**Phụ thuộc:** T3a

**File dự kiến:** `src/app/styleguide/page.tsx`, `tests/e2e/styleguide.spec.ts`, `design-system/BRAND-GUIDELINES.md`, `src/libs/titleAnim.js` (cộng các partial SCSS còn màu viết cứng)

**Quy mô:** M

---

### T4: Lớp nội dung: snapshot JSON → repository (lát Dòng Chảy)

**Mô tả:** Interface `ContentRepository` (chỉ đọc), kiểu miền `Post`, `Category`. Schema zod cho `posts` theo đặc tả 3.1b. Bộ chuẩn hóa dùng chung: ngày (`publishedDate`, `publishedAt`, `solarDateStr "dd.mm.yyyy"`) về ISO; `mediaUrl()` gom 3 host ảnh cũ; nội dung Markdown nhẹ / HTML → HTML đã làm sạch. Nguồn `snapshot` đọc `data/snapshot/*.json`; chọn nguồn bằng `CONTENT_SOURCE`. Script `npm run snapshot:check` in báo cáo bản ghi lỗi và bất thường dữ liệu.

**Tiêu chí nghiệm thu:**
- [ ] Parse 632 bản ghi posts thật; bản ghi sai cấu trúc được liệt kê trong báo cáo, không làm hỏng build
- [ ] `listPosts({ category, sort, page, pageSize })` và `getPostBySlug(slug)` trả đúng; slug không tồn tại trả `null`
- [ ] HTML đầu ra không còn `<script>`, thuộc tính `on*`, `javascript:`; mọi URL ảnh đi qua `mediaUrl()`

**Kiểm chứng:**
- [ ] `npm test` (fixture rút gọn + 1 test trên snapshot thật, tự bỏ qua khi chưa có snapshot)
- [ ] `npm run snapshot:check` in số bản ghi theo chuyên mục (Dòng Chảy 472, Trí Tuệ 158…)

**Phụ thuộc:** T1; chuẩn bị #1. Song song được với T2–T6.

**File dự kiến:** `src/lib/content/types.ts`, `src/lib/content/repository.ts`, `src/lib/content/normalize.ts`, `src/lib/content/sources/snapshot.ts`, `scripts/check-snapshot.ts`, `tests/unit/content/posts.test.ts`

**Quy mô:** M

---

### T5a: Header và menu

**Mô tả:** `src/config/site.ts` chứa menu đã chốt (Giới thiệu ▾ · Tin tức – Pháp thoại ▾ · Lịch tu học · Đăng ký khóa tu · Liên hệ), liên hệ, mạng xã hội, giờ mở cửa; `Navbar`, `MobileMenu` đọc từ đây. Giữ cơ chế header của Bexon: header nổi trên hero + header dính nhân đôi trượt xuống khi cuộn (bản đang ẩn đặt `inert` để trình đọc màn hình không đọc 2 lần). Mega-menu cho 2 menu thả, mở khi bấm, Esc đóng và trả focus. Menu ngang từ 1280px; dưới mức đó dùng hamburger offcanvas của Bexon (Esc đóng, bẫy focus). Cụm phải: nút Gọi điện (`tel:`), Chỉ đường, nút "Đăng ký khóa tu" (tạm dẫn `/lich-tu-hoc#khoa-tu` cho tới T39).

**File Bexon:** `components/layout/header/Header.js`, `Navbar.js`, `Logo.js`, `MobileMenu.js`, `MobileNavbar.js`, `ContactMenu.js`, `hooks/useIsSticky.js`, `assets/sass/components/_header.scss`, `_mega-menu.scss`, `_hamburger.scss`

**Kết quả 02/11/2026:** xong, đã deploy `v2.`.
- **`src/config/site.ts`:** menu 5 mục (2 menu thả), 7 số liên hệ, giờ mở cửa, địa chỉ lấy từ footer site cũ; logo, nút "Đăng ký khóa tu" và cờ bật tìm kiếm. `src/libs/nav.ts` xác định mục đang mở (liên kết có `#` không sáng, để "Đăng ký khóa tu" không sáng cùng "Lịch tu học"). 21 unit test.
- **Logo:** ấn Mộc Ấn từ bộ nhận diện (`public/brand/`) kèm chữ "Tùng Lâm Hòa Phúc" vì chữ trong ấn quá nhỏ ở cỡ 48px; điện thoại xuống 2 dòng.
- **Menu ngang từ 1280px:** mục cha là nút (mở khi bấm, không mở khi rê chuột), Esc đóng và trả focus, đóng khi focus hoặc cú bấm ra ngoài. Menu thả dùng kiểu `mega-menu-service` của Bexon, icon vàng của chùa đặt trên nền đen mun.
- **Cụm phải:** nút tròn 48px Gọi điện (số Trưởng ban lãnh chúng) và Chỉ đường (Google Maps), nút "Đăng ký khóa tu". Ở 1280–1439px ẩn nút này (menu đã có mục cùng tên) để header không rớt dòng; dưới 768px chỉ giữ Gọi điện + menu.
- **Dưới 1280px:** offcanvas của Bexon là hộp thoại (`role="dialog"`, bẫy focus, Esc đóng, trả focus về nút mở), ẩn hẳn khi đóng; mục con mở dạng accordion; có nút đăng ký và khối liên hệ.
- **Hai header của Bexon:** bản đang khuất đặt `inert`, nên bàn phím và trình đọc màn hình chỉ gặp một header.
- **Gỡ:** `ContactMenu` (offcanvas liên hệ trên desktop, không có trong đặc tả 5.3), `HeaderTop`, `getNavItems`, `useActiveLink`, `nav-items.json`.
- **Còn chờ:** đường dẫn mạng xã hội chính thức và link Google Maps của chùa (GD-06; hiện dùng link tìm kiếm). Slug 3 trang Giới thiệu (`lich-su-bon-tu`, `chu-ton-duc`, `thanh-quy`) tạm đặt, T13a chốt theo dữ liệu. Icon menu chọn tạm theo nghĩa gần nhất, đổi trong `site.ts`.

**Tiêu chí nghiệm thu:**
- [x] Bàn phím: Tab tới mọi mục, Enter mở menu thả, Esc đóng menu thả / offcanvas và trả focus (Playwright)
- [x] Không tràn ngang, không cắt chữ menu ở 375 / 768 / 1024 / 1280 / 1440px (lỗi của site cũ ở 1024px); header nằm một hàng ở cả 5 độ rộng
- [x] axe không báo trùng landmark `navigation`; đổi menu chỉ cần sửa `src/config/site.ts`

**Kiểm chứng:**
- [x] `npm run test:e2e -- header` (14 test); toàn bộ e2e 94 xanh cục bộ và trên `v2.`. Test canh gác "không hộp thoại khi tải trang" bắt được bảng menu đóng vẫn tính là đang hiện; đã sửa.
- [x] Ảnh chụp header ở 5 độ rộng, chưa cuộn và đã cuộn, kèm menu thả: `docs/anh/t5a-header-5-do-rong.png`

**Phụ thuộc:** T3b; chuẩn bị #2 (logo)

**File dự kiến:** `src/config/site.ts`, `src/components/layout/header/Header.js`, `src/components/layout/header/Navbar.js`, `src/components/layout/header/MobileMenu.js`, `tests/e2e/header.spec.ts`

**Quy mô:** M

---

### T5b: Popup tìm kiếm và dải thông báo

**Mô tả:** Giữ popup tìm kiếm của Bexon: mở khi bấm, Esc đóng, bẫy focus, gửi `GET /tim-kiem?q=`. Nút tìm kiếm ẩn bằng cờ cấu hình cho tới khi T18 dựng xong trang `/tim-kiem`. Dải thông báo 48px trong luồng phía trên header, nội dung lấy từ `site.ts`, có nút Đóng, nhớ trong phiên.

**File Bexon:** `components/layout/header/Header.js` (popup tìm kiếm viết thẳng trong file này; `HeaderSearchForm.js` không được dùng và đã xóa ở T2), `assets/sass/components/_search.scss`

**Tiêu chí nghiệm thu:**
- [ ] Popup tìm kiếm: Esc đóng và trả focus về nút mở; focus không thoát ra ngoài khi đang mở
- [ ] Đóng dải thông báo thì không hiện lại trong phiên; dải không làm header dính nhảy vị trí
- [ ] Khi cờ tìm kiếm tắt, không còn nút hay đường dẫn nào trỏ tới `/tim-kiem`

**Kiểm chứng:**
- [ ] `npm run test:e2e -- header-extras`

**Phụ thuộc:** T5a

**File dự kiến:** `src/components/layout/header/Header.js`, `src/components/layout/AnnouncementBar.tsx`, `src/config/site.ts`, `tests/e2e/header-extras.spec.ts`

**Quy mô:** M

---

### T6: Footer, khối kết trang, nút lên đầu trang và trang 404

**Mô tả:** Đưa header + footer vào `src/app/(site)/layout.js` (Bexon đặt trong từng trang). `Footer2`: 4 cột (Bổn tự · Thời khóa tu học · Liên hệ · Bản đồ tĩnh + nút "Mở Google Maps"), dải chữ chạy đổi thành "Nơi để trở về – Chốn thiêng bình yên", dải cuối "© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc". `Cta` thành khối kết trang "Xem lịch tu học" trước footer ở trang trong. `BackToTop` giữ, có nhãn "Về đầu trang", vùng chạm ≥ 48px, không che nội dung ở 375px. `ErrorPrimary` thành trang 404 giọng kính ngữ, trả 404 thật.

**File Bexon:** `components/layout/footer/Footer2.js`, `sections/cta/Cta.js`, `sections/error/ErrorPrimary.js`, `shared/others/BackToTop.js`, `assets/sass/components/_footer.scss`

**Tiêu chí nghiệm thu:**
- [ ] Footer 1 → 2 → 4 cột theo điểm ngắt; mỗi số điện thoại là liên kết `tel:` cao ≥ 48px; chữ chạy dừng ở chế độ giảm chuyển động
- [ ] URL không tồn tại trả HTTP 404 với trang tùy biến
- [ ] Test canh gác và axe xanh trên `/` và trang 404

**Kiểm chứng:**
- [ ] `npm run test:e2e`
- [ ] `curl -I` một URL sai trên `npm run preview` trả 404

**Phụ thuộc:** T5b

**File dự kiến:** `src/app/(site)/layout.js`, `src/components/layout/footer/Footer2.js`, `src/components/sections/cta/Cta.js`, `src/components/shared/others/BackToTop.js`, `src/app/not-found.js`

**Quy mô:** M

---

### Checkpoint A: Nền móng và duyệt giao diện
- [ ] 6 lệnh chuẩn xanh; deploy lên `v2.` thành công
- [ ] Ban Truyền Thông xem `v2.` (Home-02 đã đổi theme, dữ liệu mẫu), styleguide, header, footer trên điện thoại và máy tính; duyệt trước khi thay nội dung
- [ ] Bảng khảo sát đã cập nhật theo quyết định 02/11 (chuẩn bị #6)

---

## Giai đoạn 2 – Site công khai (đọc snapshot)

### T7: Dòng Chảy Hoằng Pháp – trang danh sách

**Mô tả:** Route `/dong-chay-hoang-phap`, trang server lấy dữ liệu từ repository rồi truyền props. `HeroInner` làm banner trang trong + breadcrumb. Bộ lọc 4 danh mục dạng pill + sắp xếp (Mới nhất · Cũ nhất · A→Z · Z→A, `<select>` gốc theo kiểu Bexon) + phân trang 12 bài/trang, trạng thái trên URL (`?danh-muc=&sap-xep=&trang=`), xử lý phía server. Thẻ bài dùng một biến thể `BlogCard` với ảnh 4:3: chip chuyên mục → tiêu đề (≤ 3 dòng) → mô tả (≤ 3 dòng) → ngày đăng.

**File Bexon:** `sections/hero/HeroInner.js`, `layout/main/BlogMain.js`, `shared/cards/BlogCard2.js` (biến thể duy nhất còn lại sau T2), `shared/others/Paginations.js`, `shared/others/NoItems.js`

**Tiêu chí nghiệm thu:**
- [ ] HTML trang đầu chỉ chứa ≤ 12 thẻ bài (site cũ: 472 thẻ, 3 MB); đổi bộ lọc giữ trạng thái trên URL, nút Back hoạt động
- [ ] Danh mục rỗng hoặc số trang vượt giới hạn hiện trạng thái rỗng có lối quay lại
- [ ] Ảnh thẻ có kích thước cố định (CLS = 0), ảnh ngoài màn hình đầu tải lười

**Kiểm chứng:**
- [ ] `npm run test:e2e -- dong-chay`
- [ ] Đo kích thước HTML trang danh sách trên `npm run preview`

**Phụ thuộc:** T4, T6

**File dự kiến:** `src/app/(site)/dong-chay-hoang-phap/page.js`, `src/components/sections/hero/HeroInner.js`, `src/components/layout/main/BlogMain.js`, `src/components/shared/cards/BlogCard2.js`, `tests/e2e/dong-chay.spec.ts`

**Quy mô:** M

---

### T8: Trang chi tiết bài viết và chế độ đọc

**Mô tả:** Route `/dong-chay-hoang-phap/[slug]`, render phía server. Breadcrumb + "Quay lại Dòng Chảy Hoằng Pháp", tiêu đề, meta (ngày, tác giả, lượt xem), thanh tab neo (Tổng quan · Nội dung chính · Video · Album ảnh · Các kỳ trước · Sắp diễn ra; chỉ hiện tab có dữ liệu; chạy đúng khi bật cuộn mượt). Thân bài trong `.tlhp-reading`; nút A− / A+ (4 mức) và Ngà / Giấy dó / Đêm thiền đặt `data-theme` trên khung đọc (lưu `localStorage`). Bỏ sidebar widget và bình luận của Bexon. `generateMetadata` riêng từng bài. Slug sai → `notFound()`.

**File Bexon:** `layout/main/BlogDetailsMain.js`, `assets/sass/layout/_blog-details.scss`

**Tiêu chí nghiệm thu:**
- [ ] HTML ban đầu có đủ nội dung bài (không có trạng thái "Đang tải dữ liệu…")
- [ ] `/dong-chay-hoang-phap/le-hang-thuan-tai-tung-lam-hoa-phuc` (bài không còn) trả 404 thật thay vì 200
- [ ] A− / A+ đổi cỡ chữ khung đọc; Giấy dó và Đêm thiền chỉ đổi khung đọc, giữ nguyên khi tải lại

**Kiểm chứng:**
- [ ] `npm run test:e2e -- article`
- [ ] `curl` trang chi tiết, kiểm có đoạn thân bài trong HTML

**Phụ thuộc:** T7

**File dự kiến:** `src/app/(site)/dong-chay-hoang-phap/[slug]/page.js`, `src/components/layout/main/BlogDetailsMain.js`, `src/components/site/ReadingControls.tsx`, `src/components/site/AnchorTabs.tsx`, `tests/e2e/article.spec.ts`

**Quy mô:** M

---

### T9: Video, album ảnh, lightbox

**Mô tả:** Album ảnh lưới 4:3 theo `OurGalleryPrimary`, mở bằng glightbox (Esc đóng, ← → chuyển ảnh, đếm "1/79"); bổ sung bẫy focus và trả focus về ảnh đã bấm nếu glightbox chưa làm. Video YouTube dùng `PopupVideo` của Bexon dạng ảnh + nút phát, chỉ nạp `youtube-nocookie.com` khi bấm. Gắn vào trang chi tiết bài.

**File Bexon:** `sections/our-gallery/OurGalleryPrimary.js`, `shared/popup-video/PopupVideo.js`

**Tiêu chí nghiệm thu:**
- [ ] Không có request nào tới YouTube trước khi người dùng bấm phát
- [ ] Lightbox: Esc, bẫy focus, trả focus; axe 0 lỗi khi đang mở
- [ ] Album 79 ảnh chỉ tải ảnh thu nhỏ đang trong khung nhìn

**Kiểm chứng:**
- [ ] `npm run test:e2e -- media` (theo dõi network request)

**Phụ thuộc:** T8

**File dự kiến:** `src/components/sections/our-gallery/OurGalleryPrimary.js`, `src/components/shared/popup-video/PopupVideo.js`, `src/components/site/useLightboxFocus.ts`, `tests/e2e/media.spec.ts`

**Quy mô:** M

---

### T10: Trang chủ – hero, lối vào chuyên mục, tin mới nhất

**Mô tả:** Trang chủ (server) lấy dữ liệu rồi truyền props; thứ tự khối khai báo bằng một mảng theo thứ tự đã chốt. `Hero2` giữ slider tự chạy: khung (1) "Nơi để trở về" / "Chốn thiêng bình yên", khung (3) pháp sự mới nhất (khung 2 thêm ở T12); mỗi khung ≥ 7 giây, ảnh có lớp phủ tối ≥ 55% dưới chữ, có nút tạm dừng, dừng khi di chuột hoặc focus. `Brands2` thành dải 6 lối vào chuyên mục (trượt tự chạy, dừng khi di chuột/focus, bấm được). `Blogs2` thành Tin mới nhất + Dấu ấn hoằng pháp (top lượt xem) dạng tab, slider tự chạy. Các khối chưa có dữ liệu thật tạm ẩn khỏi mảng cho tới task của chúng.

**File Bexon:** `sections/hero/Hero2.js`, `sections/brands/Brands2.js`, `sections/blogs/Blogs2.js`

**Tiêu chí nghiệm thu:**
- [ ] Mọi slider có nút tạm dừng dùng được bằng bàn phím và dừng khi di chuột/focus; không tự chạy ở chế độ giảm chuyển động
- [ ] Ảnh khung hero đầu tiên nạp ưu tiên, đúng kích thước; CLS = 0
- [ ] Bật lại một khối chỉ cần thêm 1 dòng vào mảng khối

**Kiểm chứng:**
- [ ] `npm run test:e2e -- home`
- [ ] Lighthouse cục bộ trên `npm run preview` (ghi LCP, CLS, dung lượng CSS/JS làm mốc, có và không có preloader)

**Phụ thuộc:** T6, T7

**File dự kiến:** `src/app/(site)/page.js`, `src/components/sections/hero/Hero2.js`, `src/components/sections/brands/Brands2.js`, `src/components/sections/blogs/Blogs2.js`, `tests/e2e/home.spec.ts`

**Quy mô:** M

---

### Checkpoint B: Lát cắt đầu-cuối
- [ ] Trang chủ → danh sách → chi tiết → album chạy trọn trên `v2.` bằng dữ liệu thật
- [ ] Test canh gác + axe xanh cho cả 4 trang
- [ ] Ghi mốc LCP và dung lượng CSS/JS; nếu preloader làm trượt LCP < 2,0 s thì chủ dự án quyết (Câu hỏi mở #6 trong plan.md)
- [ ] Chủ dự án xác nhận cách đổi nội dung section Bexon đạt yêu cầu trước khi nhân rộng

---

### T11: Lịch tu học – dữ liệu, âm lịch, trang `/lich-tu-hoc`

**Mô tả:** Adapter `schedule` (customEvents, featuredPrograms, monthThemes, quoteGallery). Tiện ích âm lịch theo thuật toán Hồ Ngọc Đức (múi giờ +7). Trang `/lich-tu-hoc` (banner `HeroInner`): lưới tháng T2 → CN (ngày dương + âm, dựng bằng lưới Bootstrap), danh sách thẻ sự kiện 16:9 có chip trạng thái ("Đang mở đăng ký" / "Đã đủ số lượng" / "Đã kết thúc"), chọn tháng và loại qua URL, sự kiện nhiều ngày, chủ đề tháng (poster + câu kệ chữ `scripture`). Mục `#khoa-tu` ghi cách đăng ký qua điện thoại cho tới khi có `/dang-ky`.

**File Bexon:** `sections/hero/HeroInner.js`, `shared/cards/BlogCard2.js` (khuôn thẻ sự kiện)

**Tiêu chí nghiệm thu:**
- [ ] Âm lịch đúng cho bộ ngày kiểm thử: Tết, Rằm tháng Giêng, Phật đản 15/4 ÂL, Vu Lan 15/7 ÂL các năm 2025–2027
- [ ] Lưới tháng dùng được bằng bàn phím và có bản danh sách tương đương cho trình đọc màn hình
- [ ] 15 sự kiện trong snapshot hiển thị đúng ngày dương và âm

**Kiểm chứng:**
- [ ] `npm test -- lunar`
- [ ] `npm run test:e2e -- lich-tu-hoc`

**Phụ thuộc:** T4, T6

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm schedule), `src/lib/lunar.ts`, `src/app/(site)/lich-tu-hoc/page.js`, `src/components/calendar/MonthGrid.tsx`, `src/components/calendar/EventCard.tsx`

**Quy mô:** M

---

### T12: Trang chủ – khóa tu sắp tới, Lời Thầy dạy và đếm ngày trên hero

**Mô tả:** `PricingPlan` thành "Khóa tu sắp tới": 3 chương trình tiêu biểu thay 3 gói giá, nút "Xem chi tiết". `Testimonials2` thành "Lời Thầy dạy": slider tự chạy các câu kệ chủ đề tháng / kho pháp ngữ, chữ `scripture`. Thêm khung (2) vào hero: khóa tu kế tiếp với dòng "Còn N ngày" tính theo ngày (render phía server, giờ Việt Nam).

**File Bexon:** `sections/pricing-plan/PricingPlan.js`, `shared/pricing-plan/PricingPlanItems.js`, `sections/testimonials/Testimonials2.js`, `sections/hero/Hero2.js`

**Tiêu chí nghiệm thu:**
- [ ] Số ngày đúng theo `Asia/Ho_Chi_Minh`, kể cả quanh nửa đêm (unit test)
- [ ] Không còn chữ "gói", giá tiền hay ký hiệu tiền tệ nào từ khuôn Pricing
- [ ] Khi không còn khóa tu sắp tới, hero bỏ khung (2) và khối Khóa tu ẩn, không lỗi

**Kiểm chứng:**
- [ ] `npm test -- countdown`
- [ ] `npm run test:e2e -- home`

**Phụ thuộc:** T10, T11

**File dự kiến:** `src/components/sections/pricing-plan/PricingPlan.js`, `src/components/sections/testimonials/Testimonials2.js`, `src/components/sections/hero/Hero2.js`, `src/lib/countdown.ts`, `tests/unit/countdown.test.ts`

**Quy mô:** M

---

### T13a: Giới thiệu – trang chủ đề

**Mô tả:** Adapter `gioi-thieu` (6 chủ đề, 3 nhóm). `/gioi-thieu`: lưới 6 thẻ theo nhóm. `/gioi-thieu/[slug]` theo khuôn `TeamDetails1`: banner, chân dung 3:4, tổng quan, trích dẫn (`scripture`), mốc niên biểu, nội dung, album (T9).

**File Bexon:** `sections/teams/TeamDetails1.js`, `sections/history/*`

**Tiêu chí nghiệm thu:**
- [ ] 6 trang render phía server, mỗi trang có `<title>` và mô tả riêng
- [ ] Báo cáo snapshot nêu rõ lệch nội dung `/gioi-thieu/su-phu-tru-tri` (tiêu đề Thích Tâm Hòa, nội dung Đại sư Liên Đăng) để Ban Biên Tập sửa trong admin cũ
- [ ] Mốc niên biểu là danh sách có thứ tự (`<ol>`), đọc đúng bằng trình đọc màn hình

**Kiểm chứng:**
- [ ] `npm run test:e2e -- gioi-thieu`
- [ ] `npm run snapshot:check`

**Phụ thuộc:** T9

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm gioi-thieu), `src/app/(site)/gioi-thieu/page.js`, `src/app/(site)/gioi-thieu/[slug]/page.js`, `src/components/sections/teams/TeamDetails1.js`

**Quy mô:** M

---

### T13b: Trang chủ – Lời chào và Chư Tôn Đức

**Mô tả:** `About2` thành "Lời chào" Bổn tự (số liệu chạy bằng odometer, ảnh parallax). `Team1` thành "Chư Tôn Đức": 4 thẻ chân dung 3:4 dẫn tới trang `/gioi-thieu/[slug]` tương ứng, bỏ phân trang. Thêm 2 khối vào mảng trang chủ đúng vị trí đã chốt.

**File Bexon:** `sections/about/About2.js`, `sections/teams/Team1.js`

**Tiêu chí nghiệm thu:**
- [ ] Số liệu odometer có giá trị cuối đúng trong HTML (trình đọc màn hình và chế độ giảm chuyển động thấy số thật)
- [ ] 4 thẻ Chư Tôn Đức dẫn đúng trang giới thiệu, không có liên kết hỏng
- [ ] Hai khối nằm đúng thứ tự đã chốt trên trang chủ

**Kiểm chứng:**
- [ ] `npm run test:e2e -- home`

**Phụ thuộc:** T10, T13a

**File dự kiến:** `src/components/sections/about/About2.js`, `src/components/sections/teams/Team1.js`, `src/app/(site)/page.js`, `tests/e2e/home.spec.ts`

**Quy mô:** M

---

### T14: Tông Chỉ Tu Học

**Mô tả:** Adapter `tong-chi` (25 bài, 5 nhóm; khối video, bài nổi bật, album, sách nguồn, từ khóa). `/tong-chi-tu-hoc` và khối trang chủ dùng `Services2` (section tối, thẻ xếp chồng khi cuộn, tiêu đề dính) cho 5 nhóm. `/tong-chi-tu-hoc/[slug]` theo khuôn `ServiceDetailsMain`, render phía server. `Process` thành "Lộ trình tu học" (4 bước).

**File Bexon:** `sections/services/Services2.js`, `layout/main/ServiceDetailsMain.js`, `sections/process/Process.js`

**Tiêu chí nghiệm thu:**
- [ ] `/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh` có nội dung trong HTML ban đầu (site cũ chỉ có "Đang tải…")
- [ ] Khối phụ (video, sách nguồn, từ khóa) ẩn sạch khi không có dữ liệu
- [ ] Section tối đạt axe 0 lỗi; thẻ xếp chồng không che nội dung ở 375px và trở về dạng danh sách khi giảm chuyển động

**Kiểm chứng:**
- [ ] `npm run test:e2e -- tong-chi`

**Phụ thuộc:** T9, T10

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm tong-chi), `src/app/(site)/tong-chi-tu-hoc/page.js`, `src/app/(site)/tong-chi-tu-hoc/[slug]/page.js`, `src/components/sections/services/Services2.js`, `src/components/sections/process/Process.js`

**Quy mô:** M

---

### Checkpoint C: Trang chủ đủ khối chính
- [ ] 6 lệnh chuẩn xanh; `v2.` cập nhật
- [ ] Trang chủ có đủ khối theo thứ tự đã chốt: hero 3 khung, lối vào, khóa tu sắp tới, tin mới, lời chào, Tông Chỉ, lộ trình, Lời Thầy dạy, Chư Tôn Đức (khu vực nổi bật thêm ở T15)
- [ ] Ban Trị Sự xem `v2.` và góp ý

---

### T15: Vũ Trụ Phật Giáo – bản đồ 2D và trang khu vực

**Mô tả:** Adapter `vu-tru` (lọc tự viện Tùng Lâm Hòa Phúc, chỉ khu vực đang hiển thị → 12). `/vu-tru-phat-giao`: ảnh bản đồ + ghim đặt theo `mapPos` % (nút có nhãn) + danh sách khu vực tương đương. `/vu-tru-phat-giao/[slug]` theo khuôn `PortfolioDetailsMain`: giới thiệu, bảo tượng trong khu vực, câu chuyện, không gian (album), khu vực khác; Giảng đường có Pháp thoại nổi bật (video T9). Trang chủ: `Portfolios2` thành "Khu vực nổi bật", slider tự chạy.

**File Bexon:** `sections/portfolios/Portfolios2.js`, `layout/main/PortfolioDetailsMain.js`, `shared/cards/PortfolioCard2.js` / `PortfolioCard3.js`

**Tiêu chí nghiệm thu:**
- [ ] Ghim bản đồ dùng được bằng bàn phím, vùng chạm ≥ 48px, giữ đúng vị trí từ 375 đến 1440px
- [ ] Hiển thị 12 khu vực; lý do 14 bản ghi trong dữ liệu được ghi trong báo cáo snapshot
- [ ] Liên kết sang bảo tượng dùng đúng dạng `/bao-tuong/{slug}_{mã}`

**Kiểm chứng:**
- [ ] `npm run test:e2e -- vu-tru`

**Phụ thuộc:** T9, T10

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm vu-tru), `src/app/(site)/vu-tru-phat-giao/page.js`, `src/app/(site)/vu-tru-phat-giao/[slug]/page.js`, `src/components/site/TempleMap.tsx`, `src/components/sections/portfolios/Portfolios2.js`

**Quy mô:** M

---

### T16: Bảo Tượng Phật Giáo

**Mô tả:** Adapter `bao-tuong` (126 tượng, 15 cụm; ghép khu vực theo `areaId`). `/bao-tuong-phat-giao`: lưới thẻ chân dung 3:4 theo `TeamCard`, lọc chúng hội / khu vực / loại tượng (`<select>` gốc), tìm theo tên hoặc mã, phân trang 24 trên URL. `/bao-tuong/[slugCode]` theo khuôn `TeamDetails1`: chân dung, danh hiệu, lời dạy (`scripture`), bài viết, nghệ thuật Phật giáo (album), video, bảo tượng liên quan.

**File Bexon:** `shared/cards/TeamCard*.js`, `sections/teams/TeamDetails1.js`

**Tiêu chí nghiệm thu:**
- [ ] Trang danh sách tải ≤ 24 ảnh lúc đầu (site cũ tải 109 ảnh)
- [ ] URL `/bao-tuong/{slug}_{mã}` cũ mở đúng tượng; mã sai trả 404
- [ ] Lọc và tìm giữ trên URL; không có kết quả thì hiện hướng dẫn bỏ lọc

**Kiểm chứng:**
- [ ] `npm run test:e2e -- bao-tuong`

**Phụ thuộc:** T15

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm bao-tuong), `src/app/(site)/bao-tuong-phat-giao/page.js`, `src/app/(site)/bao-tuong/[slugCode]/page.js`, `src/components/shared/cards/TeamCard.js`, `tests/e2e/bao-tuong.spec.ts`

**Quy mô:** M

---

### T17: Trí Tuệ Phật Pháp

**Mô tả:** Dùng adapter posts (4 tiểu mục: Bài viết nghiên cứu · Pháp âm giảng giải · Video Phật pháp · Ấn phẩm & kinh sách). `/tri-tue-phat-phap` dùng lại khuôn T7, lọc theo tiểu mục. Chi tiết dùng lại khuôn T8, thêm biến thể: sách (bìa 3:4, nguồn), pháp âm (`<audio controls preload="none">`), video. `/tri-tue-phat-phap/hoc-tieng-tang` render phía server.

**File Bexon:** như T7, T8

**Tiêu chí nghiệm thu:**
- [ ] 158 mục chia đúng 4 tiểu mục (126 / 15 / 15 / 2)
- [ ] Pháp âm không tự phát, không tải trước file âm thanh
- [ ] `/tri-tue-phat-phap/hoc-tieng-tang` có nội dung trong HTML ban đầu

**Kiểm chứng:**
- [ ] `npm run test:e2e -- tri-tue`

**Phụ thuộc:** T8

**File dự kiến:** `src/app/(site)/tri-tue-phat-phap/page.js`, `src/app/(site)/tri-tue-phat-phap/[slug]/page.js`, `src/components/site/PublicationMeta.tsx`, `src/lib/content/sources/snapshot.ts`

**Quy mô:** M

---

### T18: Liên hệ và tìm kiếm từ khóa

**Mô tả:** `/lien-he` theo khuôn `ContactTop` + `Contact3` (bỏ form, chưa có nơi nhận): danh bạ (liên kết `tel:` ≥ 48px), giờ mở cửa, địa chỉ, ảnh bản đồ tĩnh + nút "Mở Google Maps", mạng xã hội, đọc từ cấu hình site. `/tim-kiem?q=`: tìm không phân biệt dấu trên tiêu đề + tóm tắt của mọi chuyên mục, nhóm theo chuyên mục, phân trang; nhận truy vấn từ popup tìm kiếm ở header và bật cờ hiện nút tìm kiếm (T5b).

**File Bexon:** `sections/contacts/ContactTop.js`, `sections/contacts/Contact3.js`, `layout/header/Header.js` (popup tìm kiếm)

**Tiêu chí nghiệm thu:**
- [ ] "niem phat" và "niệm Phật" cho cùng kết quả
- [ ] Truy vấn rỗng hoặc không có kết quả hiện gợi ý chuyên mục
- [ ] Trang liên hệ không nhúng iframe bản đồ khi tải

**Kiểm chứng:**
- [ ] `npm test -- search`
- [ ] `npm run test:e2e -- lien-he tim-kiem`

**Phụ thuộc:** T5b, T13a, T14–T17

**File dự kiến:** `src/app/(site)/lien-he/page.js`, `src/app/(site)/tim-kiem/page.js`, `src/lib/search.ts`, `tests/unit/search.test.ts`

**Quy mô:** M

---

### Checkpoint D: Site công khai hoàn chỉnh trên `v2.`
- [ ] Mọi route "Ra mắt sớm" trong Sơ đồ route của plan.md render; e2e, axe, test canh gác xanh
- [ ] `public/fakedata` và `src/libs/get*` đã xóa
- [ ] Ban Trị Sự và Ban Truyền Thông duyệt `v2.`; góp ý ghi thành task bổ sung

---

## Giai đoạn 3 – Ra mắt sớm trên www

### T19: Đọc dữ liệu trực tiếp từ B2

**Mô tả:** Nguồn `b2` cho `ContentRepository`: đọc 13 file JSON (~12 MB) trên bucket admin cũ đang ghi, qua S3 API bằng khóa ứng dụng B2 chỉ đọc (Worker secret, ký bằng `aws4fetch`). Mỗi file chỉ tải một lần mỗi chu kỳ (so `ETag`, lưu bằng Cache API), không tải lại cho từng trang. Trang dùng ISR làm mới 5 phút; bật bộ đệm dữ liệu của vinext trên KV (tạo namespace KV, khai báo trong `cloudflare.config.ts`; T1 đã chọn "không bộ đệm"). Trang `/van-hanh/lam-moi` (đặt sau Access ở T21) có nút "Làm mới site" để Ban Biên Tập cập nhật ngay sau khi lưu ở admin cũ. File đọc dở / parse lỗi thì giữ bản trang cũ và ghi log. Site mới **không bao giờ ghi** vào B2.

**Tiêu chí nghiệm thu:**
- [ ] Sửa một bài trong admin cũ → `v2.` hiện bản mới trong ≤ 5 phút, hoặc ngay sau khi gọi làm mới
- [ ] Cố tình làm hỏng file JSON (bản sao trên bucket thử) → trang vẫn phục vụ bản cũ, log có lỗi
- [ ] Khóa B2 không xuất hiện trong bundle phía trình duyệt; khóa không có quyền ghi (kiểm bằng lệnh ghi thử bị từ chối)

**Kiểm chứng:**
- [ ] `npm test -- sources/b2` (mock S3)
- [ ] Thử thật trên `v2.` với `CONTENT_SOURCE=b2`

**Phụ thuộc:** Checkpoint D; chuẩn bị #4 (bucket + khóa chỉ đọc)

**File dự kiến:** `src/lib/content/sources/b2.ts`, `src/app/van-hanh/lam-moi/page.tsx`, `vite.config.ts`, `cloudflare.config.ts`, `tests/unit/content/b2.test.ts`

**Quy mô:** M

---

### T20: SEO trước ra mắt

**Mô tả:** `generateMetadata` cho mọi route (thay metadata "Bexon - Corporate Business…" của gói); ảnh OG động (Satori + `brand-tokens.json`); `sitemap.xml` động; `robots.txt` theo host (`www` cho phép index, `v2.` chặn); JSON-LD `Article`, `Event`, `Place`, `Organization`; bộ favicon + manifest (tạm từ logo WebP, thay khi có SVG); bật Cloudflare Web Analytics (không cookie, HT-07).

**Tiêu chí nghiệm thu:**
- [ ] Không có 2 trang trùng `<title>`; sitemap liệt kê mọi trang công khai
- [ ] Rich Results Test hợp lệ cho 1 bài viết và 1 sự kiện mẫu
- [ ] `v2.` trả noindex, `www` (giả lập host) cho phép index

**Kiểm chứng:**
- [ ] `npm run test:e2e -- seo`

**Phụ thuộc:** Checkpoint D. Song song được với T19.

**File dự kiến:** `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `src/lib/seo/jsonld.ts`, `src/app/icon.png` (và bộ favicon)

**Quy mô:** M

---

### T21: Đưa admin cũ sang `quantri.tunglamhoaphuc.com` sau Cloudflare Access

**Mô tả:** Việc hạ tầng, không sửa code app mới; giải quyết HT-01. Chi tiết và hiện trạng đã kiểm: [docs/van-hanh/admin-cu.md](../docs/van-hanh/admin-cu.md). Khảo sát 02/11 cho thấy site công khai cũ đọc dữ liệu bằng `GET /api/admin/*`, nên không khóa trọn `/api/admin*` bằng Access được. Làm 2 phần:
- **Phần 1 (làm ngay):**
  - Access cho `www…/admin`, `www…/login`, `www…/van-hanh` và toàn bộ `beta.` (host này chạy nguyên site cũ).
  - Worker `tlhp-admin-guard` (route `www…/api/*`) chỉ cho qua lệnh đọc mà site công khai cần; lệnh ghi và endpoint có tác dụng phụ phải có phiên Access hợp lệ.
  - Người được phép: `database.tunglamhoaphuc@gmail.com`.
- **Phần 2 (trước T22):** gắn `quantri.tunglamhoaphuc.com` vào project Vercel, đặt sau Access; bật Vercel Deployment Protection cho `*.vercel.app`. Không dùng tên `admin.` hay `old.` (đang trỏ về máy chủ WordPress).

**Tiêu chí nghiệm thu:**
- [x] Mở `www…/admin`, `www…/login`, `beta.` khi chưa đăng nhập Access đều bị chặn; trang công khai vẫn hiện đủ nội dung
- [x] `POST /api/admin/*` không có phiên Access trả 403; chủ tài khoản đăng nhập Access sửa và lưu được bài như trước
- [ ] (Phần 2) `quantri.` sau Access dùng được; địa chỉ `*.vercel.app` của site cũ yêu cầu xác thực Vercel

**Kiểm chứng:**
- [ ] `cd workers/admin-guard && npm test` (43 test)
- [ ] Bảng kiểm ở mục 3 bước 4 của `docs/van-hanh/admin-cu.md`

**Tiến độ 02/11/2026:** Phần 1 đã chạy thật. Zero Trust bật (nhóm `lingering-heart-cb52`); 2 ứng dụng Access và Worker `tlhp-admin-guard` đã deploy; trang công khai vẫn hiện đủ, lệnh ghi không có phiên bị 403, chủ tài khoản đăng nhập Access và lưu bài được. **Phần 1 xong.** Phần 2 chưa làm.

**Phụ thuộc:** Phần 2: chuẩn bị #5 (quyền project Vercel)

**File dự kiến:** `docs/van-hanh/admin-cu.md`, `workers/admin-guard/` (Worker chặn + test)

**Quy mô:** M

---

### T22: Kiểm thử trước ra mắt và chuyển `www`

**Mô tả:** Trên `v2.` với `CONTENT_SOURCE=b2`: lập danh sách mọi URL công khai từ dữ liệu (bài, tông chỉ, giới thiệu, khu vực, bảo tượng, trí tuệ) và kiểm từng URL trả 200; Lighthouse 6 mẫu trang; axe mọi mẫu trang; Ban Biên Tập soát 20 trang tiêu biểu. Trên app mới: `/admin*` và `/login` chuyển hướng sang `quantri.`. Gỡ route `www…/api/*` của Worker `tlhp-admin-guard` (T21) trước khi chuyển. Chuyển: gắn Workers Custom Domain `www.tunglamhoaphuc.com` (và tên miền gốc chuyển về `www`) cho Worker `tlhp-web`, gỡ bản ghi trỏ về Vercel. Ghi sẵn và diễn tập các bước quay lại Vercel. Theo dõi 48 giờ: log Worker, tỷ lệ 404, Web Analytics.

**Tiêu chí nghiệm thu:**
- [ ] 100% URL công khai từ dữ liệu trả 200 trên `v2.` trước khi chuyển (danh sách lưu trong repo)
- [ ] Sau khi chuyển, e2e smoke xanh trên `https://www.tunglamhoaphuc.com`; `www/admin` chuyển sang `quantri.`
- [ ] Các bước quay lại Vercel đã diễn tập, thực hiện được trong ≤ 15 phút

**Kiểm chứng:**
- [ ] `npm run check:urls -- --base=https://v2.tunglamhoaphuc.com`
- [ ] `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke`

**Phụ thuộc:** T19, T20, T21

**File dự kiến:** `scripts/check-urls.ts`, `src/middleware.ts` (chuyển hướng admin cũ), `tests/e2e/smoke.spec.ts`, `docs/van-hanh/chuyen-www.md`

**Quy mô:** M

---

### Checkpoint E: Ra mắt `www`
- [ ] Ban Trị Sự duyệt `v2.` trước khi chuyển
- [ ] `www` chạy giao diện mới, đọc dữ liệu B2; admin cũ hoạt động ở `quantri.` sau Access
- [ ] 48 giờ đầu không có lỗi nghiêm trọng; tỷ lệ 404 không tăng so với trước khi chuyển

---

## Giai đoạn 4 – Dữ liệu D1 (song song với giai đoạn 3)

### T23: Schema D1 và script nhập

**Mô tả:** Schema Drizzle theo mô hình đặc tả 3.1 (thêm `Monk` cho Danh Tăng): Post, Category, TeachingArticle (+ khối con), Page + Milestone, Area, Statue, StatueCluster, ArtVariation, Monk, CalendarEvent, MonthTheme, FeaturedProgram, Media, Album, PageView, Setting, Notice, User, AuditLog, Registration, Redirect. `scripts/import.ts` đọc từ nguồn `snapshot` hoặc `b2` (dùng lại bộ chuẩn hóa), lưu khóa R2 thay URL tuyệt đối, khu vực / cụm tượng chỉ lưu một nơi. Script chạy lại được nhiều lần (sẽ chạy lần cuối ở T39).

**Tiêu chí nghiệm thu:**
- [ ] Chạy import nhiều lần cho cùng kết quả (idempotent) trên D1 local
- [ ] Số bản ghi khớp nguồn: 632 bài · 25 Tông Chỉ · 6 Giới thiệu · 14 khu vực · 126 tượng · 91 Danh Tăng · 15 sự kiện · 3 chương trình · 12 chủ đề tháng
- [ ] Khu vực và cụm tượng liên kết bằng khóa ngoại, không còn tên lặp

**Kiểm chứng:**
- [ ] `cf d1 migrations apply --local` rồi `npm run import -- --from=snapshot`
- [ ] `npm test -- import`

**Phụ thuộc:** Checkpoint D

**File dự kiến:** `src/db/schema.ts`, `drizzle.config.ts`, `migrations/`, `scripts/import.ts`, `tests/unit/import.test.ts`

**Quy mô:** L (không tách: schema và script nhập phải kiểm cùng nhau trên cùng bộ số liệu)

---

### T24: Repository D1 và contract test

**Mô tả:** Nguồn `d1` cho `ContentRepository`. Bộ contract test chạy chung cho cả 3 nguồn (`snapshot`, `b2`, `d1`). Cache theo tag (`cacheTag` / `revalidateTag` của vinext trên bộ đệm KV) để trang cập nhật khi admin mới lưu. Trong giai đoạn này `d1` chỉ bật trên `v2.`; `www` vẫn đọc `b2` cho tới T39.

**Tiêu chí nghiệm thu:**
- [ ] Contract test xanh cho cả 3 nguồn
- [ ] Toàn bộ e2e site công khai xanh khi chạy với `CONTENT_SOURCE=d1`
- [ ] Gọi `revalidateTag` sau khi ghi thì trang liên quan đổi ngay lần tải kế tiếp

**Kiểm chứng:**
- [ ] `npm test -- contract`
- [ ] `CONTENT_SOURCE=d1 npm run preview` rồi `npm run test:e2e`

**Phụ thuộc:** T23

**File dự kiến:** `src/lib/content/sources/d1.ts`, `src/lib/content/index.ts`, `tests/contract/repository.test.ts`, `cloudflare.config.ts`

**Quy mô:** M

---

### T25: Đếm lượt xem theo ngày

**Mô tả:** `POST /api/views` gửi bằng `sendBeacon` sau khi đọc 5 giây; bỏ qua bot; UPSERT vào `PageView(entity_type, entity_id, date, count)` trong D1. Lượt xem hiển thị = `viewsCount` cũ trong JSON + tổng PageView. Tạo D1 production và chạy migration (chưa nhập nội dung) để bật được trên `www` ngay khi xong (độc lập với nguồn nội dung), chấm dứt tình trạng lượt xem đứng yên từ ngày ra mắt sớm.

**Tiêu chí nghiệm thu:**
- [ ] Hai lượt ghi đồng thời không mất số (test song song)
- [ ] User-agent crawler không được tính
- [ ] Không cookie, không lưu định danh người đọc

**Kiểm chứng:**
- [ ] `npm test -- views`

**Phụ thuộc:** T23 (bảng PageView); Checkpoint E nếu bật trên `www`

**File dự kiến:** `src/app/api/views/route.ts`, `src/components/site/ViewBeacon.tsx`, `src/lib/views.ts`, `tests/unit/views.test.ts`

**Quy mô:** S

---

### T26: Đăng ký khóa tu (công khai)

**Mô tả:** `/dang-ky` theo bố cục form `Contact3`: chọn khóa tu đang mở (`<select>` gốc); trường tối giản theo đặc tả 3.2 và DL-01 (họ tên 2–80 ký tự, pháp danh tùy chọn, SĐT `^0\d{9}$`, email tùy chọn, số người 1–20, ghi chú ≤ 500). Server action + zod, Turnstile, giới hạn tần suất. Nhãn luôn hiện phía trên ô, ô cao 48px. Lỗi hiện ngay dưới trường + khối tóm tắt trên nút gửi, focus vào khối tóm tắt, giữ dữ liệu. Thành công → `/dang-ky/thanh-cong`: mã đăng ký, tóm tắt, lời dặn y phục – tư trang, nút In phiếu, mã QR. Chỉ bật trên `v2.`; lên `www` ở T39 cùng module admin Đăng ký. Ngoài phạm vi: email xác nhận (DL-03), Google Sheets (DL-04), Telegram/Zalo (DL-05).

**File Bexon:** `sections/contacts/Contact3.js`

**Tiêu chí nghiệm thu:**
- [ ] Gửi hợp lệ tạo bản ghi `Registration` và sang trang thành công có mã; tải lại trang thành công không gửi lại
- [ ] Gửi lỗi giữ dữ liệu; lỗi đọc được bằng trình đọc màn hình (`role="alert"`, `aria-describedby`); vẫn kiểm phía server khi tắt JavaScript
- [ ] Không hộp thông báo nổi ở mọi trạng thái (sweetalert2 đã gỡ)

**Kiểm chứng:**
- [ ] `npm run test:e2e -- registration` (cả trường hợp tắt JS)
- [ ] `npm test -- registration`

**Phụ thuộc:** T11, T24

**File dự kiến:** `src/app/(site)/dang-ky/page.js`, `src/app/(site)/dang-ky/actions.ts`, `src/app/(site)/dang-ky/thanh-cong/page.js`, `src/lib/registration.ts`, `tests/e2e/registration.spec.ts`

**Quy mô:** M

---

### Checkpoint F: Dữ liệu
- [ ] Import khớp số; e2e trên D1 xanh; đăng ký chạy đầu-cuối trên `v2.`
- [ ] Review bảo mật form đăng ký (validate phía server, giới hạn tần suất, dữ liệu cá nhân theo NĐ 13/2023)

---

## Giai đoạn 5 – Trang quản trị mới

> Admin dùng Bootstrap 5 + cầu nối theme như site, cộng partial `components/_admin.scss`. Bexon không có giao diện admin, nên bố cục admin tự dựng từ thành phần Bootstrap và kiểu nút / ô nhập đã đổi theme. Trong giai đoạn này admin mới chỉ chạy trên `v2.` với dữ liệu D1 thử; Ban Biên Tập vẫn soạn ở admin cũ.

### T27a: Xác thực Access, phân quyền, nhật ký

**Mô tả:** Middleware xác minh JWT Cloudflare Access (`Cf-Access-Jwt-Assertion`, khóa công khai của team) cho `/admin/*` và `/api/admin/*`. Bảng `User` (email, vai trò `super_admin | editor | coordinator`). `requireRole()` gọi trong mọi server action/route admin; `audit()` ghi `AuditLog`. Chế độ bỏ qua xác thực chỉ bật khi `NODE_ENV=development` và có `ADMIN_DEV_EMAIL`. Không có trang `/login`. Trên `www`, `/admin` vẫn chuyển sang `quantri.` cho tới T39.

**Tiêu chí nghiệm thu:**
- [ ] Thiếu hoặc sai JWT → 403 cho cả trang và API (test); mã nguồn không chứa mật khẩu nào
- [ ] Editor không vào được dữ liệu đăng ký; coordinator không sửa được bài (test theo vai trò)
- [ ] Mỗi thao tác ghi tạo đúng 1 dòng `AuditLog` (ai, gì, lúc nào, diff)

**Kiểm chứng:**
- [ ] `npm test -- auth rbac audit`

**Phụ thuộc:** T24

**File dự kiến:** `src/middleware.ts`, `src/lib/auth/access.ts`, `src/lib/auth/rbac.ts`, `src/lib/audit.ts`, `tests/unit/auth.test.ts`

**Quy mô:** M

---

### T27b: Khung giao diện admin

**Mô tả:** Layout `/admin` bằng Bootstrap + cầu nối theme: sidebar (mở rộng / thu gọn, nhớ lựa chọn), breadcrumb, thẻ tiêu đề module (icon, tên, số bản ghi, mô tả, cụm nút), partial `_admin.scss` (cỡ nút `sm` 40px chỉ dùng trong bảng admin). Layout gọi `requireRole()` của T27a. Dùng được trên điện thoại.

**Tiêu chí nghiệm thu:**
- [ ] Sidebar dùng được bằng bàn phím, thu gọn ở 375px, nhớ trạng thái mở/thu
- [ ] axe 0 lỗi trên khung admin; màu và font giống site công khai
- [ ] Người không có vai trò trong bảng `User` thấy trang "Chưa được cấp quyền" thay vì khung admin

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-shell`

**Phụ thuộc:** T27a

**File dự kiến:** `src/app/admin/layout.tsx`, `src/components/admin/Sidebar.tsx`, `src/app/assets/sass/components/_admin.scss`, `tests/e2e/admin-shell.spec.ts`

**Quy mô:** M

---

### T28: Admin – Tổng quan

**Mô tả:** Thẻ KPI: lượt xem hôm nay / 7 ngày / 30 ngày (từ PageView), số bài theo chuyên mục, sự kiện sắp tới, đăng ký mới. Biểu đồ lượt xem theo ngày bằng chart.js có sẵn trong gói, màu lấy từ `brand-tokens.json`. Bảng top 20 có tab chuyên mục. Mọi ngày giờ định dạng `vi-VN`.

**Tiêu chí nghiệm thu:**
- [ ] Số liệu khớp truy vấn D1 trên dữ liệu mẫu
- [ ] Biểu đồ có bảng số liệu tương đương cho trình đọc màn hình
- [ ] Không còn chuỗi ngày ISO thô trên màn hình

**Kiểm chứng:**
- [ ] `npm test -- stats`
- [ ] `npm run test:e2e -- admin-dashboard`

**Phụ thuộc:** T25, T27b

**File dự kiến:** `src/app/admin/page.tsx`, `src/lib/admin/stats.ts`, `src/components/admin/KpiCard.tsx`, `src/components/admin/ViewsChart.tsx`

**Quy mô:** M

---

### T29: Bảng quản trị dùng chung và danh sách Dòng Chảy

**Mô tả:** `ResourceTable` (bảng Bootstrap): phân trang phía server 20 dòng, tìm kiếm, lọc, sắp xếp, trạng thái trên URL; cột gọn không cuộn ngang ở 1366px; dạng thẻ ở điện thoại. `/admin/posts` dùng nó: lọc 4 danh mục có số đếm, sắp xếp theo ngày / lượt xem / thứ tự thủ công.

**Tiêu chí nghiệm thu:**
- [ ] 472 bài Dòng Chảy duyệt được 20 dòng/trang, tìm theo tiêu đề và tác giả
- [ ] Không có thanh cuộn ngang ở 1366px; dùng được ở 375px
- [ ] `ResourceTable` không phụ thuộc kiểu `Post` (có test với dữ liệu giả)

**Kiểm chứng:**
- [ ] `npm test -- resource-table`
- [ ] `npm run test:e2e -- admin-posts`

**Phụ thuộc:** T27b

**File dự kiến:** `src/components/admin/ResourceTable.tsx`, `src/app/admin/posts/page.tsx`, `src/lib/admin/query-params.ts`, `tests/e2e/admin-posts.spec.ts`

**Quy mô:** M

---

### T30: Admin – Thư viện ảnh R2

**Mô tả:** `/admin/thu-vien-anh`: cây thư mục + lưới ảnh, tìm, lọc thời gian. Tải lên kéo-thả; nén WebP phía trình duyệt (canvas, cạnh dài ≤ 2560px, ≤ 10 MB), bắt buộc mô tả ảnh (alt). Đổi tên / xóa có kiểm "đang dùng ở N bài". `MediaPicker` để chọn ảnh trong form. Cần bucket R2 (Giai đoạn 1 của kế hoạch Cloudflare); khi phát triển dùng R2 local.

**Tiêu chí nghiệm thu:**
- [ ] Ảnh JPG 8 MB tải lên thành WebP ≤ 2560px trong R2, có bản ghi `Media` kèm alt
- [ ] Xóa ảnh đang dùng bị chặn bằng thông báo in-line "Không thể xóa: ảnh đang được dùng ở 3 bài viết"
- [ ] Chỉ nhận jpg/png/webp/gif, kiểm cả phía server theo magic bytes

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-media`

**Phụ thuộc:** T29

**File dự kiến:** `src/app/admin/thu-vien-anh/page.tsx`, `src/app/api/admin/media/route.ts`, `src/lib/media/compress-client.ts`, `src/components/admin/MediaPicker.tsx`, `tests/e2e/admin-media.spec.ts`

**Quy mô:** M

---

### T31: Admin – Trang sửa bài và trình soạn thảo

**Mô tả:** `/admin/posts/[id]` và `/admin/posts/new`: form chia khối (thông tin, ảnh bìa + tiêu điểm, nội dung TipTap, video, album, kỳ trước / sắp diễn ra, SEO). Bộ đếm ký tự tiêu đề ≤ 80, phụ đề ≤ 60 (chặn khi Xuất bản, cho lưu nháp). Trạng thái Nháp / Xuất bản / Lưu trữ; xóa = Lưu trữ có bước xác nhận và khôi phục. Ctrl+S lưu. Dòng trạng thái in-line "Đã lưu lúc 10:42". `ResourceForm` dùng chung cho các module sau.

**Tiêu chí nghiệm thu:**
- [ ] Lưu xong trang công khai (nguồn `d1`) cập nhật và `AuditLog` ghi diff
- [ ] HTML từ trình soạn thảo được làm sạch phía server trước khi lưu
- [ ] Không hộp thông báo nổi; rời trang khi chưa lưu có cảnh báo `beforeunload`

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-post-edit`
- [ ] `npm test -- sanitize`

**Phụ thuộc:** T30

**File dự kiến:** `src/app/admin/posts/[id]/page.tsx`, `src/app/admin/posts/[id]/actions.ts`, `src/components/admin/ResourceForm.tsx`, `src/components/admin/RichEditor.tsx`, `src/components/admin/CharCounter.tsx`

**Quy mô:** M

---

### Checkpoint G: Admin lõi
- [ ] Biên tập viên thử trên `v2.`: tạo bài → chèn ảnh → xuất bản → thấy bài trên `v2.`
- [ ] Review bảo mật (agent `security-auditor`) cho xác thực, upload, làm sạch HTML
- [ ] Kích thước Worker sau build dưới giới hạn (dòng "Total Upload" khi `npm run deploy:v2`; mốc T1: 623 KB nén)

---

### T32: Admin – Lịch tu học và sự kiện

**Mô tả:** `/admin/lich-tu-hoc`: lưới tháng (dương + âm), thêm/sửa sự kiện (ngày dương, hiện ngày âm, nhiều ngày, khung giờ, địa điểm, loại), lặp theo âm lịch (mùng 1, 14, 15, 30), chủ đề tháng (poster + câu kệ), 3 chương trình tiêu biểu, kho ảnh pháp ngữ, mở/đóng đăng ký và chỉ tiêu cho từng khóa tu.

**Tiêu chí nghiệm thu:**
- [ ] Sự kiện "Sám hối mùng 1 & 15 ÂL" sinh đúng ngày cho 12 tháng (unit test)
- [ ] Đổi trạng thái đăng ký hiện ngay ở `/dang-ky` và chip trên thẻ khóa tu
- [ ] Lưu ghi `AuditLog`; `/lich-tu-hoc` cập nhật

**Kiểm chứng:**
- [ ] `npm test -- recurrence`
- [ ] `npm run test:e2e -- admin-calendar`

**Phụ thuộc:** T11, T31

**File dự kiến:** `src/app/admin/lich-tu-hoc/page.tsx`, `src/app/admin/lich-tu-hoc/actions.ts`, `src/components/admin/CalendarEditor.tsx`, `src/lib/recurrence.ts`, `tests/unit/recurrence.test.ts`

**Quy mô:** M

---

### T33: Admin – Đăng ký khóa tu

**Mô tả:** `/admin/dang-ky`: lọc theo khóa tu và trạng thái (Chờ duyệt / Đã duyệt / Hủy), tìm theo tên / SĐT, đổi trạng thái hàng loạt, xuất CSV (UTF-8 có BOM để Excel đọc đúng), in danh sách điểm danh. Chỉ Super Admin và Điều Phối Viên.

**Tiêu chí nghiệm thu:**
- [ ] File CSV mở bằng Excel hiển thị đúng tiếng Việt
- [ ] Vai trò editor bị 403 (test)
- [ ] Mỗi lần xuất file ghi `AuditLog`

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-registrations`

**Phụ thuộc:** T26, T29

**File dự kiến:** `src/app/admin/dang-ky/page.tsx`, `src/app/admin/dang-ky/actions.ts`, `src/app/api/admin/registrations/export/route.ts`, `tests/e2e/admin-registrations.spec.ts`

**Quy mô:** M

---

### T34: Admin – Tông Chỉ và Trí Tuệ

**Mô tả:** Dùng `ResourceTable` + `ResourceForm`. Tông Chỉ: khối lồng (video, bài nổi bật, album, sách nguồn, từ khóa) bằng `RepeaterField` thêm / xóa / sắp xếp. Trí Tuệ: lọc bài theo 4 tiểu mục, trường ngày, nguồn sách.

**Tiêu chí nghiệm thu:**
- [ ] Sửa khối lồng lưu đúng và hiện trên trang công khai
- [ ] Không tạo bảng/form mới ngoài `RepeaterField` (dùng lại mẫu T29, T31)
- [ ] Editor sửa được; coordinator chỉ xem

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-tong-chi admin-tri-tue`

**Phụ thuộc:** T31

**File dự kiến:** `src/app/admin/tong-chi/page.tsx`, `src/app/admin/tong-chi/[id]/page.tsx`, `src/app/admin/tri-tue-phat-phap/page.tsx`, `src/components/admin/RepeaterField.tsx`

**Quy mô:** M

---

### T35: Admin – Giới thiệu và Danh Tăng

**Mô tả:** Giới thiệu: 6 chủ đề, mốc niên biểu (`RepeaterField`), trích dẫn, album, chân dung; chặn xuất bản khi phụ đề vượt 60 ký tự (2 bài đang vượt). Danh Tăng & Tổ Sư (chỉ trong admin, chưa công khai – Câu hỏi mở #5): lưới thẻ chân dung 3:4, lọc vùng miền / hội chúng / tông phái, sửa tiểu sử và pháp ngữ.

**Tiêu chí nghiệm thu:**
- [ ] Thêm / sắp xếp mốc niên biểu hiện đúng thứ tự trên trang Giới thiệu
- [ ] 91 vị Danh Tăng lọc được theo 4 vùng và 2 hội chúng
- [ ] Không xuất bản được khi phụ đề vượt giới hạn

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-gioi-thieu admin-danh-tang`

**Phụ thuộc:** T34

**File dự kiến:** `src/app/admin/gioi-thieu/page.tsx`, `src/app/admin/gioi-thieu/[id]/page.tsx`, `src/app/admin/danh-tang/page.tsx`, `src/app/admin/danh-tang/[id]/page.tsx`

**Quy mô:** M

---

### Checkpoint H: Nội dung chính quản trị được
- [ ] Lịch tu học, Đăng ký, Tông Chỉ, Trí Tuệ, Giới thiệu, Danh Tăng sửa được trên `v2.`; e2e theo vai trò xanh
- [ ] Ban Biên Tập xem nhanh các module này, góp ý ghi thành task

---

### T36: Admin – Vũ Trụ Phật Giáo

**Mô tả:** Bảng 14 không gian, lọc theo tự viện (hệ thống đa tự viện). Đặt ghim bằng cách bấm lên ảnh bản đồ (lưu x, y %) hoặc nhập số. Gán bảo tượng an vị bằng chọn từ danh sách (khóa ngoại). Câu chuyện, pháp thoại Giảng đường, bật/tắt hiển thị.

**Tiêu chí nghiệm thu:**
- [ ] Bấm lên bản đồ đặt ghim; xem trước khớp vị trí trên trang công khai
- [ ] Gán bảo tượng chỉ bằng chọn, không nhập tên tự do
- [ ] Bật/tắt hiển thị quyết định số khu vực ngoài site

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-vu-tru`

**Phụ thuộc:** T31

**File dự kiến:** `src/app/admin/vu-tru-phat-giao/page.tsx`, `src/app/admin/vu-tru-phat-giao/[id]/page.tsx`, `src/components/admin/MapPinEditor.tsx`

**Quy mô:** M

---

### T37: Admin – Bảo Tượng

**Mô tả:** Chế độ thẻ / bảng; lọc chúng hội, khu vực, loại tượng; tìm theo mã TPxxxx. Trang sửa 5 phần (Cơ bản · Bài viết · Video · Album · Liên quan). Xoay ảnh 90°, đặt tiêu điểm ảnh. Mã tượng duy nhất.

**Tiêu chí nghiệm thu:**
- [ ] Tìm "TP0001" ra đúng 1 tượng; tạo mã trùng bị chặn với lỗi in-line
- [ ] Xoay ảnh và tiêu điểm hiển thị đúng trên trang công khai
- [ ] Bảo tượng liên quan chọn từ danh sách, hiển thị 2 chiều

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-bao-tuong`

**Phụ thuộc:** T36

**File dự kiến:** `src/app/admin/bao-tuong/page.tsx`, `src/app/admin/bao-tuong/[id]/page.tsx`, `src/components/admin/ImageFocalEditor.tsx`

**Quy mô:** M

---

### T38: Admin – Cấu hình, tài khoản, nhật ký

**Mô tả:** Cấu hình: thông tin chùa, danh bạ, giờ mở cửa, mạng xã hội, SEO mặc định, dải thông báo (nội dung, bật/tắt, ngày hết hạn), bảng redirect 301. Chuyển `src/config/site.ts` sang đọc `Setting` trong D1 (file giữ làm giá trị mặc định). Tài khoản: thêm email + vai trò (chỉ Super Admin). Nhật ký thao tác có lọc theo người, module, thời gian.

**Tiêu chí nghiệm thu:**
- [ ] Đổi số điện thoại trong Cấu hình → header, footer, trang liên hệ cập nhật
- [ ] Dải thông báo tự ẩn sau ngày hết hạn
- [ ] Chỉ Super Admin vào được Tài khoản và Nhật ký

**Kiểm chứng:**
- [ ] `npm run test:e2e -- admin-settings`

**Phụ thuộc:** T27b

**File dự kiến:** `src/app/admin/cau-hinh/page.tsx`, `src/app/admin/tai-khoan/page.tsx`, `src/app/admin/nhat-ky/page.tsx`, `src/lib/settings.ts`

**Quy mô:** M

---

### T38b: Sao lưu D1 và diễn tập khôi phục

**Mô tả:** Theo DL-06: ghi lại cách khôi phục D1 theo thời điểm (Time Travel); Worker riêng `tlhp-backup` chạy Cron 02:00 giờ Việt Nam, xuất D1 production ra file nén lưu vào bucket R2 sao lưu, giữ 30 ngày bằng lifecycle rule. Diễn tập khôi phục một lần vào một D1 thử trước ngày chuyển hẳn (T39).

**Tiêu chí nghiệm thu:**
- [ ] Mỗi ngày có đúng 1 bản sao lưu mới; bản cũ hơn 30 ngày tự xóa
- [ ] Diễn tập khôi phục thành công từ bản sao lưu và bằng Time Travel; ghi lại thời gian thực hiện
- [ ] Có tài liệu khôi phục từng bước cho Quản trị hệ thống

**Kiểm chứng:**
- [ ] Gọi thủ công Cron trên tài khoản thật, kiểm file trong R2
- [ ] Khôi phục vào D1 thử, so số bản ghi

**Phụ thuộc:** T24 (D1 production). Song song được với T32–T38.

**File dự kiến:** `workers/backup/index.ts`, `workers/backup/cloudflare.config.ts`, `docs/van-hanh/sao-luu.md`

**Quy mô:** M

---

### Checkpoint I: Admin hoàn chỉnh
- [ ] 10 module cũ + Đăng ký, Cấu hình, Tài khoản, Nhật ký dùng được trên `v2.`; e2e theo vai trò xanh
- [ ] Sao lưu D1 chạy hằng ngày, đã diễn tập khôi phục
- [ ] Ban Biên Tập dùng thử một buổi trên `v2.`, góp ý ghi thành task; chốt ngày chuyển hẳn

---

## Giai đoạn 6 – Chuyển hẳn và hoàn thiện

### T39: Chuyển hẳn sang D1 và admin mới

**Mô tả:** Theo thứ tự, trong một khung giờ đã báo trước:
1. Đóng băng admin cũ (Access chỉ cho quyền xem, báo Ban Biên Tập ngừng soạn).
2. Chạy `scripts/import.ts --from=b2` lần cuối lên D1 production.
3. Chép ảnh B2 → R2 nếu Giai đoạn 1 của kế hoạch Cloudflare chưa làm; đổi `mediaUrl()` sang `media.tunglamhoaphuc.com`.
4. Đặt `CONTENT_SOURCE=d1` trên `www`.
5. Mở `/admin` mới trên `www` (Access, vai trò từ bảng `User`) và bật `/dang-ky`; nút "Đăng ký khóa tu" trỏ về `/dang-ky`.
6. Nạp bảng redirect 301 URL WordPress cũ.
7. Giữ admin cũ ở `quantri.` chế độ chỉ xem 2–4 tuần rồi tắt; giữ B2 và WordPress chỉ đọc theo kế hoạch Cloudflare.

Đường lùi: trả `CONTENT_SOURCE=b2` và mở lại quyền ghi admin cũ.

**Tiêu chí nghiệm thu:**
- [ ] Số bản ghi D1 production khớp B2 tại thời điểm đóng băng (báo cáo import lưu lại)
- [ ] Sau khi chuyển, toàn bộ URL công khai vẫn trả 200 (chạy lại `check:urls` trên `www`); URL WordPress mẫu trả 301 đúng đích
- [ ] Ban Biên Tập sửa và xuất bản được bài trên admin mới; đăng ký khóa tu chạy đầu-cuối trên `www`

**Kiểm chứng:**
- [ ] `npm run check:urls -- --base=https://www.tunglamhoaphuc.com`
- [ ] `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke registration`

**Phụ thuộc:** Checkpoint E, Checkpoint I

**File dự kiến:** `src/middleware.ts` (redirect 301, bỏ chuyển hướng admin cũ), `cloudflare.config.ts`, `src/lib/media/url.ts`, `docs/van-hanh/chuyen-han.md`

**Quy mô:** M

---

### T40: Khối "Hỏi AI Hòa Phúc"

**Mô tả:** Khối `Cta` cuối trang và một section trên trang chủ, trang khu vực trở thành ô hỏi đáp (không bong bóng chat nổi). Route server làm cầu nối tới Dify (khóa ở secret), Turnstile, giới hạn 10 câu/phút/IP, câu hỏi 3–500 ký tự; câu trả lời hiển thị in-line kèm nguồn. Chưa có cấu hình → giữ khối "Xem lịch tu học".

**File Bexon:** `sections/cta/Cta.js`

**Tiêu chí nghiệm thu:**
- [ ] Khóa Dify không xuất hiện trong bundle phía trình duyệt
- [ ] Câu thứ 11 trong 1 phút bị từ chối bằng thông báo in-line kính ngữ
- [ ] Thiếu cấu hình thì trang không lỗi, khối quay về "Xem lịch tu học"

**Kiểm chứng:**
- [ ] `npm test -- rate-limit`
- [ ] `npm run test:e2e -- ask-ai` (mock Dify)

**Phụ thuộc:** T10; Câu hỏi mở #4 (thông tin Dify). Có thể kéo lên trước T22 nếu có sớm thông tin Dify.

**File dự kiến:** `src/components/site/AskAi.tsx`, `src/app/api/ask/route.ts`, `src/lib/rate-limit.ts`, `src/components/sections/cta/Cta.js`, `tests/e2e/ask-ai.spec.ts`

**Quy mô:** M

---

### T41a: Gọn CSS, icon font và JavaScript hiệu ứng

**Mô tả:** Thay `bootstrap.min.css` bằng import SCSS Bootstrap theo module thực dùng; cắt `font-awesome-pro` / `bexon-icons` chỉ còn biểu tượng dùng tới; xóa partial SCSS và hàm hiệu ứng GSAP không còn phần tử nào dùng; chỉ nạp GSAP ở trang có hiệu ứng cần nó. Không đổi giao diện.

**Tiêu chí nghiệm thu:**
- [ ] Dung lượng CSS và JS tải ở trang chủ giảm so với mốc Checkpoint B (ghi số trước–sau)
- [ ] Ảnh chụp 6 mẫu trang trước–sau không khác nhau (so ảnh tự động)
- [ ] Mọi biểu tượng đang dùng vẫn hiển thị (không còn ô vuông lỗi font)

**Kiểm chứng:**
- [ ] `npm run build` ghi dung lượng; `npm run test:e2e -- visual`

**Phụ thuộc:** Checkpoint E (làm được trước T39)

**File dự kiến:** `src/app/globals.scss`, `src/app/assets/sass/utilities/_bootstrap.scss`, `src/components/shared/wrappers/ClientWrapper.js`, `tests/e2e/visual.spec.ts`

**Quy mô:** M

---

### T41b: Ảnh qua Image Transformations và đo toàn site

**Mô tả:** Loader `next/image` dùng Image Transformations (`/cdn-cgi/image/width=…,format=auto/…`) trên ảnh R2; `srcset` theo cỡ hiển thị; preload font chính. Lighthouse CI cho 6 mẫu trang; axe cho mọi route công khai và admin.

**Tiêu chí nghiệm thu:**
- [ ] LCP và CLS đạt mục tiêu đã chốt ở Checkpoint B (mặc định LCP < 2,0 s, CLS = 0, mô phỏng 4G di động)
- [ ] Không ảnh nào tải lớn hơn 2 lần cỡ hiển thị
- [ ] axe 0 lỗi nghiêm trọng trên mọi mẫu trang

**Kiểm chứng:**
- [ ] `npx lhci autorun` trên `v2.`
- [ ] `npm run test:e2e -- a11y`

**Phụ thuộc:** T39 (ảnh đã ở R2), T41a

**File dự kiến:** `src/lib/image-loader.ts`, `next.config.js`, `lighthouserc.json`, `tests/e2e/a11y.spec.ts`

**Quy mô:** M

---

### Checkpoint J: Hoàn tất
- [ ] Mọi tiêu chí nghiệm thu đạt; 6 lệnh chuẩn xanh
- [ ] `www` chạy D1 + admin mới ổn định 2 tuần
- [ ] Tắt admin cũ ở `quantri.`, chuyển B2 và WordPress sang chỉ đọc rồi tắt theo kế hoạch Cloudflare
