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

**Tiến độ 17/11/2026: phần mã xong, chờ kho GitHub (câu hỏi mở #7).** Chưa có kho nên chưa chạy workflow trên GitHub; các lệnh trong đó đã chạy được trên máy. Việc của chủ site (tạo kho, token, secret, bật bảo vệ nhánh) và việc kiểm sau khi có kho: [docs/van-hanh/ci.md](../docs/van-hanh/ci.md).
- `.github/workflows/ci.yml`: job `check` (lint, kiểm kiểu, test đơn vị, build) và job `e2e` (toàn bộ, trừ `visual`); `.github/workflows/deploy-v2.yml`: đẩy vào `main` thì test đơn vị, `npm run deploy:v2`, rồi `smoke` và `seo` vào `v2.`; chỉ bước deploy thấy secret.
- `.github/actions/snapshot`: bản build gói `data/snapshot/` (không nằm trong git) nên mọi job phải có nó; lấy từ cache theo tuần, không có thì `snapshot:fetch -- --albums`. Giới hạn: nguồn đó là site cũ công khai, biến mất sau T22.
- `git ls-files` không có zip, `reference/`, `.dev.vars` hay khóa nào (kiểm).

**Tiêu chí nghiệm thu:**
- [ ] Pull request làm hỏng 1 test thì CI báo đỏ, không merge được
- [ ] Merge vào `main` thì `v2.` cập nhật trong ≤ 10 phút
- [x] `git ls-files` không có file zip, `reference/`, `.dev.vars` hay khóa bí mật nào

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
- **Còn lại cho T13b:** số đếm odometer hiện 0 cho tới khi cuộn tới. (Đã xong ở T13b: HTML có số thật.)

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

**Kết quả 03/11/2026:** xong (chưa có trang nào dùng; T7 là trang đầu tiên).
- **Mã ở `src/libs/content/`** (theo nếp `src/libs` đang có, thay cho `src/lib/content` dự kiến):
  - `types.ts`: kiểu miền và `ContentRepository`.
  - `schema.ts`: zod, nới lỏng.
  - `media.ts`: `mediaUrl()`, `mediaKey()`.
  - `normalize.ts`: ngày, chữ, Markdown nhẹ → HTML.
  - `posts.ts`: bản ghi thô → `Post` kèm báo cáo.
  - `repository.ts`: lọc, sắp xếp, phân trang trong bộ nhớ; `getContentRepository()` chọn nguồn theo `CONTENT_SOURCE`.
  - `sources/snapshot.ts`: nạp `data/snapshot/*.json` qua `import.meta.glob`; thiếu file thì không có nội dung, build không hỏng.
- **Snapshot tạm** (chuẩn bị #1 chưa làm, máy này không có ổ Z:): `npm run snapshot:fetch` gọi đúng các lệnh GET danh sách mà trình duyệt người đọc site cũ vẫn gọi, mỗi chuyên mục một lần.
  - Danh sách không lọc để trống album của khoảng 500 bài, nên phải gọi theo chuyên mục.
  - Chỉ đọc, không ghi gì lên site cũ. `data/snapshot/` nằm ngoài git.
  - Khi có bản chép từ B2 thì dùng bản đó.
- **`mediaUrl()`:**
  - Gom hai địa chỉ của cùng bucket B2 `s2-cnv03` (`…s3.us-east-005.backblazeb2.com/<key>` và `b1.congngheviet.com.vn/file/s2-cnv03/<key>`, tên miền của bên cung cấp) về `MEDIA_BASE`, là chỗ duy nhất phải đổi khi chuyển R2.
  - Ảnh WordPress chưa có bản sao trên B2, nên giữ ở `admin.`.
  - Liên kết `tunglamhoaphuc.com/wp-content/…` (33 bài, file mp3) chuyển sang `admin.`, vì `www` sẽ thuộc site mới.
- **Nội dung bài:**
  - Đã khảo sát cả 632 bài: chỉ có chữ thường với tiêu đề `#`, trích dẫn `>`, danh sách, đường kẻ, link trần, `&nbsp;`; không có HTML.
  - Bộ chuyển tự viết escape mọi chữ trước, chỉ sinh đúng các thẻ đó, nên không thẻ nào từ nguồn lọt ra trang. Link chỉ nhận http(s)/mailto/tel.
  - API chi tiết có thêm `contentHtml` lấy từ WordPress, nhưng chỉ gồm cùng các đoạn văn đó cộng album, nên không cần.
- **Quy tắc dữ liệu:**
  - Hai bài trùng slug: bài đứng trước giữ slug, đúng như site cũ trả.
  - Bài không có tiêu đề: tạm lấy câu đầu nội dung, để đường dẫn cũ vẫn mở được.
  - Mỗi chuyên mục dùng một tên (tên nhiều bài dùng nhất).
  - Bỏ ảnh biểu tượng cảm xúc của Facebook lẫn trong album.
  - Bỏ nửa ký tự emoji bị cắt dở. Vite từ chối file vì ký tự này, nên snapshot nạp dạng văn bản rồi `JSON.parse`.
- **`npm run snapshot:check`:** 632 bản ghi; Dòng Chảy 472 (471 dùng được), Trí Tuệ 158, Vũ Trụ Phật Giáo 2. Bất thường để Ban Biên Tập xem:
  - 2 bài không tiêu đề;
  - 1 slug trùng (`phap-hoi-huyet-bon-trai`);
  - "Ấn Phẩm & Sách"/"Ấn Phẩm Sách";
  - 11 bài còn ảnh trên WordPress;
  - 20 bài có emoji Facebook;
  - 3 bài không tóm tắt;
  - **447 bài album trống trong danh sách** (xem rủi ro bên dưới).
- **Chạy thử trong Worker** bằng một route tạm (đã gỡ):
  - Cục bộ và trên `v2.` đều trả đúng.
  - Snapshot nằm trong gói Worker, không nằm trong tài nguyên công khai. Gói Worker nén 722 KB khi có snapshot (hiện 496 KB).
- **Rủi ro mới, đã ghi vào plan (bảng rủi ro, câu hỏi mở #8):**
  - **Gói Workers Free.** Tài khoản đang ở gói này, 10 ms CPU mỗi lượt. Lần đầu đọc snapshot tốn 154–557 ms CPU; ngay trang Bexon hiện tại cũng trung vị 14 ms, p90 126 ms. Cloudflare vẫn trả "ok" nhưng đã vượt hạn mức. Cần chủ tài khoản quyết bật Workers Paid trước khi ra mắt; T19 dù sao cũng nên chuẩn hóa sẵn dữ liệu.
  - **Album trống.** API danh sách để trống album của 447 bài; chỉ API chi tiết có ảnh. Cần xem file gốc trên B2 (chuẩn bị #1) trước T8.
- **Gói mới:** `zod` (chạy cả ở Worker), `tsx` (chạy script). `tsconfig` kiểm cả `scripts/`.
- **Để sau:** làm sạch HTML cho nguồn có HTML thật (`mainContentHtml` của Giới thiệu, `fullHistoryHtml` của Bảo tượng) làm ở T13a/T16, khi có dữ liệu để thử.

**Tiêu chí nghiệm thu:**
- [x] Parse 632 bản ghi posts thật; bản ghi sai cấu trúc được liệt kê trong báo cáo, không làm hỏng build
- [x] `listPosts({ category, sort, page, pageSize })` và `getPostBySlug(slug)` trả đúng; slug không tồn tại trả `null`
- [x] HTML đầu ra không còn `<script>`, thuộc tính `on*`, `javascript:`; mọi URL ảnh đi qua `mediaUrl()`

**Kiểm chứng:**
- [x] `npm test`: 55 test. Fixture rút gọn (`tests/unit/content/`) và 2 test trên snapshot thật, tự bỏ qua khi chưa có snapshot. Test thật kiểm 632 bản ghi, số theo chuyên mục, không còn script/on*/`javascript:`, ảnh chỉ còn ở B2 và `admin.`
- [x] `npm run snapshot:check` in số bản ghi theo chuyên mục (Dòng Chảy 472, Trí Tuệ 158…)

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

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Popup tìm kiếm** (cờ `site.features.search`, đang tắt; `/styleguide` bật sẵn để xem trước):
  - Là hộp thoại có bẫy focus, focus vào ô nhập khi mở; Esc, nút Đóng hoặc bấm ra ngoài đều đóng và trả focus về nút mở.
  - Gửi `GET /tim-kiem?q=`. Khi đóng thì ẩn hẳn (trước đó chỉ trượt khỏi màn hình nên vẫn nhận focus).
  - Bexon ẩn tìm kiếm dưới 992px; nay dùng được ở mọi cỡ. Dưới 576px ô tìm kiếm nằm trong menu trượt để header vẫn một hàng.
  - Nút "Đăng ký khóa tu" nhường chỗ ở 768–1023px và 1280–1599px khi có nút tìm kiếm.
- **Dải thông báo** (`AnnouncementBar`, đọc `site.announcement`, đang để trống; `/styleguide` có mẫu):
  - Nằm trong luồng ở đầu `#smooth-content` của mọi trang (trừ `error.js`), nền `accent-soft`, cao tối thiểu 48px, có hạn hiển thị theo giờ Việt Nam.
  - Nút "Đóng" nhớ trong phiên (`sessionStorage`), đưa focus về logo.
  - Một đoạn script nhỏ chạy trước khi vẽ trang: ẩn dải đã đóng (không nháy) và báo chiều cao thật cho header nổi qua `--tlhp-announcement-offset`. Header dính không bị ảnh hưởng.
- **Sửa lỗi gốc của Bexon phát hiện trong lúc làm:**
  - `a:focus` và `button:focus-visible` bị đặt `outline: none` trên toàn site, nên dùng phím không thấy mình đang ở đâu (WCAG 2.4.7). Nay có vòng focus kép cho mọi liên kết, nút và ô nhập.
  - `transition: all` trên `a`, `button`, `span`, `li`, `input`… làm phần tử con của bảng vừa mở bị ẩn thêm 0,3 giây và không nhận focus; nay `visibility` đổi ngay.
  - ScrollSmoother cuộn trang khi focus vào phần tử nằm ngoài nội dung cuộn (header, popup), làm trang nhảy và đổi sang header dính; nay bỏ qua những phần tử đó (`onFocusIn`).
  - `useFocusTrap` thử focus lại qua vài khung hình cho bảng hiện bằng chuyển `visibility`. Menu trượt của T5a dính đúng lỗi này; test T5a nay kiểm cả focus ban đầu.
- **Lưu ý:** token `--tlhp-announcement-h` (48px) là chiều cao chuẩn của dải, không phải độ lệch của header; lần đầu đặt trùng tên làm header mọi trang lệch 48px, test đã bắt được.
- **Để T6:** khi đưa header/footer vào `src/app/(site)/layout.js`, chuyển `AnnouncementBar` theo, bỏ dòng thêm vào từng trang.

**Tiêu chí nghiệm thu:**
- [x] Popup tìm kiếm: Esc đóng và trả focus về nút mở; focus không thoát ra ngoài khi đang mở (1440px và 768px; điện thoại dùng ô trong menu trượt)
- [x] Đóng dải thông báo thì không hiện lại trong phiên (phiên mới hiện lại); dải không làm header dính nhảy vị trí
- [x] Khi cờ tìm kiếm tắt, không còn nút hay đường dẫn nào trỏ tới `/tim-kiem` (kiểm trên `/`, `/blogs`, `/contact`)

**Kiểm chứng:**
- [x] `npm run test:e2e -- header-extras` (34 test, chạy lặp 2 lần vẫn xanh); toàn bộ e2e 125 xanh trên `v2.`; unit 24 xanh
- [x] Ảnh: `docs/anh/t5b-tim-kiem-va-thong-bao.png`

**Phụ thuộc:** T5a

**File dự kiến:** `src/components/layout/header/Header.js`, `src/components/layout/AnnouncementBar.tsx`, `src/config/site.ts`, `tests/e2e/header-extras.spec.ts`

**Quy mô:** M

---

### T6: Footer, khối kết trang, nút lên đầu trang và trang 404

**Mô tả:** Đưa header + footer vào `src/app/(site)/layout.js` (Bexon đặt trong từng trang). `Footer2`: 4 cột (Bổn tự · Thời khóa tu học · Liên hệ · Bản đồ tĩnh + nút "Mở Google Maps"), dải chữ chạy đổi thành "Nơi để trở về – Chốn thiêng bình yên", dải cuối "© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc". `Cta` thành khối kết trang "Xem lịch tu học" trước footer ở trang trong. `BackToTop` giữ, có nhãn "Về đầu trang", vùng chạm ≥ 48px, không che nội dung ở 375px. `ErrorPrimary` thành trang 404 giọng kính ngữ, trả 404 thật.

**File Bexon:** `components/layout/footer/Footer2.js`, `sections/cta/Cta.js`, `sections/error/ErrorPrimary.js`, `shared/others/BackToTop.js`, `assets/sass/components/_footer.scss`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Khung chung `SiteShell`** (`src/components/layout/SiteShell.tsx`): header nổi + header dính, dải thông báo, trang, footer, nút lên đầu trang, hiệu ứng. Hai nhóm route dùng nó:
  - `(home)/layout.tsx`: trang chủ, header trong suốt (`header-2`).
  - `(site)/layout.tsx`: trang trong, header nền sáng.
  - `/styleguide` (ngoài nhóm) gọi `SiteShell` với tìm kiếm và thông báo mẫu.
  - Các trang chỉ còn `<main>`; dòng `AnnouncementBar` thêm ở T5b đã bỏ khỏi từng trang.
- **Hiệu ứng khi chuyển trang:** khung không còn dựng lại mỗi trang như Bexon, nên `PageEffects` khởi động lại `ClientWrapper` theo đường dẫn (ScrollSmoother, wow.js, tách chữ). Test kiểm trang mới bắt đầu ở đầu trang và cuộn mượt chạy lại.
- **Footer2** (nền `.tlhp-dark`):
  - 4 cột Bổn tự · Thời khóa tu học · Liên hệ · Bản đồ chùa, 1 → 2 → 4 cột.
  - Ấn tròn bản ngà mới: `public/brand/logo-tung-lam-hoa-phuc-tron-nga.webp`, dựng từ bản đen.
  - 7 số điện thoại nhóm theo vai trò, mỗi số là liên kết `tel:` cao 48px.
  - Chữ chạy "Nơi để trở về · Chốn thiêng bình yên" có ấn tròn xen giữa, `aria-hidden` vì khẩu hiệu đã có ở dải cuối.
  - Dải cuối: "© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc" · khẩu hiệu · nút "Về đầu trang".
  - Bỏ ô đăng ký email, logo giải thưởng, mạng xã hội mẫu.
- **Khối kết trang (Cta):** "Về chùa tu học" + nút "Xem lịch tu học", phủ lên đầu footer 120px như Bexon (dùng `:has()`; trình duyệt cũ thì xếp trên footer). Nửa ảnh tạm là ấn tròn trên nền nâu sẫm, chờ ảnh chùa.
- **BackToTop:** nay là `<button aria-label="Về đầu trang">` (Bexon dùng `div` bấm chuột), cỡ 60/50px.
  - Tự ẩn khi dải cuối footer hiện ra.
  - Trên điện thoại chỉ hiện khi cuộn ngược lên, để không che cột chữ khi đọc.
  - Bấm nút này hoặc nút ở footer thì cuộn lên và đưa focus về logo.
- **Trang 404** (`ErrorPrimary` giọng kính ngữ, banner "Không tìm thấy trang", breadcrumb tiếng Việt):
  - Trả HTTP 404, có `noindex`.
  - Route `(site)/[...missing]` bắt mọi đường dẫn lạ. Lý do: vinext render `app/not-found.js` bên trong layout `(home)`, Next.js thì render trần; cả hai đều làm khung lồng đôi hoặc mất khung.
  - Bỏ `app/loading.js` rỗng của Bexon: nó bọc trang trong Suspense nên `notFound()` trả 200 (`/blogs/9999`). `BlogMain` cần Suspense riêng cho `useSearchParams()`.
  - `error.js` chuyển vào nhóm route, có nút "Thử lại".
- **Sửa lỗi gốc của Bexon phát hiện trong lúc làm:**
  - wow.js ẩn khối chưa cuộn tới bằng `visibility`, nên Tab bỏ qua mọi liên kết trong đó (cả 4 cột footer) cho tới khi người dùng tự cuộn. Nay ẩn bằng `opacity`, khối hiện ngay khi nhận focus.
  - Giảm chuyển động chỉ rút thời lượng chuyển cảnh, còn độ trễ thì giữ: chữ slider hero vẫn chờ tới 1,4 giây, axe trên `v2.` bắt được lúc nút chưa có tên. Nay bỏ cả độ trễ.
  - axe trên `/`: mũi tên slider là `div role="button"` không tên, không dùng được bằng phím; nay là `<button>` "Trang trước/Trang sau". Hai liên kết chỉ có icon có thêm nhãn.
- **Ảnh tạm thay ảnh giữ chỗ:** nền banner trang trong (`pheader-bg.webp` có chữ "890X42", lớp phủ xanh két) đổi sang nền gỗ mộc ấm cho tới khi T7 có ảnh.
- **Chờ nhà chùa:**
  - Ảnh bản đồ tĩnh (`site.mapImage`, dựng khi có link Google Maps của chùa, GD-06); tạm hiện khung địa chỉ.
  - Mạng xã hội (GD-06).
  - Lịch cộng tu định kỳ cho cột Thời khóa (lấy từ dữ liệu lịch ở T12).
  - Duyệt đoạn giới thiệu nháp `site.intro`.
- **Lưu ý:** tiêu đề trang 404 lấy từ `metadata` của `[...missing]/page.js` (vinext bỏ qua `metadata` của `not-found.js`); vinext chèn hai thẻ `robots noindex`, vô hại.

**Tiêu chí nghiệm thu:**
- [x] Footer 1 → 2 → 4 cột theo điểm ngắt; mỗi số điện thoại là liên kết `tel:` cao ≥ 48px; chữ chạy dừng ở chế độ giảm chuyển động
- [x] URL không tồn tại trả HTTP 404 với trang tùy biến
- [x] Test canh gác và axe xanh trên `/` và trang 404

**Kiểm chứng:**
- [x] `npm run test:e2e`: `footer.spec.ts` 56 test; toàn bộ e2e 185 xanh cục bộ và trên `v2.` (footer + canh gác chạy lặp 2 lần vẫn xanh); unit 24 xanh
- [x] `curl -I` một URL sai trên `npm run preview` trả 404 (cả `/a/b/c` và `/blogs/9999`)
- [x] Ảnh: `docs/anh/t6-footer-va-404.png`

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

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Trang `src/app/(site)/dong-chay-hoang-phap/page.tsx`** (server):
  - Đọc `getContentRepository()`; lọc, sắp xếp, phân trang 12 bài ở server.
  - Tham số URL đọc/ghi một chỗ (`src/libs/postList.ts`): `?danh-muc=&sap-xep=moi-nhat|cu-nhat|a-z|z-a&trang=`, bỏ giá trị mặc định nên danh sách gốc giữ địa chỉ trần.
  - Giá trị lạ (sắp xếp sai, `trang=abc`) quay về mặc định.
- **Thanh công cụ:**
  - 5 nút lọc dạng pill có số bài, là liên kết thật với `aria-current`. Trên điện thoại gộp một hàng vuốt ngang.
  - `<select>` sắp xếp gốc (`SortSelect`), chờ 300 ms sau mỗi lần đổi vì phím mũi tên trên ô chọn đóng phát `change` từng lần. Không có JavaScript thì có nút "Áp dụng".
  - Dòng trạng thái `role="status"`, ví dụ "189 bài trong “Cộng Tu Định Kỳ” · trang 1/16".
- **Thẻ bài `PostCard`** (dựa trên `.blog-item` của Bexon; `BlogCard2` để nguyên cho trang chủ T10):
  - Ảnh 4:3 có kích thước cố định, nhãn ngày Bexon trên ảnh.
  - Chip chuyên mục → tiêu đề h3 (tối đa 3 dòng) → tóm tắt (3 dòng) → ngày đăng · lượt xem.
  - 3 ảnh đầu tải ngay, các ảnh sau tải lười.
- **Phân trang `PageLinks`:** liên kết thật ở server theo kiểu `.tj-pagination` (1 … 4 5 6 … 40). Sang trang khác thì lướt về đầu danh sách và đưa focus vào tiêu đề danh sách.
- **Trạng thái rỗng:** `NoItems` viết lại, bỏ markup WooCommerce. Chuyên mục không có, chuyên mục rỗng, hay trang vượt giới hạn đều có nút quay lại.
- **Đo được:**
  - HTML 158–162 KB với 12 thẻ (site cũ 472 thẻ, khoảng 3 MB).
  - CLS = 0 ở 1440 và 375px, bật hay tắt hiệu ứng.
  - Bấm lọc giữ nguyên focus ở nút vừa bấm.
  - ScrollSmoother tự cập nhật chiều cao khi danh sách đổi.
  - Back trả về đúng chỗ.
  - vinext không dựng lại trang khi chỉ đổi tham số URL.
- **Sửa trong lúc làm:**
  - `focus()` một phần tử trong nội dung làm ScrollSmoother đưa phần tử đó ra giữa màn hình, đè lên lệnh cuộn của trang. Nay phần tử `tabindex="-1"` (do script focus) không bị ScrollSmoother tự cuộn.
  - Khi cuộn mượt đang chạy, `scrollIntoView` nhắm sai vì nội dung đang lướt dở; nay nhờ `ScrollSmoother.scrollTo` cuộn.
- **Lớp nội dung (T4) bổ sung:**
  - 12 bài không có tóm tắt hoặc tóm tắt là chữ mẫu "Tóm tắt nội dung bài viết…": tạm lấy đầu nội dung.
  - Báo cáo thêm 9 nhóm bài trùng tiêu đề trong cùng chuyên mục (dư 10 bài, nhiều bài giống hệt nhau). Các bài vẫn hiển thị, để Ban Biên Tập gộp.
- **Còn lại cho sau:**
  - **Ảnh gốc quá nặng:** thẻ 480px đang tải ảnh gốc 2.048–6.048px. Thu nhỏ là việc của T41b (Image Transformations), nên làm sớm trước ra mắt.
  - **Trang chi tiết:** liên kết chi tiết `/dong-chay-hoang-phap/<slug>` hiện vào trang 404 cho tới T8.

**Tiêu chí nghiệm thu:**
- [x] HTML trang đầu chỉ chứa ≤ 12 thẻ bài (site cũ: 472 thẻ, 3 MB); đổi bộ lọc giữ trạng thái trên URL, nút Back hoạt động
- [x] Danh mục rỗng hoặc số trang vượt giới hạn hiện trạng thái rỗng có lối quay lại
- [x] Ảnh thẻ có kích thước cố định (CLS = 0), ảnh ngoài màn hình đầu tải lười

**Kiểm chứng:**
- [x] `npm run test:e2e -- dong-chay` (24 test, chạy lặp 2 lần vẫn xanh, có thêm axe và bản không JavaScript); toàn bộ e2e 216 xanh cục bộ và trên `v2.`; unit 63 xanh
- [x] Đo kích thước HTML trang danh sách trên `npm run preview`: 158 KB
- [x] Ảnh: `docs/anh/t7-dong-chay-hoang-phap.png`

**Phụ thuộc:** T4, T6

**File dự kiến:** `src/app/(site)/dong-chay-hoang-phap/page.js`, `src/components/sections/hero/HeroInner.js`, `src/components/layout/main/BlogMain.js`, `src/components/shared/cards/BlogCard2.js`, `tests/e2e/dong-chay.spec.ts`

**Quy mô:** M

---

### T8: Trang chi tiết bài viết và chế độ đọc

**Mô tả:** Route `/dong-chay-hoang-phap/[slug]`, render phía server. Breadcrumb + "Quay lại Dòng Chảy Hoằng Pháp", tiêu đề, meta (ngày, tác giả, lượt xem), thanh tab neo (Tổng quan · Nội dung chính · Video · Album ảnh · Các kỳ trước · Sắp diễn ra; chỉ hiện tab có dữ liệu; chạy đúng khi bật cuộn mượt). Thân bài trong `.tlhp-reading`; nút A− / A+ (4 mức) và Ngà / Giấy dó / Đêm thiền đặt `data-theme` trên khung đọc (lưu `localStorage`). Bỏ sidebar widget và bình luận của Bexon. `generateMetadata` riêng từng bài. Slug sai → `notFound()`.

**File Bexon:** `layout/main/BlogDetailsMain.js`, `assets/sass/layout/_blog-details.scss`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Trang `src/app/(site)/dong-chay-hoang-phap/[slug]/page.tsx`** (server):
  - Có `generateMetadata` riêng từng bài.
  - Banner `HeroInner` là tiêu đề bài (cỡ h2, không dùng cỡ 70px của Bexon), breadcrumb Trang chủ › Dòng Chảy Hoằng Pháp › chuyên mục.
  - Có liên kết "Quay lại Dòng Chảy Hoằng Pháp".
  - Bỏ sidebar widget và bình luận của Bexon.
  - Slug không có, hoặc bài của Trí Tuệ đặt dưới đường dẫn này → `notFound()`, trả HTTP 404.
- **Các phần của bài** (tab neo `AnchorTabs`, chỉ hiện phần có dữ liệu):
  - Tổng quan: chip, ngày, tác giả, lượt xem, ảnh banner, và lời dẫn nếu tóm tắt không chép lại đầu bài.
  - Nội dung chính.
  - Video: link YouTube trong bài, mở trên YouTube, không nhúng iframe.
  - Album ảnh: 12 ảnh, "Xem thêm N ảnh" đưa focus tới ảnh mới; bấm ảnh mở lightbox GLightbox của Bexon.
  - Tìm hiểu thêm: 3 bài cùng chuyên mục.
  - Bấm tab thì lướt tới phần đó (qua ScrollSmoother), đưa focus vào, ghi `#` lên địa chỉ; tab của phần đang đọc được đánh dấu.
  - "Các kỳ trước" và "Sắp diễn ra": cả 632 bài đều để trống hai trường này nên chưa dựng.
- **Khung đọc `ReadingFrame`:**
  - A− / A+ có 4 mức (90 · 100 · 115 · 130%), tên nút chứa đúng chữ hiển thị.
  - Ngà / Giấy dó / Đêm thiền đặt `data-theme` trên khung đọc, không đặt trên `<html>`.
  - Lựa chọn lưu ở `localStorage`. Một script nhỏ áp dụng trước khi vẽ để không nháy nền.
- **Album:**
  - `npm run snapshot:fetch -- --albums` gọi API chi tiết công khai (3 lượt song song, có nghỉ) cho 447 bài mà danh sách để trống album; lưu `data/snapshot/post-albums.json`, được 441 album, 15.466 ảnh.
  - Repository chỉ nạp file này khi mở trang chi tiết, nên trang danh sách không chậm thêm.
- **Lớp nội dung:**
  - Thêm `intro`, `videos`.
  - Slug so ở dạng đã giải mã: 11 bài có slug lưu sẵn dạng mã hóa (emoji). API site cũ trả 404 cho cả 11; site mới mở được.
  - Báo cáo `snapshot:check` tính cả album lấy riêng; còn 6 bài thiếu album, đều là bài slug mã hóa.
- **Sửa trong lúc làm:**
  - Script trước khi vẽ đọc `+null` thành mức 0, nên ai chưa chọn gì cũng bị cỡ chữ 90%; test bắt được.
  - Nút Về đầu trang có `aria-label` khác chữ hiển thị (phần trăm), axe báo khi nút hiện ra. Nay con số do CSS vẽ (`::after`), không còn là chữ của nút, nên tên "Về đầu trang" luôn đúng kể cả lúc nút đang ẩn hay hiện.
  - Menu gắn `aria-current="page"` cho mục cha khi đang ở trang con; nay trang con dùng `"true"`.
- **Ghi chú tiêu chí 404:** `le-hang-thuan-tai-tung-lam-hoa-phuc` nay là bài có thật (17/10/2026), mở được với đủ 62 ảnh. Site cũ hiện "Bài viết không còn tồn tại" trong lúc chờ tải rồi mới hiện bài: đó là kiểu 200 giả mà tiêu chí muốn bỏ. 404 thật được kiểm bằng slug không có và bằng bài khác chuyên mục.

**Tiêu chí nghiệm thu:**
- [x] HTML ban đầu có đủ nội dung bài (không có trạng thái "Đang tải dữ liệu…")
- [x] Bài không có trả 404 thật thay vì 200 (bài `le-hang-thuan-…` nay có trong dữ liệu, xem ghi chú)
- [x] A− / A+ đổi cỡ chữ khung đọc; Giấy dó và Đêm thiền chỉ đổi khung đọc, giữ nguyên khi tải lại

**Kiểm chứng:**
- [x] `npm run test:e2e -- article` (24 test, có axe trên cả nền Đêm thiền); toàn bộ e2e 245 xanh cục bộ và trên `v2.`; unit 70 xanh
- [x] `curl` trang chi tiết, kiểm có đoạn thân bài trong HTML
- [x] Ảnh: `docs/anh/t8-bai-chi-tiet.png`

**Phụ thuộc:** T7

**File dự kiến:** `src/app/(site)/dong-chay-hoang-phap/[slug]/page.js`, `src/components/layout/main/BlogDetailsMain.js`, `src/components/site/ReadingControls.tsx`, `src/components/site/AnchorTabs.tsx`, `tests/e2e/article.spec.ts`

**Quy mô:** M

---

### T9: Video, album ảnh, lightbox

**Mô tả:** Album ảnh lưới 4:3 theo `OurGalleryPrimary`, mở bằng glightbox (Esc đóng, ← → chuyển ảnh, đếm "1/79"); bổ sung bẫy focus và trả focus về ảnh đã bấm nếu glightbox chưa làm. Video YouTube dùng `PopupVideo` của Bexon dạng ảnh + nút phát, chỉ nạp `youtube-nocookie.com` khi bấm. Gắn vào trang chi tiết bài.

**File Bexon:** `sections/our-gallery/OurGalleryPrimary.js`, `shared/popup-video/PopupVideo.js`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`. Album 4:3 và GLightbox đã gắn từ T8; T9 làm phần còn lại.
- **Hook dùng chung `src/hooks/useLightbox.ts`** (thay cho `useLightboxFocus` dự kiến), bọc GLightbox của Bexon. Dùng cho album (`PostGallery`), video bài (`PostVideos`) và `PopupVideo` của Bexon (trang chủ, trang `our-gallery`).
  - Khung có `role="dialog" aria-modal="true"`, nút tiếng Việt (Đóng · Ảnh trước · Ảnh sau).
  - Bộ đếm "3/30" là vùng `aria-live`, đọc lên mỗi lần chuyển ảnh.
  - Khi mở: phần trang phía sau `inert`, focus vào nút Đóng, Tab chỉ vòng qua các nút đang hiện. Bẫy Tab của GLightbox đưa focus vào nút "Ảnh trước" đang ẩn ở ảnh đầu, làm focus rơi ra ngoài; nay thay bằng bẫy riêng.
  - Đóng (Esc, nút Đóng) trả focus về đúng ảnh hoặc video đã bấm. GLightbox không tự làm việc này.
  - Ảnh trong lightbox có `alt` riêng (`data-alt`); iframe video có `title`.
  - Giảm chuyển động thì tắt hiệu ứng zoom/slide của lightbox.
- **Video `PostVideos`:**
  - Ảnh đại diện là banner của bài, không lấy ảnh của YouTube, nên không có request nào tới YouTube trước khi bấm.
  - Bấm phát thì mở `youtube-nocookie.com/embed/…` dạng iframe (`data-type="external"`). Trình phát Plyr mặc định của GLightbox tải từ `youtube.com` và `cdn.plyr.io`, nên không dùng.
  - Video mẫu trên trang chủ (`About2`) cũng chuyển sang cách này.
- **Album:** 12 ảnh đầu tải lười; ảnh sau "Xem thêm" chưa vẽ nên chưa tải. Test album 170 ảnh: lúc đầu tải ≤ 12 ảnh, sau "Xem thêm" chỉ tải những ảnh gần khung nhìn.

**Tiêu chí nghiệm thu:**
- [x] Không có request nào tới YouTube trước khi người dùng bấm phát (sau khi bấm chỉ có `youtube-nocookie.com` và những gì khung nhúng đó tự tải)
- [x] Lightbox: Esc, bẫy focus, trả focus; axe 0 lỗi khi đang mở
- [x] Album 79 ảnh chỉ tải ảnh thu nhỏ đang trong khung nhìn (kiểm trên album 170 ảnh)

**Kiểm chứng:**
- [x] `npm run test:e2e -- media` (theo dõi network request, 6 test × 2 cỡ màn hình); toàn bộ e2e 255 xanh cục bộ và trên `v2.`; unit 70 xanh

**Phụ thuộc:** T8

**File dự kiến:** `src/components/sections/our-gallery/OurGalleryPrimary.js`, `src/components/shared/popup-video/PopupVideo.js`, `src/components/site/useLightboxFocus.ts`, `tests/e2e/media.spec.ts`

**Quy mô:** M

---

### T10: Trang chủ – hero, lối vào chuyên mục, tin mới nhất

**Mô tả:** Trang chủ (server) lấy dữ liệu rồi truyền props; thứ tự khối khai báo bằng một mảng theo thứ tự đã chốt. `Hero2` giữ slider tự chạy: khung (1) "Nơi để trở về" / "Chốn thiêng bình yên", khung (3) pháp sự mới nhất (khung 2 thêm ở T12); mỗi khung ≥ 7 giây, ảnh có lớp phủ tối ≥ 55% dưới chữ, có nút tạm dừng, dừng khi di chuột hoặc focus. `Brands2` thành dải 6 lối vào chuyên mục (trượt tự chạy, dừng khi di chuột/focus, bấm được). `Blogs2` thành Tin mới nhất + Dấu ấn hoằng pháp (top lượt xem) dạng tab, slider tự chạy. Các khối chưa có dữ liệu thật tạm ẩn khỏi mảng cho tới task của chúng.

**File Bexon:** `sections/hero/Hero2.js`, `sections/brands/Brands2.js`, `sections/blogs/Blogs2.js`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Trang chủ** `src/app/(home)/page.tsx` (server) đọc dữ liệu qua `src/libs/home.ts` rồi truyền props.
  - Thứ tự khối nằm trong mảng `BLOCKS`. Các khối mẫu của Bexon (PricingPlan, About2, Services2, Portfolios2, Process, Testimonials2, Team1) đã rút khỏi trang; mỗi khối có dòng chú thích ghi task sẽ bật lại.
  - Tiêu đề trang chủ trước đây là của Bexon, nay là "Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên".
- **Hero `Hero2`:**
  - Khung 1 "Nơi để trở về / Chốn thiêng bình yên" dùng ảnh "toàn cảnh chùa" trong album Vũ Trụ Phật Giáo. Ảnh được làm sẵn 4 cỡ trong `public/images/hero`: rộng 1920, rộng 1280, bản dọc 760 cho điện thoại cầm đứng, và ảnh nhỏ.
  - Ảnh là `<img>` trong `<picture>`, gọi từ `<head>` bằng preload `fetchpriority="high"`. Mỗi màn hình chỉ tải một bản.
  - Khung 3 là bài mới nhất có ảnh của Dòng Chảy Hoằng Pháp, hiện là "Lễ Hằng Thuận tại Tùng lâm Hòa Phúc".
  - Mỗi khung 7 giây. Lớp phủ đen mun ≥ 55%: màn rộng 88 → 72 → 55% từ trái sang phải; màn hẹp 72–88% vì chữ phủ ngang màn.
  - Trang có một `<h1>` ẩn; tiêu đề các khung là `<h2>`.
  - Vòng chữ "NƠI ĐỂ TRỞ VỀ • CHỐN THIÊNG BÌNH YÊN" vẽ bằng SVG, thay ảnh chữ "Explore More" của Bexon. Mũi tên xuống dẫn tới `#loi-vao`.
- **Nút tạm dừng dùng chung** (`PauseButton`, hook `useAutoplay`):
  - Nút ghi chữ "Tạm dừng" / "Chạy tiếp"; trình đọc màn hình nghe thêm tên khối.
  - Focus đi vào slider thì dừng hẳn, đến khi bấm "Chạy tiếp" (theo mẫu carousel của WAI). Di chuột lên chỉ giữ tạm.
  - Ở chế độ giảm chuyển động, slider không chạy và nút ẩn.
- **Dải lối vào `Brands2`:**
  - 6 mục như menu site cũ: Giới thiệu, Tông Chỉ Tu Học, Dòng Chảy Hoằng Pháp, Vũ Trụ Phật Giáo, Bảo Tượng Phật Giáo, Trí Tuệ Phật Pháp. Icon vàng đặt trên nền đen mun; Giới thiệu dùng ấn tròn.
  - Dải trượt làm lại bằng CSS (`Marquee.tsx`): Swiper chỉ dừng được sau khi trượt hết ô đang chạy (tới 5 giây). Bản CSS dừng ngay khi di chuột, khi focus vào ô và khi bấm nút.
  - Bản sao thứ hai của dải có `aria-hidden` và `inert`.
  - Ở chế độ giảm chuyển động, dải thành lưới đứng yên; trên màn 375px vẫn thấy đủ 6 ô.
  - Viền mờ hai bên của Bexon thu từ 448px xuống 120px và không còn chặn bấm.
- **Chữ chạy ở footer (T6)** chuyển sang `Marquee` và có nút tạm dừng, để "mọi slider có nút tạm dừng" đúng trên mọi trang.
- **Khối tin `Blogs2`:**
  - Hai tab theo mẫu tabs của WAI (mũi tên, Home, End). "Tin mới nhất": 6 bài mới nhất. "Dấu ấn hoằng pháp": xem nhiều nhất.
  - Dấu ấn hoằng pháp bỏ những bài đã có ở Tin mới nhất. Lượt xem hiện còn thấp, nên 6 bài mới nhất cũng chính là 6 bài xem nhiều nhất; không bỏ thì hai tab giống hệt nhau. Bài nhập hai lần (cùng tiêu đề) chỉ hiện một lần.
  - Chỉ lấy bài từ chuyên mục đã có trang (`LIVE_SECTIONS`, hiện là Dòng Chảy Hoằng Pháp); T14 và T17 thêm chuyên mục của mình.
  - `BlogCard2` nhận `PostSummary`.
  - Nút điều hướng có class riêng: Bexon dùng chung `.slider-next`, nên bấm nút ở hero cũng đẩy slider tin.
- **Lớp nội dung:** `PostSummary` có thêm `banner`; thêm cách sắp xếp `views`; `section` nhận được một mảng; thêm `postHref` và `categoryHref`.
- **Sửa trong lúc làm** (đều làm chậm ảnh hero):
  - React tự chèn preload cho mọi ảnh không lazy, gồm 2 hình nền SVG của footer (548 KB mỗi hình, bên trong là PNG nhúng), ấn tròn và icon menu. Các ảnh này nay tải lười.
  - Nút đóng menu điện thoại dùng icon Font Awesome Thin, kéo theo một font 456 KB ở mức ưu tiên cao nhất. Nay nút này và nút tạm dừng dùng SVG.
  - Ảnh nhỏ thứ hai dưới hero dịch 15px khi Swiper khởi động (CLS 0,00006). Khoảng cách nay có sẵn trong CSS.
  - Nút Về đầu trang (T6) chỉ biết vị trí cuộn từ lần cuộn sau khi trang chạy xong JS. Ai cuộn sớm hơn thì nút không hiện; test hỏng khi máy tải nặng (3/60 lượt). Nay nút đọc vị trí cuộn ngay khi gắn vào trang.
- **Đo Lighthouse 12.6** (mỗi lần 2–3 lượt). Home-02 không có preloader nên chỉ có một bộ số.
  - Cục bộ (`npm run preview`, không nén): màn rộng LCP 3,6–3,7 s, CLS 0. CSS 1.056 KB, JS 814 KB.
  - `v2.`, màn rộng: LCP 1,7 s (1,6–2,2 s), CLS 0, FCP 1,1 s. CSS 194 KB, JS 289 KB (đã nén), font 715 KB.
  - `v2.`, điện thoại (giả lập 4G chậm): LCP 8–14 s, FCP 4,7–5,8 s, CLS 0. Chặn riêng ảnh 7,9 MB thì LCP ổn định ở 8,3 s.
  - Nguyên nhân chính trên điện thoại:
    - Ảnh thẻ bài "CỘNG TU PHÁP HỘI NIỆM PHẬT" là ảnh gốc WordPress 7,9 MB. Tổng ảnh của trang là 10,4 MB.
    - Hai file Noto Serif nặng 415 KB.
    - CSS chưa nén nặng 1 MB.
  - Hướng xử lý: T41b (Image Transformations; zone chưa bật, `/cdn-cgi/image` trả 404) và T41a (cắt Bootstrap và font).
  - CPU của Worker cho trang chủ: khi đã nóng 5–13 ms (trung vị 6 ms); lần đầu đọc snapshot 376–508 ms (Câu hỏi mở #8).
  - **Lần đầu thấy lỗi thật do gói Workers Free:** trong lượt e2e cuối trên `v2.`, 3 yêu cầu bị Cloudflare ngắt (`exceededCpu`, khách thấy trang lỗi 503 của Cloudflare). Một yêu cầu tốn 736 ms CPU khi Worker còn nguội phải đọc snapshot. Đây không phải lỗi mới của T10, nhưng nay đã thành lỗi khách gặp được, nên Câu hỏi mở #8 cần chủ dự án quyết trước khi ra mắt.
- **Chờ chùa duyệt:** ảnh khung 1, đoạn chữ của hero (đang dùng `site.intro`), tiêu đề khối "Tin tức hoằng pháp".

**Tiêu chí nghiệm thu:**
- [x] Mọi slider có nút tạm dừng dùng được bằng bàn phím và dừng khi di chuột/focus; không tự chạy ở chế độ giảm chuyển động (kể cả chữ chạy ở footer)
- [x] Ảnh khung hero đầu tiên nạp ưu tiên, đúng kích thước; CLS = 0
- [x] Bật lại một khối chỉ cần thêm 1 dòng vào mảng khối (`BLOCKS` trong `page.tsx`)

**Kiểm chứng:**
- [x] `npm run test:e2e -- home` (15 test × 2 cỡ màn hình); test canh gác mới "mọi thứ tự chạy có nút tạm dừng"; unit 76 xanh
- [x] Toàn bộ e2e (316 test, 23 bỏ qua theo thiết kế) trên bản cuối:
  - Cục bộ 292/293. Test hỏng gặp lỗi `ERR_CONNECTION_REFUSED` vì máy preview rớt giữa chừng; chạy lại `dong-chay` 23/23 xanh.
  - Trên `v2.` 291/293. Hai test hỏng là trang 503 của Cloudflare do vượt CPU (xem trên); chạy lại `article` 25/25 xanh.
  - Lượt trước bản cuối: 293/293 xanh ở cả hai nơi.
- [x] Lighthouse cục bộ trên `npm run preview` và trên `v2.` (số đo ở trên; Home-02 không có preloader)
- [x] Ảnh: `docs/anh/t10-trang-chu.png`

**Phụ thuộc:** T6, T7

**File dự kiến:** `src/app/(site)/page.js`, `src/components/sections/hero/Hero2.js`, `src/components/sections/brands/Brands2.js`, `src/components/sections/blogs/Blogs2.js`, `tests/e2e/home.spec.ts`

**Quy mô:** M

---

### Checkpoint B: Lát cắt đầu-cuối
- [ ] Trang chủ → danh sách → chi tiết → album chạy trọn trên `v2.` bằng dữ liệu thật
- [ ] Test canh gác + axe xanh cho cả 4 trang
- [ ] Ghi mốc LCP và dung lượng CSS/JS (mục tiêu LCP đã đổi ngày 13/11: p75 ≤ 2,5 s của người dùng thật, Câu hỏi mở #6 trong plan.md)
- [ ] Chủ dự án xác nhận cách đổi nội dung section Bexon đạt yêu cầu trước khi nhân rộng

---

### T11: Lịch tu học – dữ liệu, âm lịch, trang `/lich-tu-hoc`

**Mô tả:** Adapter `schedule` (customEvents, featuredPrograms, monthThemes, quoteGallery). Tiện ích âm lịch theo thuật toán Hồ Ngọc Đức (múi giờ +7). Trang `/lich-tu-hoc` (banner `HeroInner`): lưới tháng T2 → CN (ngày dương + âm, dựng bằng lưới Bootstrap), danh sách thẻ sự kiện 16:9 có chip trạng thái ("Đang mở đăng ký" / "Đã đủ số lượng" / "Đã kết thúc"), chọn tháng và loại qua URL, sự kiện nhiều ngày, chủ đề tháng (poster + câu kệ chữ `scripture`). Mục `#khoa-tu` ghi cách đăng ký qua điện thoại cho tới khi có `/dang-ky`.

**File Bexon:** `sections/hero/HeroInner.js`, `shared/cards/BlogCard2.js` (khuôn thẻ sự kiện)

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Dữ liệu:**
  - `npm run snapshot:fetch` lấy thêm `data/snapshot/schedule.json` từ `GET /api/admin/schedule`, cũng là API mà trang chủ site cũ đang gọi. Site cũ không có trang `/lich-tu-hoc` riêng.
  - Adapter `src/libs/content/schedule.ts` (zod, dễ dãi như bài viết) đọc 15 sự kiện, 3 khóa lễ thường kỳ, 12 chủ đề tháng và 12 ảnh câu kệ. Repository có thêm `getSchedule()`; `snapshot:check` báo số sự kiện theo tháng.
  - Loại sự kiện dùng slug giống chuyên mục bài viết (`cong-tu`, `khoa-le-truyen-thong`, `dai-le-su-kien`).
  - Câu kệ chỉ giữ thẻ `<b>`, mọi thứ khác bị escape.
  - **Bucket B2 thứ hai:** admin cũ nay tải ảnh lên bucket `media-tunglamhoaphuc`. Cả 30 ảnh của lịch nằm ở đó, và 3 ảnh mới chỉ có ở đó (không có bản ở `s2-cnv03`). Khi chép B2 sang R2 (chuẩn bị #1) phải chép cả bucket này; `snapshot:check` liệt kê đủ.
- **Âm lịch** `src/libs/lunar.ts` theo thuật toán Hồ Ngọc Đức, múi giờ +7: ngày âm, tháng nhuận, tên năm Can Chi, Phật lịch (sang năm vào ngày Phật đản 15/4 ÂL).
  - Đúng cả 12 ngày lễ kiểm thử 2025–2027 và tháng 6 nhuận năm 2025.
  - Đối chiếu từng ngày 2020–2030 với lịch Trung Quốc của ICU: chỉ lệch ở 2 tháng có trăng mới sát nửa đêm (14/12/2020 do chênh múi giờ; Tết 6/2/2027, nơi lịch Việt đã công bố khớp thuật toán). Hai chỗ lệch này được ghi rõ trong test.
- **Trang `/lich-tu-hoc`** (server, `?thang=YYYY-MM&loai=`):
  - Mặc định là tháng hiện tại theo giờ Việt Nam; giá trị lạ thì quay về mặc định.
  - Đầu trang ghi "Tháng 11/2026 · tháng Chín – tháng Mười âm lịch năm Bính Ngọ · Phật lịch 2570", có nút tháng trước / tháng này / tháng sau và nút lọc theo loại. Một dòng `role="status"` đọc lên khi đổi tháng hay đổi loại.
  - Lưới tháng là `<table>` từ T2 tới CN, chủ nhật màu chu sa. Mỗi ô có ngày dương và ngày âm; ngày mùng 1 ghi "1/10", ngày rằm ghi "Rằm"; hôm nay có `aria-current="date"`.
  - Ngày có sự kiện là một link lớn dẫn tới thẻ sự kiện đầu tiên của ngày đó, lướt tới bằng ScrollSmoother và đưa focus vào thẻ. Trình đọc màn hình nghe "Thứ Bảy, ngày 7 âm lịch ngày 29 tháng Chín: PHÁP HỘI NIỆM PHẬT". Trên màn hẹp, tên sự kiện vẽ thành chấm tròn.
  - Danh sách thẻ sự kiện ngay dưới lưới là bản tương đương cho trình đọc màn hình. Mỗi thẻ: ảnh 16:9, chip trạng thái và loại, ngày dương + âm (kể cả sự kiện nhiều ngày), giờ, nơi, mô tả, lưu ý, video mở bằng lightbox nocookie của T9.
  - Bên cạnh lưới là chủ đề tháng: tranh, câu kệ chữ `scripture`, tác giả.
  - Mục "Khóa lễ thường kỳ" (3 khóa lễ), và mục `#khoa-tu` ghi cách đăng ký qua điện thoại: 7 số của Ban lãnh chúng, giờ đón Phật tử.
  - Tháng không có sự kiện thì chỉ sang tháng gần nhất có lịch.
- **Khác với mô tả:** chip "Đang mở đăng ký" / "Đã đủ số lượng" chưa làm được vì dữ liệu cũ không có trạng thái đăng ký. Tạm dùng "Sắp diễn ra" / "Đang diễn ra" / "Đã kết thúc", tính theo ngày Việt Nam; khi có đăng ký (T39) sẽ thêm hai chip kia.
- **Để lại cho T12:** ảnh câu kệ (`quoteGallery`) đang trỏ vào `/images/lich-tu-hoc/quotes/…` của site cũ (Vercel). Khi `www.` chuyển sang site mới các đường dẫn này sẽ hỏng, nên phải chép ảnh sang B2/R2 trước khi T12 dùng.
- **Sửa thêm:**
  - `youtubeEmbed` chuyển sang `src/libs/video.ts` để trang server gọi được.
  - Hàm lướt tới một mục trong trang tách thành `src/libs/reveal.ts`, dùng chung cho `AnchorTabs` (T8) và lưới tháng.
  - Test mở lightbox của T9 quay lại trang và thử lại khi Enter mở thẳng file ảnh lúc lightbox chưa tải xong (gặp khi máy chạy nặng).
  - **Dịch bố cục trên `v2.`** (test CLS = 0 của T10 hỏng ở đó, cục bộ không thấy): font icon của Bexon về sau trang, nên mũi tên của slider nở từ 22 lên 28px. Icon ngôi nhà ở đường dẫn và mũi tên điều hướng tháng cũng vậy. Nay các ô icon này có độ rộng cố định bằng đúng độ rộng của icon. Đã kiểm bằng cách làm chậm font icon 2 giây: trang chủ, `/lich-tu-hoc` và `/dong-chay-hoang-phap` đều dịch 0.

**Tiêu chí nghiệm thu:**
- [x] Âm lịch đúng cho bộ ngày kiểm thử: Tết, Rằm tháng Giêng, Phật đản 15/4 ÂL, Vu Lan 15/7 ÂL các năm 2025–2027
- [x] Lưới tháng dùng được bằng bàn phím và có bản danh sách tương đương cho trình đọc màn hình
- [x] 15 sự kiện trong snapshot hiển thị đúng ngày dương và âm (e2e so với lịch ICU, độc lập với `lunar.ts`)

**Kiểm chứng:**
- [x] `npm test -- lunar` (17 test) và `calendar` (11 test); unit tổng 104 xanh
- [x] `npm run test:e2e -- lich-tu-hoc` (12 test × 2 cỡ màn hình, có axe và test dịch bố cục khi font icon về muộn); trang được thêm vào test canh gác
- [x] Toàn bộ e2e (344 test, 24 bỏ qua theo thiết kế) trên bản cuối:
  - Cục bộ 315/320. Trên `v2.` 294/320.
  - Mọi test hỏng đều là `page.goto` chờ sự kiện `load` quá 30 giây. Sự kiện này chờ ảnh ngoài (B2, WordPress), và mạng ra hai nơi đó chậm hẳn trong buổi chiều đo (lượt chạy dài 13–14 phút thay vì 5–7). Telemetry của Worker không có lỗi nào ngoài yêu cầu bị huỷ.
  - Chạy lại riêng các test hỏng (1–2 luồng) đều xanh. Lượt trước đó trên `v2.` (cùng mã, trước bản sửa CSS) chỉ hỏng test dịch bố cục đã sửa ở trên.
  - Đây là thêm một lý do để làm T41b sớm: trang chờ các ảnh gốc nặng hàng MB.
- [x] Ảnh: `docs/anh/t11-lich-tu-hoc.png`

**Phụ thuộc:** T4, T6

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm schedule), `src/lib/lunar.ts`, `src/app/(site)/lich-tu-hoc/page.js`, `src/components/calendar/MonthGrid.tsx`, `src/components/calendar/EventCard.tsx`

**Quy mô:** M

**Đồng bộ với lịch cũ 18/11/2026** (`www/lich-tu-hoc`):
- Khóa lễ thường kỳ (Đại sám hối, Tiểu sám hối, Cầu quốc thái dân an) hiện ở mọi tháng tới, đúng ngày âm lịch; tháng 11/2026 khớp lịch cũ (1, 8, 9, 16, 22, 23). Ô lịch theo giao diện cũ: icon theo loại, nhãn đỏ mùng 1/rằm, hôm nay phát sáng (00b5972, 7957b13, đã deploy `v2.`).
- **Bấm một ngày mở hộp thoại** như lịch cũ (`DayDialog`, `<dialog>` gốc của trình duyệt: giữ focus bên trong, Esc đóng, trả focus về ô ngày, bấm nền đóng): ảnh, dấu loại, tên phụ và tên, ngày dương/âm, giờ, mô tả, nơi, lưu ý hành trì, nút "Xem chi tiết". Ngày có hai sự kiện xếp liền nhau, nút đóng bám mép trên khi cuộn. Không có JavaScript thì ô ngày vẫn dẫn tới thẻ sự kiện bên dưới. ScrollSmoother bỏ qua focus trong hộp thoại (trang không còn nhảy khi đóng).
- **Trang riêng mỗi sự kiện và khóa lễ** `/lich-tu-hoc/<slug>` theo địa chỉ cũ (vd. `/lich-tu-hoc/cau-quoc-thai-dan-an`): ảnh, thông tin thời khóa (thời gian, khung giờ, địa điểm, đối tượng), ý nghĩa, các ngày sắp tới của khóa lễ, lưu ý cho Phật tử (lấy nguyên từ trang cũ), ký sự Dòng Chảy cùng chủ đề, JSON-LD cho sự kiện. ISR 5 phút như các trang bài; slug lạ trả 404.
- Kiểm tra: lint 0 lỗi, tsc sạch, unit 258/258; e2e lịch, a11y, motion-guard, trang chủ trên bản build cục bộ: 236 đạt, 1 lỗi a11y chập chờn ở một bài Dòng Chảy (chạy lại đạt).
- Nhánh `claude/affectionate-lumiere-e20b7e` (sửa lướt tới thẻ sự kiện, `reveal.ts`) chưa gộp: `reveal.ts` vẫn cần cho trang chủ và tab bài viết, còn 3 test lịch của nhánh đó dựa vào hành vi cũ (bấm ngày → lướt tới thẻ) nên phải viết lại khi gộp.

---

### T12: Trang chủ – khóa tu sắp tới, Lời Thầy dạy và đếm ngày trên hero

**Mô tả:** `PricingPlan` thành "Khóa tu sắp tới": 3 chương trình tiêu biểu thay 3 gói giá, nút "Xem chi tiết". `Testimonials2` thành "Lời Thầy dạy": slider tự chạy các câu kệ chủ đề tháng / kho pháp ngữ, chữ `scripture`. Thêm khung (2) vào hero: khóa tu kế tiếp với dòng "Còn N ngày" tính theo ngày (render phía server, giờ Việt Nam).

**File Bexon:** `sections/pricing-plan/PricingPlan.js`, `shared/pricing-plan/PricingPlanItems.js`, `sections/testimonials/Testimonials2.js`, `sections/hero/Hero2.js`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Đếm ngày** `src/libs/countdown.ts`: số ngày tính theo lịch Việt Nam, sang ngày mới lúc nửa đêm giờ Việt Nam bất kể đồng hồ của server. Nhãn là "Còn N ngày" hoặc "Diễn ra hôm nay". Trang render phía server mỗi lần có yêu cầu.
- **Dữ liệu trang chủ** (`loadHomeData` nhận thêm `now` để test): `upcoming`, khung hero 2 và `verses`, đều lấy từ lịch của T11.
- **Hero khung 2** (giữa "Nơi để trở về" và "Pháp sự mới nhất"): sự kiện kế tiếp bắt đầu từ hôm nay trở đi.
  - Dòng trên tiêu đề ghi "Khóa tu sắp tới · Còn 4 ngày". Dưới tiêu đề là ngày dương, âm lịch, giờ và nơi.
  - Nút "Xem lịch khóa tu" dẫn tới thẻ của sự kiện trên `/lich-tu-hoc`.
  - Không còn sự kiện nào thì khung này không có.
- **Khóa tu sắp tới** (`PricingPlan`): 3 sự kiện chưa kết thúc, mỗi tiêu đề một lần (pháp hội hai ngày chỉ hiện ngày đầu).
  - Mỗi thẻ: đếm ngày, tên và loại, ngày dương thay chỗ giá tiền, nút "Xem chi tiết" (trình đọc màn hình nghe kèm tên sự kiện), rồi âm lịch, giờ, nơi thay chỗ danh sách tính năng.
  - Thẻ gần nhất được tô màu như gói nổi bật của Bexon.
  - Không còn chữ "gói", giá tiền hay ký hiệu tiền tệ. Không còn sự kiện thì khối không render (`/services` của Bexon cũng hết bảng giá).
- **Lời Thầy dạy** (`Testimonials2`): slider câu kệ của các chủ đề tháng, bắt đầu từ tháng này, chữ `scripture`, tự chạy 9 giây mỗi câu, có nút tạm dừng.
  - Bên trái là tranh chủ đề tháng có tiêu đề đè lên; lớp phủ đậm hơn của Bexon để chữ dễ đọc.
  - Ô điểm đánh giá của Bexon thành ô "Chủ đề tháng 11".
  - Khung `blockquote` chung của Bexon không áp vào câu kệ.
- **Khác với mô tả:**
  - Bảng ánh xạ ghi khối Khóa tu lấy `featuredPrograms`, nhưng đó là 3 khóa lễ thường kỳ, lúc nào cũng có, nên không thể "ẩn khi không còn khóa tu" như tiêu chí. Khối nay lấy sự kiện sắp tới trên lịch; 3 khóa lễ thường kỳ vẫn ở `/lich-tu-hoc`. Nếu chủ dự án muốn khối này là khóa lễ thường kỳ thì chỉ cần đổi nguồn dữ liệu.
  - Kho ảnh câu kệ (`quoteGallery`) chưa dùng vì ảnh nằm trên site cũ (xem T11). Slider dùng câu kệ dạng chữ của chủ đề tháng.

**Tiêu chí nghiệm thu:**
- [x] Số ngày đúng theo `Asia/Ho_Chi_Minh`, kể cả quanh nửa đêm (unit test)
- [x] Không còn chữ "gói", giá tiền hay ký hiệu tiền tệ nào từ khuôn Pricing
- [x] Khi không còn khóa tu sắp tới, hero bỏ khung (2) và khối Khóa tu ẩn, không lỗi (unit test với ngày sau sự kiện cuối)

**Kiểm chứng:**
- [x] `npm test -- countdown` (3 test); `home` thêm 5 test cho lịch; unit tổng 112 xanh
- [x] `npm run test:e2e -- home`: kỳ vọng tính từ `schedule.json` và ngày hôm nay nên không lỗi thời theo lịch; slider Lời Thầy dạy nằm trong test 7 giây và test canh gác nút tạm dừng
- [x] Toàn bộ e2e (350 test, 24 bỏ qua theo thiết kế):
  - Cục bộ 325/326. Test hỏng là test dịch bố cục khi máy tải nặng: font chữ thay vào sau lần vẽ đầu làm nút hero lệch vài pixel (thuộc T41a). Hai test dịch bố cục nay nằm trong nhóm riêng, được chạy lại tối đa 2 lần, có ghi lý do.
  - Trên `v2.` 324/326 (3 luồng): 1 test dịch bố cục qua ở lần chạy lại; 1 test menu điện thoại hỏng một lần. Chạy lại test menu và test hộp tìm kiếm trên `v2.` 30 lượt đều xanh.
- **Gói Workers Free:** trong lượt chạy trên `v2.` có 5 yêu cầu bị ngắt vì vượt CPU (`exceededCpu`), kể cả file tĩnh `pattern-2.svg`.
  - File tĩnh trả về có header `X-Robots-Tag` do Worker thêm vào, tức là ảnh và JS cũng đi qua Worker và tốn CPU. Một file JS bị ngắt thì trang không chạy được JavaScript; điều này giải thích các test menu và tìm kiếm thỉnh thoảng hỏng trên `v2.`.
  - Nên xem lại cách phục vụ file tĩnh cùng lúc với Câu hỏi mở #8.
- [x] Ảnh: `docs/anh/t12-trang-chu-lich.png`

**Phụ thuộc:** T10, T11

**File dự kiến:** `src/components/sections/pricing-plan/PricingPlan.js`, `src/components/sections/testimonials/Testimonials2.js`, `src/components/sections/hero/Hero2.js`, `src/lib/countdown.ts`, `tests/unit/countdown.test.ts`

**Quy mô:** M

---

### T13a: Giới thiệu – trang chủ đề

**Mô tả:** Adapter `gioi-thieu` (6 chủ đề, 3 nhóm). `/gioi-thieu`: lưới 6 thẻ theo nhóm. `/gioi-thieu/[slug]` theo khuôn `TeamDetails1`: banner, chân dung 3:4, tổng quan, trích dẫn (`scripture`), mốc niên biểu, nội dung, album (T9).

**File Bexon:** `sections/teams/TeamDetails1.js`, `sections/history/*`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Dữ liệu:**
  - `npm run snapshot:fetch` lấy thêm `data/snapshot/gioi-thieu.json` từ `GET /api/admin/gioi-thieu`, API công khai mà site cũ đang gọi.
  - Adapter `src/libs/content/about.ts` đọc 6 chủ đề trong 3 nhóm: Lịch Sử Chùa (1), Người Liên Quan (4), Thanh Quy & Văn Hóa (1). Repository có thêm `listAboutTopics()`.
  - Mốc niên biểu lưu dạng chuỗi JSON ở 5 chủ đề, dạng mảng ở 1 chủ đề; JSON hỏng thì coi như không có mốc. Nội dung Markdown đi qua `renderContent` của T4. Ảnh trên domain `b1.congngheviet` gom về địa chỉ B2 như bài viết.
- **Kiểm lệch nội dung:**
  - `snapshot:check` so tên chủ thể trong tiêu đề (hai chữ cuối, bỏ dấu khi so) với 600 chữ đầu của tổng quan và nội dung. Nếu thiếu, báo rõ là nội dung đang nói về chủ đề nào khác.
  - Unit test dựng lại đúng trường hợp cũ (tiêu đề Thích Tâm Hòa, nội dung Đại sư Liên Đăng) và bắt được.
  - Dữ liệu hiện tại thì khớp: Ban Biên Tập đã sửa `su-phu-tru-tri`. Báo cáo ghi "tiêu đề và nội dung khớp nhau", và một unit test giữ điều đó trên dữ liệu thật.
- **Trang `/gioi-thieu`** (server): lời dẫn của site cũ, rồi 3 nhóm, mỗi nhóm có tiêu đề làm neo (`#lich-su-chua`, `#nguoi-lien-quan`, `#thanh-quy-van-hoa`).
  - Mỗi chủ đề là thẻ thành viên của Bexon: ảnh 3:4 có lớp phủ khi rê chuột, nhãn, tiêu đề, phụ đề.
- **Trang `/gioi-thieu/[slug]`** (server, khuôn `TeamDetails1`, dựng thành phần TLHP mới nên trang mẫu `/team/[id]` của Bexon giữ nguyên):
  - Chân dung 3:4, nhãn, phụ đề, tổng quan.
  - Lời dạy (câu kệ, chữ `scripture`, tác giả) và tác phẩm (với Thầy Trụ trì: "Đi Qua Khổ Vui Cuộc Đời").
  - Mốc niên biểu dùng dòng thời gian của Bexon nhưng là `<ol>`; số lớn chỉ để nhìn (`aria-hidden`). Nhãn mốc là tên giai đoạn ("Pháp Danh & Bổn Nguyện") thay cho năm, nên chữ nhỏ hơn và giữ trong phần của mình.
  - Nội dung trong khung đọc của T8 (A−/A+, Giấy dó, Đêm thiền), album mở bằng lightbox của T9, các chủ đề cùng nhóm, tab neo như trang bài.
  - `<title>` viết hoa đầu từ ("Tiểu Sử Sa Môn Thích Tâm Hòa – Giới thiệu – Tùng Lâm Hòa Phúc") vì tiêu đề trong dữ liệu viết hoa toàn bộ. Mô tả lấy phụ đề.
  - Slug không có trả 404.
- **Sửa menu:** ba mục con của Giới thiệu trỏ tới slug không có (`/gioi-thieu/lich-su-bon-tu`, `/chu-ton-duc`, `/thanh-quy`; site cũ cũng 404). Nay là `/gioi-thieu/lich-su-tung-lam-hoa-phuc`, `/gioi-thieu#nguoi-lien-quan` và `/gioi-thieu/van-hoa-ung-xu`.
- **Chờ Ban Biên Tập** (ảnh trả 404 ngay trên B2, site cũ cũng vỡ): chân dung Sư Tổ (`tieu-su-hoa-thuong-ngo-chan-tu-1.jpg`, cũng là ảnh đầu của album) và ảnh thứ tư trong album của Sư ông Thanh Lương (`su-thanh-luong-8.jpg`). Nhóm "Người Liên Quan" có thể đổi tên thành "Chư Tôn Đức" cho khớp menu.

**Tiêu chí nghiệm thu:**
- [x] 6 trang render phía server, mỗi trang có `<title>` và mô tả riêng
- [x] Báo cáo snapshot nêu rõ lệch nội dung `/gioi-thieu/su-phu-tru-tri` (tiêu đề Thích Tâm Hòa, nội dung Đại sư Liên Đăng) để Ban Biên Tập sửa trong admin cũ: phép kiểm có, bắt được trường hợp này trong unit test; dữ liệu hiện tại đã được sửa nên báo cáo không còn nêu
- [x] Mốc niên biểu là danh sách có thứ tự (`<ol>`), đọc đúng bằng trình đọc màn hình

**Kiểm chứng:**
- [x] `npm run test:e2e -- gioi-thieu` (8 test × 2 cỡ màn hình, có axe); hai trang được thêm vào test canh gác
- [x] `npm run snapshot:check` (dòng `gioi-thieu.json: 6 chủ đề …; tiêu đề và nội dung khớp nhau`); unit 117 xanh
- [x] Toàn bộ e2e (374 test, 24 bỏ qua theo thiết kế):
  - Cục bộ 348/350, kèm 1 test chập chờn: test dịch bố cục của T10 (font chữ thay vào sau lần vẽ đầu khi máy chạy nặng; đã qua ở lần chạy lại).
  - Test menu điện thoại của T5 hỏng ở cả lượt cục bộ này lẫn lượt trên `v2.` của T12. Nguyên nhân: test bấm nút trước khi trang chạy JavaScript. Test nay bấm lại nếu menu chưa mở.
  - Trên `v2.` 349/350; test hỏng là `ERR_TIMED_OUT` khi mở `/blogs` (mạng), chạy lại xanh.
- [x] Ảnh: `docs/anh/t13a-gioi-thieu.png`

**Phụ thuộc:** T9

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm gioi-thieu), `src/app/(site)/gioi-thieu/page.js`, `src/app/(site)/gioi-thieu/[slug]/page.js`, `src/components/sections/teams/TeamDetails1.js`

**Quy mô:** M

---

### T13b: Trang chủ – Lời chào và Chư Tôn Đức

**Mô tả:** `About2` thành "Lời chào" Bổn tự (số liệu chạy bằng odometer, ảnh parallax). `Team1` thành "Chư Tôn Đức": 4 thẻ chân dung 3:4 dẫn tới trang `/gioi-thieu/[slug]` tương ứng, bỏ phân trang. Thêm 2 khối vào mảng trang chủ đúng vị trí đã chốt.

**File Bexon:** `sections/about/About2.js`, `sections/teams/Team1.js`

**Kết quả 03/11/2026:** xong, đã deploy `v2.`.
- **Thứ tự trên trang chủ:** hero → 6 lối vào → Khóa tu sắp tới → Tin tức → **Lời chào** → Lời Thầy dạy → **Chư Tôn Đức**. Chỗ của Tông Chỉ Tu Học, khu vực nổi bật và lộ trình tu học (T14, T15) vẫn để trống.
- **Lời chào** (`About2`, bố cục Bexon giữ nguyên):
  - Tiêu đề là câu dạy của chủ đề Lịch sử: "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian", kèm tên Thượng tọa Thích Tâm Hòa. Dưới đó là đoạn tổng quan và nút "Tìm hiểu Bổn tự" dẫn tới trang lịch sử.
  - Nút phát mở video "Chốn thiêng bình yên – Tùng Lâm Hòa Phúc" (`HE2MnR8Hl5c`). Đây là video nền trang chủ site cũ, trên kênh YouTube của chùa, mở trong lightbox qua youtube-nocookie.
  - Khung Bexon có 3 gương mặt khách hàng, nay là chân dung 3 vị Chư Tôn Đức.
  - Ảnh nền khung này là ảnh toàn cảnh chùa bản dọc 760px, dùng thẻ `<img>` tải chậm thay cho ảnh nền CSS. Lý do: ảnh nền CSS tải ngay khi mở trang, làm máy tính tải thêm ảnh 1280px (test ảnh hero bắt được). Điện thoại đã có sẵn bản 760 từ hero.
- **Số liệu odometer:**
  - Ba số: 471 bài Dòng Chảy Hoằng Pháp, 158 bài Trí Tuệ Phật Pháp và Phật lịch 2570. Phật lịch tính theo ngày, sang năm mới vào rằm tháng Tư âm lịch, viết liền không có dấu chấm ngăn nghìn.
  - Snapshot có 472 bài Dòng Chảy, nhưng hai bài trùng slug nên chỉ đếm một (đúng như trang danh sách hiện "471 bài").
  - Số tôn tượng và số khu vực chờ T15, T16. Site cũ nạp dữ liệu đó không qua API công khai.
  - HTML gửi về đã có số thật. Trình đọc màn hình đọc một chuỗi số ẩn, phần chữ số lăn được đánh `aria-hidden`.
  - Ở chế độ giảm chuyển động thì không tải odometer, số đứng yên.
  - Khi cho phép chuyển động: sau khi script chạy, số về 0 rồi đếm lên khi cuộn tới (hết mục "Còn lại cho T13b" của T3a).
- **Chư Tôn Đức** (`Team1`): 4 thẻ của nhóm "Người Liên Quan", xếp theo thứ tự trong admin.
  - Dùng chung thẻ `AboutCard` của T13a, thêm lớp `left-swipe` để giữ hiệu ứng lật vào từ trái của Bexon (tắt khi giảm chuyển động).
  - Danh sách là `<ul>`, bỏ phân trang. Nút "Xem thêm về Bổn tự" dẫn tới `/gioi-thieu`.
  - Trang mẫu `/team` của Bexon không còn lưới thành viên; trang này sẽ bị xóa theo kế hoạch.
- **Bexon About2 không có parallax ảnh**, nên không có hiệu ứng nào bị bỏ.
- **Chờ Ban Biên Tập:** chân dung Sư Tổ vẫn trả 404 (đã ghi ở T13a), nên thẻ thứ tư hiện khung trống.


**Tiêu chí nghiệm thu:**
- [x] Số liệu odometer có giá trị cuối đúng trong HTML (trình đọc màn hình và chế độ giảm chuyển động thấy số thật)
- [x] 4 thẻ Chư Tôn Đức dẫn đúng trang giới thiệu, không có liên kết hỏng (test mở cả 4 trang, đều trả 200)
- [x] Hai khối nằm đúng thứ tự đã chốt trên trang chủ

**Kiểm chứng:**
- [x] `npm run test:e2e -- home` (21 test × 2 cỡ màn hình, có axe). Thêm 4 test mới:
  - Số thật trong HTML đầu.
  - Số đứng yên khi giảm chuyển động, và nút video.
  - Bốn thẻ Chư Tôn Đức dẫn đúng trang.
  - Số đếm lên đúng giá trị khi cuộn tới.
  Test thứ tự khối nay kiểm cả Lời chào, Lời Thầy dạy và Chư Tôn Đức.
- [x] Unit 120 xanh: thêm test `welcome`, `teachers`, số liệu (kể cả trường hợp không có chủ đề Lịch sử); `tsc` sạch
- [x] Toàn bộ e2e (382 test, 24 bỏ qua theo thiết kế):
  - Cục bộ: 358/358.
  - Trên `v2.`: 348 qua, 1 chập chờn, 9 hỏng ở lượt đầu. Lỗi là 503 và quá thời gian tải trên các trang Bexon, Dòng Chảy và lịch, cùng kiểu với lỗi vượt CPU của gói Workers Free đã ghi từ T10 (lượt này chưa đối chiếu nhật ký Worker).
  - Chạy lại 9 test đó: 9/9 xanh.
- [x] Ảnh: `docs/anh/t13b-loi-chao-chu-ton-duc.png`

**Phụ thuộc:** T10, T13a

**File dự kiến:** `src/components/sections/about/About2.js`, `src/components/sections/teams/Team1.js`, `src/app/(site)/page.js`, `tests/e2e/home.spec.ts`

**Quy mô:** M

---

### T14: Tông Chỉ Tu Học

**Mô tả:** Adapter `tong-chi` (25 bài, 5 nhóm; khối video, bài nổi bật, album, sách nguồn, từ khóa). `/tong-chi-tu-hoc` và khối trang chủ dùng `Services2` (section tối, thẻ xếp chồng khi cuộn, tiêu đề dính) cho 5 nhóm. `/tong-chi-tu-hoc/[slug]` theo khuôn `ServiceDetailsMain`, render phía server. `Process` thành "Lộ trình tu học" (4 bước).

**File Bexon:** `sections/services/Services2.js`, `layout/main/ServiceDetailsMain.js`, `sections/process/Process.js`

**Kết quả 04/11/2026:** xong, đã deploy `v2.`.
- **Dữ liệu:**
  - `npm run snapshot:fetch` lấy thêm `data/snapshot/tong-chi.json` từ `GET /api/admin/tong-chi`, API công khai mà trang chi tiết của site cũ đang gọi.
  - Adapter `src/libs/content/tongChi.ts` đọc 25 bài trong 5 nhóm: Tông Phong Truyền Thừa (3), Nền Tảng Tu Học (5), Phương Pháp Hành Trì (8), Lộ Trình Tu Học (4), Nếp Sống Thiền Gia (5).
  - Tiêu đề trong dữ liệu viết hoa toàn bộ, nay viết hoa đầu từ ("Niệm Phật").
  - Bài trùng tên thì ghép thêm phụ đề: 4 bài "Lộ Trình Tu Học: Dành cho người trẻ…" (trùng có chủ ý) và 2 bài "Tam Quy" (có báo cáo).
  - Repository có thêm `listTongChi()` và `getTongChi(slug)`. Thân bài chỉ chuyển sang HTML khi có trang cần, mỗi bài một lần.
- **Thân bài là bản dặn dàn trang** (`src/libs/content/tongChiBody.ts`):
  - 17/25 bài lưu bản dặn cho người thiết kế: chữ của trang xen lẫn ghi chú như "Làm 3 card.", "Infographic:", "MỘT ẢNH LỚN, ĐẸP THẦY NGỒI THIỀN", "[POPUP: …]", tên file ảnh. Site cũ không hiện được thân bài của các bài này: dưới tiêu đề chỉ có dấu ")".
  - 8 bài còn lại viết bằng Markdown, nhưng cũng còn ghi chú và sơ đồ vẽ bằng ký tự khung.
  - Bộ chuyển đổi:
    - Bỏ các dòng ghi chú, và trả danh sách dòng đã bỏ để báo cáo.
    - Giữ chữ trong POPUP và NGHI THỨC.
    - Biến câu dạy “…” kèm tác giả thành trích dẫn, dòng in hoa thành tiêu đề, các ô của một infographic thành danh sách.
    - Biến "Tìm hiểu thêm về X ->" thành liên kết tới bài X. Nếu X là tên chung của nhiều bài thì dẫn tới nhóm của chúng.
    - Bài Thập Thiện mất hết xuống dòng (cả bài nằm trên 3 dòng), nên được cắt lại theo câu dạy, tên tác giả và cụm chữ in hoa.
  - Unit test và e2e soát cả 25 bài: không còn ghi chú nào trong chữ hiển thị.
- **`snapshot:check`** báo thêm:
  - 22 bài còn ghi chú dàn trang. Ban Biên Tập nên viết lại bằng Markdown trong admin; khi đó bộ chuyển đổi để nguyên.
  - 51 ảnh trỏ tới WordPress mà không có thư mục năm/tháng: đường dẫn soạn sẵn cho ảnh chưa từng tải lên. Cả 22 địa chỉ khác nhau đều trả 404, nên trang coi như không có ảnh.
  - Hai bài "Tam Quy" cùng nhóm.
- **`/tong-chi-tu-hoc`** (server):
  - Lời dẫn 4 đoạn của trang cũ, chép vào `src/config/tongChi.ts`.
  - `Services2` của Bexon: section đen mun, tiêu đề dính khi cuộn (từ 992px). Năm thẻ nhóm trượt vào từ phải; mỗi thẻ có icon, tên nhóm, một dòng mô tả lấy từ lời dẫn, và danh sách bài.
  - Cột tiêu đề có liên kết tới 5 nhóm (`#tong-phong-truyen-thua`…), đưa focus vào nhóm.
- **`/tong-chi-tu-hoc/[slug]`** (server, khuôn `ServiceDetailsMain`):
  - Nhãn nhóm, tác giả (liên kết tới trang Giới thiệu), lượt xem, phụ đề, banner, đoạn tóm tắt.
  - Thân bài trong khung đọc của T8, kèm từ khóa.
  - Video (lightbox youtube-nocookie), album, nguồn tham khảo (sách nguồn, bài nổi bật). Mỗi khối chỉ hiện khi có dữ liệu.
  - Thanh tab neo, bài trước/bài sau, thanh bên với các bài cùng nhóm và các nhóm khác.
  - Liên kết tới Trí Tuệ Phật Pháp chưa thành liên kết (trang đó làm ở T17). Slug không có trả 404.
- **Trang chủ:**
  - Thêm khối Tông Chỉ (`Services2`, nút "Xem Tông Chỉ Tu Học") ngay sau Lời chào.
  - Thêm khối "Lộ trình tu học" (`Process`): 4 bước là 4 bài của nhóm Lộ Trình, xếp 4 cột từ 1200px và chồng dọc ở màn nhỏ hơn.
  - Chỗ của khu vực nổi bật (T15) vẫn để trống giữa hai khối.
- **Sửa lỗi trang chủ đứng ngày** (từ T12):
  - vinext xếp trang chủ vào loại trang tĩnh, nên bản preview giữ bản dựng đầu tiên một năm. Lượt e2e chạy qua nửa đêm bắt được lỗi: ngày 04/11 trang vẫn ghi "Còn 4 ngày".
  - Trên `v2.` trang chủ chưa bị giữ, nhưng sẽ bị ngay khi Worker có bộ nhớ đệm trang. Nay trang chủ khai báo `dynamic = "force-dynamic"`; test tái hiện đỏ trước khi sửa, xanh sau khi sửa.
- **Chữ do tôi đặt, cần Ban Truyền Thông duyệt:** tiêu đề "Con đường tu học." và "Lộ trình tu học.", nút "Xem các lộ trình", và cách cắt lời dẫn thành 5 dòng mô tả nhóm.
- **Gói Workers Free:**
  - Trong lượt e2e trên `v2.` (khoảng 50 phút), nhật ký Worker ghi 250 yêu cầu bị ngắt vì vượt CPU, rải khắp các trang và cả file tĩnh.
  - CPU trung vị của yêu cầu thành công: trang chủ 18 ms, `/tong-chi-tu-hoc` 220 ms, `/gioi-thieu` 136 ms. Hai trang sau tốn nhiều vì Worker mới khởi động phải đọc cả `posts.json` (632 bài), dù trang chỉ cần dữ liệu Tông Chỉ hoặc Giới thiệu.
  - Câu hỏi mở #8 (Workers Paid) và việc mỗi trang chỉ đọc phần dữ liệu cần (plan giao cho T19) cần làm trước khi ra mắt.

**Tiêu chí nghiệm thu:**
- [x] `/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh` có nội dung trong HTML ban đầu (site cũ chỉ có "Đang tải…", và với bài này không hiện được thân bài)
- [x] Khối phụ (video, sách nguồn, từ khóa) ẩn sạch khi không có dữ liệu
- [x] Section tối đạt axe 0 lỗi; thẻ xếp chồng không che nội dung ở 375px và trở về dạng danh sách khi giảm chuyển động

**Kiểm chứng:**
- [x] `npm run test:e2e -- tong-chi`: 6 test × 2 cỡ màn hình, có axe trên trang danh sách và trang bài; cả 25 bài trả 200 và không còn ghi chú. Hai trang mới được thêm vào test canh gác.
- [x] Trang chủ thêm 2 test: khối Tông Chỉ và Lộ trình; trang chủ không lấy từ bộ nhớ đệm.
- [x] Unit 132 xanh (thêm 12 test cho bộ chuyển đổi và adapter); `tsc` và eslint sạch; `npm run snapshot:check` có dòng `tong-chi.json: 25 bài (…)`.
- [x] Toàn bộ e2e (406 test, 24 bỏ qua theo thiết kế):
  - Cục bộ: 381 qua.
  - 1 test chập chờn: tab trượt của T8. Thêm một lần dải lối vào của T10 hỏng khi chạy riêng test trang chủ. Cả hai qua khi chạy lại 3 lần.
  - Trên `v2.`: 362 qua, 19 hỏng ở lượt đầu, đều là 503 hoặc trang không tải xong (vượt CPU, xem trên). Chạy lại 19 test đó: 18 qua ngay, test còn lại (chữ tách hiệu ứng ở `/styleguide`) qua ở lần chạy riêng.
- [x] Ảnh: `docs/anh/t14-tong-chi-tu-hoc.png`

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

**Kết quả 04/11/2026:** xong, đã deploy `v2.`. Có ba chỗ khác mô tả ở trên, ghi ở mục đầu.
- **Khác mô tả:**
  - **Hiện 14 khu vực, không phải 12.** Dữ liệu không có cờ ẩn/hiện; cả 14 thuộc Tùng Lâm Hòa Phúc. Site cũ chỉ liệt kê 12 bản ghi đầu ở lưới, nhưng ghim đủ 14 trên bản đồ và mở được cả 14 trang (Sân La Hán, Lầu Kinh Luân là hai khu vực thêm sau). Ghim "Lâm Tỳ Ni" trên bản đồ cũ không có dữ liệu nên bỏ.
  - **Ghim đặt theo bản đồ của site cũ, không theo `mapPos`.** Bản đồ cũ không đọc `mapPos` mà dùng vị trí viết sẵn trong mã. Vẽ cả hai lên ảnh thì `mapPos` của 8 khu vực rơi ra bãi cỏ, hàng cây hoặc bãi xe. Vị trí và thứ tự ghim nay nằm ở `src/config/vuTru.ts`; `snapshot:check` liệt kê 8 khu vực lệch để Ban Biên Tập sửa trong admin (T36 gỡ bảng này).
  - **Album, câu chuyện và Pháp thoại Giảng đường chưa có.** `stories` trống ở cả 14 khu vực, dữ liệu không có trường album. Video Pháp thoại của Giảng đường không có trong API (trang cũ chỉ có tên, mô tả, ngày, ảnh giữ chỗ, không có địa chỉ video); chờ đọc file gốc trên B2 (T19).
- **Dữ liệu:**
  - `npm run snapshot:fetch` lấy thêm `vu-tru.json` và `bao-tuong.json` bằng các lệnh GET chỉ đọc mà lớp chặn admin cho qua; không gọi `vu-tru/sync-wp`.
  - Adapter `src/libs/content/vuTru.ts` đọc khu vực và tôn tượng. Repository có thêm `listAreas()` và `listStatues()`.
- **Tượng của một khu vực:**
  - Lấy theo cách site cũ: các tượng "TƯỢNG CHÍNH" có mã khu vực trùng (Tam Bảo đúng 20 tượng như trang cũ); bản ghi "NTPG" hiện riêng ở mục "Nghệ thuật Phật giáo".
  - File bảo tượng gọi khu vực theo tên riêng (`nha_mau`, `lau_kinh_luan`…), nên bảng nối nằm trong config. Lầu Kinh Luân nay hiện 11 tượng (trang cũ không hiện tượng nào vì slug khu vực vẫn là `ho-phong-sinh`).
  - `cong_thap` (Cổng Tháp, 2 tượng) chưa thuộc khu vực nào, có trong báo cáo.
  - Địa chỉ tượng giữ đúng dạng site cũ `/bao-tuong/{slug}` (slug đã có đuôi `_tpXXXX`). 17 tượng chính không có mã TP nên địa chỉ không có đuôi này (báo cáo có danh sách).
  - Thẻ tượng chưa là liên kết cho tới khi T16 làm trang tượng: `src/libs/livePaths.ts` gom danh sách các mục đã có trang, dùng chung với Tông Chỉ.
- **`/vu-tru-phat-giao`** (server):
  - Lời dẫn và sơ đồ 2D: ảnh vẽ khuôn viên, 14 ghim đánh số là liên kết rộng 48px theo thứ tự trên bản đồ. Tên khu vực hiện khi rê chuột hoặc có focus; trình đọc màn hình đọc "4. Tam Bảo".
  - Dưới 992px, sơ đồ giữ bề rộng 960px trong khung cuộn ngang để các ghim không chồng lên nhau; trang không bị tràn ngang.
  - Danh sách 14 khu vực dạng thẻ dự án Bexon, đánh số như trên bản đồ.
- **`/vu-tru-phat-giao/[slug]`** (server, khuôn `PortfolioDetailsMain`):
  - Nhãn số khu vực, tên thứ hai, ảnh bìa, nội dung.
  - Bảo tượng và Nghệ thuật Phật giáo, mỗi mục chỉ hiện khi có tượng.
  - Thanh bên: vị trí khu vực trên sơ đồ nhỏ và liên kết "Xem sơ đồ đầy đủ".
  - "Khu vực khác": 3 điểm kế tiếp trên bản đồ. Slug không có trả 404.
- **Trang chủ:**
  - Khối "Khu vực nổi bật" (`Portfolios2`) đặt giữa Tông Chỉ và Lộ trình tu học. Slider Bexon (slide giữa lớn), tự chạy 7 giây, có nút tạm dừng, không chạy khi giảm chuyển động.
  - Bexon ẩn tên khu vực bằng `visibility: hidden` cho tới khi rê chuột, làm liên kết rơi khỏi thứ tự Tab; nay chỉ làm mờ, và hiện cả khi có focus.
  - Trang chỉ gửi xuống trình duyệt 5 trường của mỗi khu vực.
- **Sửa sau review** (review 5 trục, kèm một reviewer độc lập chỉ đọc mã; thử đột biến: 7/8 thay đổi bị unit test bắt):
  - **Critical, mọi trang tải trước ảnh bản đồ 410 KB ở mức ưu tiên cao:** liên kết tải trước trang `/vu-tru-phat-giao` (dựng tĩnh), và React chèn lệnh preload cho ảnh bản đồ `eager` + `fetchPriority="high"`. Menu có mục Vũ Trụ nên lỗi lan ra cả site; test ảnh hero bắt được. Nay ảnh bản đồ luôn `lazy`. Test mới (đỏ trên bản lỗi, xanh sau khi sửa) kiểm `/gioi-thieu` không tải ảnh bản đồ và không có preload ảnh ưu tiên cao nào.
  - Ảnh bản đồ dùng cùng địa chỉ `s2-cnv03` với ảnh bìa Tổ Đường và Đại Nam Quốc Mẫu (trước đây là host khác nên tải 2 lần), qua `mediaUrl()`.
  - Nội dung dài của nhiều khu vực mở đầu bằng chính câu giới thiệu viết lại; nay câu giới thiệu chỉ hiện khi không có nội dung dài.
  - Test mới: mọi liên kết nội bộ trên trang khu vực đều mở được (đột biến "bật liên kết tượng sớm" trước đó lọt qua unit test).
  - `snapshot:check` báo cả khu vực của tự viện khác hoặc thiếu tên tự viện.
- **Chờ Ban Biên Tập:**
  - 11/14 khu vực dùng chung ảnh bìa giữ chỗ: ảnh toàn cảnh chùa cho 5 khu vực; bìa sách "Đi Qua Khổ Vui Cuộc Đời" cho Tứ Ân và Thư Viện.
  - Sửa `mapPos` của 8 khu vực trong admin.
  - Gán khu vực cho 2 tượng `cong_thap`.
- **Hiệu năng còn lại** (cần làm trước khi ra mắt):
  - Ảnh tượng 0,2–1,5 MB mỗi ảnh hiển thị trong thẻ rộng khoảng 260px; cuộn hết trang Tam Bảo tải khoảng 9 MB. Cần ảnh thu nhỏ (T41b).
  - Trang khu vực đọc thêm `bao-tuong.json` (984 KB) khi Worker khởi động nguội. Riêng bộ chuyển `posts.json` tốn khoảng 110 ms ở mọi trang, kể cả trang không dùng bài viết; plan giao việc này cho T19.

**Tiêu chí nghiệm thu:**
- [x] Ghim bản đồ dùng được bằng bàn phím, vùng chạm ≥ 48px, giữ đúng vị trí từ 375 đến 1440px (đo ở 4 cỡ, lệch < 0,5%)
- [x] Hiển thị ~~12~~ 14 khu vực; báo cáo snapshot ghi rõ vì sao site cũ chỉ liệt kê 12 (xem "Khác mô tả")
- [x] Liên kết sang bảo tượng dùng đúng dạng `/bao-tuong/{slug}_{mã}` (unit test trên dữ liệu thật; thẻ thành liên kết ở T16)

**Kiểm chứng:**
- [x] `npm run test:e2e -- vu-tru`: 11 test × 2 cỡ màn hình (3 test bề rộng bỏ qua trên điện thoại), có axe; hai trang mới được thêm vào test canh gác. Trang chủ thêm test cho slider khu vực.
- [x] Unit 137 xanh (thêm 5 test); `tsc` và eslint sạch; `npm run snapshot:check` có dòng `vu-tru.json: 14 khu vực…` và `bao-tuong.json: 126 tôn tượng, 62 tượng chính`
- [x] Toàn bộ e2e (438 test, 27 bỏ qua theo thiết kế): cục bộ 410 qua, 1 chập chờn (test dịch bố cục khi icon font về chậm, qua ở lần chạy lại); trên `v2.` 411/411 qua
- [x] Ảnh: `docs/anh/t15-vu-tru-phat-giao.png`

**Phụ thuộc:** T9, T10

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm vu-tru), `src/app/(site)/vu-tru-phat-giao/page.js`, `src/app/(site)/vu-tru-phat-giao/[slug]/page.js`, `src/components/site/TempleMap.tsx`, `src/components/sections/portfolios/Portfolios2.js`

**Quy mô:** M

---

### T19a: Mỗi trang chỉ nạp dữ liệu nó cần

**Mô tả:** Kéo phần "mỗi lượt chỉ đọc phần cần" của T19 lên trước T16 (chủ dự án chọn ngày 04/11, sau review T15). Repository không còn đọc `posts.json` khi được tạo; bài viết chỉ được đọc lần đầu có trang hỏi tới bài viết, như các nguồn khác. T16 sẽ thêm 126 trang tượng, mỗi trang đều đọc file bảo tượng, nên phần này cần có trước.

**Tiêu chí nghiệm thu:**
- [x] Trang không hiện bài viết (Giới thiệu, Tông Chỉ, Vũ Trụ, Lịch tu học) không đọc `posts.json`
- [x] Đọc lỗi thì lần sau đọc lại, không giữ lỗi mãi
- [x] Không đổi giao diện: toàn bộ e2e xanh

**Kết quả 04/11/2026:** xong, đã deploy `v2.`.
- **Đo trước khi sửa:**
  - Trên Node, bộ chuyển `posts.json` (632 bài) tốn khoảng 90–110 ms mỗi lần đọc. Chi phí rải đều qua việc làm sạch chữ, regex, đọc URL và zod; riêng chuyển thân bài sang HTML chỉ khoảng 8 ms.
  - Trước đây, repository đọc `posts.json` ngay khi được tạo, nên trang nào cũng trả chi phí này mỗi lần Worker khởi động nguội.
  - Các file khác nhẹ hơn nhiều: `tong-chi.json` khoảng 8 ms, `vu-tru.json` và `bao-tuong.json` mỗi file khoảng 4 ms.
- **Thay đổi:**
  - `createMemoryRepository` nhận bài viết dạng mảng (test) hoặc hàm nạp.
  - Một helper `lazy()` thay cho sáu đoạn `??=` lặp nhau: đọc lần đầu được hỏi, giữ lại kết quả, và nếu đọc lỗi thì lần sau đọc lại (trước đây một lần đọc lỗi bị giữ đến hết đời Worker).
  - Nay chỉ trang chủ và các trang Dòng Chảy còn đọc bài viết.
- **Số đo trên `v2.` (Workers telemetry):** nhiễu, chỉ nên xem như chiều hướng.
  - Mẫu trước khi sửa chỉ có vài chục yêu cầu RSC, vì truy vấn dừng ở 2000 sự kiện.
  - CPU trung vị của yêu cầu RSC: `/gioi-thieu` 416 → 84 ms, `/lich-tu-hoc` 269 → 45 ms. `/tong-chi-tu-hoc` gần như không đổi (104 → 98 ms; mẫu trước chỉ có 8 yêu cầu).
- **Phát hiện mới, chỗ tốn CPU lớn nhất:**
  - Trong 9 phút chạy e2e sau khi deploy, Worker dựng khoảng 2000 bản RSC để tải trước liên kết, trong khi chỉ có khoảng 180 lượt mở trang thật.
  - Mỗi lượt xem kéo theo khoảng 10 lượt dựng trang cho các liên kết trong menu, lối vào và footer. Mỗi lượt dựng tốn 45–240 ms CPU (trung vị), vì nhiều Worker đang khởi động nguội.
  - Đây là đòn bẩy CPU lớn hơn việc nạp dữ liệu. Có thể tắt tải trước cho các liên kết lặp ở menu và footer, hoặc chỉ tải trước khi rê chuột, đổi lại chuyển trang chậm hơn một chút. Cần quyết cùng Câu hỏi mở #8.
- **Sửa thêm (có từ T2/T11, hôm nay mới lộ vì thẻ ngày bị đẩy xuống dưới mép màn hình):**
  - Khi trình duyệt vừa cuộn khung `#smooth-wrapper` để hiện một liên kết (Tab, hoặc Playwright cuộn trước khi bấm) rồi người dùng bấm ngay, sự kiện `scroll` của khung đến sau và kéo ScrollSmoother về chỗ cũ. Nội dung kẹt giữa chừng; trên trang lịch, thẻ sự kiện đứng ở 3226 px thay vì 130 px.
  - `revealTarget` nay xóa độ cuộn đó trước khi cuộn tới đích. Test lướt tới sự kiện trên trang lịch nay luôn cuộn ngày vào màn hình trước khi bấm: đỏ trên bản cũ (3/3), xanh sau khi sửa (3/3).

**Kiểm chứng:**
- [x] Unit 139 xanh (thêm 2 test: bài viết chỉ được đọc khi có trang hỏi tới, và đọc lại sau khi lỗi; cả hai đỏ trước khi sửa); `tsc`, eslint sạch
- [x] Toàn bộ e2e (438 test, 27 bỏ qua theo thiết kế): cục bộ 409 qua, 1 chập chờn (dịch bố cục khi icon font về chậm), 1 hỏng là lỗi lướt trang lịch ở trên (đã sửa; chạy lại các bộ lịch, Tông Chỉ, trang bài và canh gác: 146/146); trên `v2.` 411/411 qua

**Phụ thuộc:** T4

---

### T41c: Ảnh – sửa nhanh trong code

**Mô tả:** Kéo phần ảnh của T41 lên trước (chủ dự án chọn ngày 04/11, sau review tốc độ tải trang). Làm trước T16, vì 126 trang tượng sẽ hiện ảnh theo cùng cách. Phần này không cần hạ tầng mới; bản thu nhỏ cho kho ảnh để T41d.

- **Mốc đo 04/11/2026** (Lighthouse 12.6, điện thoại 4G giả lập, trên `v2.`):

  | Trang | Điểm | LCP | Tải về | Riêng ảnh |
  |---|---|---|---|---|
  | Trang chủ | 66 | 8,4 s | 2,9 MB | 1,6 MB |
  | `/dong-chay-hoang-phap` | 60 | 11,9 s | 11,7 MB | 10,5 MB |
  | Bài "Cộng tu pháp hội niệm Phật tháng 7…" | 54 | 47,9 s | 11,2 MB | 10 MB |

- **Nguyên nhân:**
  - Ảnh bài mới tải lên WordPress từ tháng 9 là ảnh gốc máy ảnh Nikon, 6048×4024 px, 7–9 MB. Admin cũ không nén.
  - Ảnh được dùng nguyên bản ở mọi cỡ hiển thị: ảnh bìa 1200 px, thẻ bài 480 px, ô album 400 px, ảnh nhỏ dưới hero 80 px.
  - Trang bài viết đặt `fetchPriority="high"` cho ảnh bìa 7,9 MB. Phần đầu trang (ảnh nền 5 KB) phải chờ ảnh này.
  - Album của bài trên có 117 ảnh, tổng khoảng 188 MB; 12 ô hiện sẵn đã gần 100 MB.
- **Mẫu kho ảnh** (HEAD toàn bộ 591 ảnh thẻ/bìa và 400 ảnh album ngẫu nhiên):
  - Ảnh thẻ/bìa: trung vị 566 KB, p90 1,3 MB, tổng 395 MB.
  - Ảnh album cũ trên B2 phần lớn đã nhỏ (trung vị 92 KB); ảnh mới trên WordPress là ảnh gốc.
- **Việc làm:**
  - `pattern-2.svg`, `pattern-3.svg` (548 KB mỗi file, bên trong là PNG nhúng, hiển thị 370×590) đổi sang WebP 740 px, sửa mọi chỗ dùng (`Footer2`, `Services2`…).
  - Ảnh nhỏ 80×80 dưới hero (`src/libs/home.ts`, khung "Pháp sự mới nhất" và khung khóa tu) không dùng ảnh bìa gốc. Dùng ảnh thẻ của bài nếu có.
  - Trang danh sách: bỏ `eager` của 3 thẻ đầu. React tự chèn preload cho ảnh không lazy, nên 3 ảnh này (có ảnh 7,9 MB) đang được tải trước cả CSS.
  - Ảnh bìa ở trang bài, Tông Chỉ, Vũ Trụ: ảnh nằm ngoài site và chưa có bản thu nhỏ thì không đặt `fetchPriority="high"` và không để React preload.
  - Ảnh tĩnh `/images/*`, `/brand/*`:
    - Thêm `public/_headers` với `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`. Hiện các file này có `max-age=0, must-revalidate`, nên mỗi lượt vào trang trình duyệt lại phải hỏi máy chủ.
    - Bỏ hai thư mục này khỏi `runWorkerFirst` để không tốn CPU Worker.

**Kết quả 04/11/2026:** xong, đã deploy `v2.` (làm trên nhánh `perf/t41c-anh`, worktree riêng, để không lẫn phần T16 đang làm dở).
- **Ảnh đầu trang:**
  - Hàm `topImagePriority(src)` trong `media.ts` trả "high" cho ảnh của site, "low" cho ảnh từ B2 hay WordPress.
  - "low" còn khiến React không preload: React tự preload mọi `<img>` không có `loading="lazy"` hoặc `fetchPriority="low"`.
  - Áp cho ảnh bìa trang bài, Tông Chỉ, khu vực Vũ Trụ và chân dung trang Giới thiệu.
- **Trang danh sách:** thẻ bài tải lười hết; bỏ prop `eager` khỏi `PostCard`. Đảo tiêu chí "3 ảnh đầu tải ngay" của T7; test `dong-chay` sửa theo.
- **Hoa văn:**
  - Hai file chỉ là nét trắng rất mờ (độ đục tối đa 22/255).
  - Xuất WebP lossless 740×1180, nền trắng, giữ nguyên kênh alpha: 45 KB mỗi file (trước 548 KB). So ảnh chụp trong Chromium trên nền tối với `mix-blend-mode: difference`: chênh tối đa 6/255, trung bình 0,07.
  - Xóa hai file SVG cũ.
- **`public/_headers`:**
  - Khi có file này, vinext không tự sinh luật `/_next/static/*` nữa, nên luật đó được chép vào file.
  - Ảnh tĩnh nay đi thẳng từ kho tài sản, nên không còn nhận header `X-Robots-Tag` của `next.config.js`. T20 lo robots theo host.
- **Không làm:** ảnh nhỏ dưới hero vẫn dùng chung URL với ảnh của khung. Hai ảnh trùng URL nên trình duyệt chỉ tải một lần; đổi sang ảnh thẻ sẽ thành hai lần tải. Giảm dung lượng để T41d.
- **Lighthouse điện thoại trên `v2.`** (trước → sau, sau đo 2 lượt):

  | Trang | LCP | Ảnh tải về |
  |---|---|---|
  | Trang chủ | 8,4 s → 6,9–8,2 s | 1,6 MB → 0,9 MB |
  | `/dong-chay-hoang-phap` | 11,9 s → 7,5–7,6 s | 10,5 MB (không đổi) |
  | Bài "Cộng tu pháp hội niệm Phật tháng 7…" | 47,9 s → 11,2–11,3 s | 10 MB (không đổi) |

  - Hai trang sau vẫn tải ảnh gốc, chỉ là không còn ưu tiên. Ảnh vẫn chiếm băng thông: trang bài có Render Delay 8,4 s. Phải có T41d mới hết.
- **Cho T16:** `StatueCard` đang làm dở có `eager` cho 4 thẻ đầu. Ảnh tượng nặng 0,2–1,5 MB nên sẽ bị React preload. Khi thêm trang tượng vào `PAGES` của `image-budget.spec.ts`, test sẽ bắt lỗi này. (Đã xử lý ở T16, xem mục "Ảnh" của T16.)

**Tiêu chí nghiệm thu:**
- [x] Không trang nào preload hoặc đặt `fetchPriority="high"` cho ảnh lớn hơn 500 KB (test canh gác mới chạy mọi trang)
- [x] Hai ảnh hoa văn ≤ 50 KB mỗi ảnh; không đổi giao diện (so ảnh chụp trước–sau)
- [x] `/images/*` và `/brand/*` trả `Cache-Control` ≥ 1 ngày và không chạy qua Worker
- [x] Lighthouse 3 trang ở bảng mốc: ghi số trước–sau

**Kiểm chứng:**
- [x] `npm run test:e2e -- image-budget`: đỏ trên bản cũ ở `v2.` (4 test), xanh cục bộ và trên `v2.`
- [x] Lighthouse điện thoại 3 trang trên `v2.` (số ở trên)
- [x] Unit 139 xanh; `tsc`, eslint không lỗi
- [x] Toàn bộ e2e: trên `v2.` 435/435 qua (27 bỏ qua theo thiết kế). Cục bộ 432 qua; 2 test `dong-chay` hỏng vì lượt chạy đã nạp bản test cũ, 1 test dịch bố cục trang lịch chập chờn (đã ghi ở T19a); chạy lại `dong-chay`, `lich-tu-hoc`, `image-budget`: 70/70

**Phụ thuộc:** T8, T10

**File dự kiến:** `public/images/shape/pattern-2.webp`, `pattern-3.webp`, `src/components/layout/footer/Footer2.js`, `src/components/sections/services/Services2.js`, `src/libs/home.ts`, `src/app/(site)/dong-chay-hoang-phap/page.tsx`, `src/app/(site)/dong-chay-hoang-phap/[slug]/page.tsx`, `public/_headers`, `cloudflare.config.ts`, `tests/e2e/image-budget.spec.ts`

**Quy mô:** L

---

### T16: Bảo Tượng Phật Giáo

**Mô tả:** Adapter `bao-tuong` (126 tượng, 15 cụm; ghép khu vực theo `areaId`). `/bao-tuong-phat-giao`: lưới thẻ chân dung 3:4 theo `TeamCard`, lọc chúng hội / khu vực / loại tượng (`<select>` gốc), tìm theo tên hoặc mã, phân trang 24 trên URL. `/bao-tuong/[slugCode]` theo khuôn `TeamDetails1`: chân dung, danh hiệu, lời dạy (`scripture`), bài viết, nghệ thuật Phật giáo (album), video, bảo tượng liên quan.

**File Bexon:** `shared/cards/TeamCard*.js`, `sections/teams/TeamDetails1.js`

**Kết quả 04/11/2026:** xong, đã deploy `v2.`. T16 và T41c được làm song song trên hai nhánh rồi gộp lại (xem "Gộp với T41c").
- **Khác mô tả:**
  - **Không có mục Video.** Dữ liệu tượng không có trường video nào; trang cũ chỉ có khung trống. Mục sẽ thêm khi có dữ liệu (T19).
  - **Nghệ thuật Phật giáo là thẻ, không phải album.** `artVariations` (12 tượng, 40 tác phẩm) là các tượng khác của cùng vị: 34 tác phẩm có trang riêng nên thẻ dẫn sang trang đó; 6 tác phẩm còn lại không có bản ghi tượng nên chỉ hiện chữ.
  - **15 "cụm" thật ra là 12.** `clusterMembers` luôn trống, nên cụm chỉ có tên (`clusterName`). Trong 15 tên, "Thập Đại Đệ Tử" được viết hai kiểu hoa thường, nay so không phân biệt; "Bảo Tượng Phật Giáo" và "Nghệ Thuật Phật Giáo" là tên chung cho tượng không thuộc cụm nào, nên không hiện là cụm. Tên cụm hiện ở phần thông tin và dùng để chọn tượng liên quan.
- **Lớp dữ liệu** (`src/libs/content/baoTuong.ts`):
  - `parseStatues` đọc tượng, chúng hội, cụm, lời dạy, bài viết và tác phẩm. Repository có thêm `getStatue(slug)`; trang tượng chỉ dựng HTML cho tượng được hỏi và giữ lại.
  - Bài viết lấy `articleContent`, không có thì lấy chữ của `fullHistoryHtml`: chỉ giữ chữ trong từng đoạn, mọi thẻ HTML của người soạn bị bỏ (unit test với `<script>`, `javascript:`, `onclick`).
  - Lời dạy chỉ hiện khi khác tên tượng: 21 tượng có "lời dạy" chỉ lặp lại tên, nay bỏ; 35 tượng để trống; 70 tượng có lời dạy thật.
- **`/bao-tuong-phat-giao`** (server, thẻ `TeamCard`):
  - 24 tượng mỗi trang. Lọc theo chúng hội, khu vực (14 khu vực của Vũ Trụ), loại tượng (Tượng chính / Nghệ thuật Phật giáo), tìm theo tên không cần dấu hoặc theo mã (TP0001). Mọi bộ lọc và trang nằm trên địa chỉ (`?q=&chung-hoi=&khu-vuc=&loai=&trang=`).
  - Form là GET thường nên chạy cả khi không có JavaScript (có test). Khi có JavaScript, chỉ ô có giá trị lên địa chỉ và danh sách tải lại tại chỗ; dòng trạng thái (`role="status"`) đọc số tượng mới.
  - Không có kết quả: "Không có tôn tượng phù hợp" kèm gợi ý và nút "Bỏ lọc". Trang quá số trang: "Không có trang N" kèm "Về trang đầu".
- **`/bao-tuong/{slug}_{mã}`** (server, khuôn `TeamDetails1` như trang chủ đề Giới thiệu):
  - Giữ đúng địa chỉ cũ; slug không có hoặc sai mã trả 404.
  - Tổng quan: chân dung 3:4, nhãn loại tượng, danh hiệu, bảng thông tin (cụm tượng, chúng hội dẫn về danh sách đã lọc, nơi tôn trí dẫn sang trang khu vực, mã tượng), lời dạy kiểu kinh văn.
  - Câu chuyện trong khung đọc (cỡ chữ, nền giấy), Nghệ thuật Phật giáo, Bảo tượng liên quan (4 tượng chính cùng cụm, rồi cùng chúng hội). Thanh mục lục chỉ hiện các phần có dữ liệu.
  - Thẻ tượng ở trang khu vực nay là liên kết (`/bao-tuong` vào `livePaths`).
- **Ảnh** (theo quy tắc của T41c, vì ảnh tượng là ảnh gốc: 28/126 chân dung trên 500 KB, nặng nhất 4,4 MB):
  - Thẻ tượng luôn `lazy`. Bản đầu cho 4 thẻ đầu `eager`, và React chèn preload cho cả 4 ảnh (khoảng 3 MB) trước CSS; test mới đỏ trên bản đó, xanh sau khi sửa.
  - Trang danh sách chỉ tải ảnh của trang đang xem (site cũ tải 109 ảnh). Đã đo: tải trước trang tượng qua liên kết không kéo theo ảnh nào.
  - Chân dung ở trang tượng dùng `topImagePriority()` của T41c như các trang khác: ảnh ngoài site được ưu tiên thấp nên React không preload.
  - Trang danh sách và trang TP0077 (chân dung 4,4 MB, nặng nhất) được thêm vào `image-budget.spec.ts`. Test đỏ trước khi sửa (preload ảnh 4433 KB), xanh sau khi sửa.
- **Gộp với T41c:**
  - T41c được làm trong một worktree riêng (nhánh `perf/t41c-anh`) cùng lúc với T16. Bản T41c deploy lên `v2.` lúc 10:09, hai phút sau bản T16 (10:06), và đè mất trang tượng. Vì vậy lượt e2e đầu tiên trên `v2.` gặp 404 ở các test chạy sau mốc đó.
  - Đã gộp `perf/t41c-anh` vào nhánh này. Chỉ xung đột ở `tasks/plan.md` (hai bên cùng tick việc của mình).
  - Sau khi gộp, `v2.` được deploy lại với cả T16 lẫn T41c.
- **Chờ Ban Biên Tập:**
  - 15 tượng thuộc chúng hội "chưa phân loại" mang tên chúng hội "Bảo Tượng Phật Giáo", nên bộ lọc có một mục trùng tên chuyên mục.
  - 17 tượng chính không có mã TP; 2 tượng `cong_thap` chưa có khu vực (đã có trong báo cáo snapshot từ T15).
  - Tên "Đức Phật Phá́p Hải Thắng Huệ…" có một dấu thừa trong dữ liệu.

**Tiêu chí nghiệm thu:**
- [x] Trang danh sách tải ≤ 24 ảnh lúc đầu (site cũ tải 109 ảnh): test kiểm không ảnh nào của trang khác được tải, không ảnh tượng nào bị preload
- [x] URL `/bao-tuong/{slug}_{mã}` cũ mở đúng tượng; mã sai trả 404
- [x] Lọc và tìm giữ trên URL; không có kết quả thì hiện hướng dẫn bỏ lọc

**Kiểm chứng:**
- [x] `npm run test:e2e -- bao-tuong`: 11 test × 2 cỡ màn hình, có axe, có một test chạy không JavaScript; hai trang mới được thêm vào test canh gác
- [x] Unit 149 xanh (thêm 10 test, 2 test cụm tượng đỏ trước khi sửa; thử đột biến 8/8 bị bắt); `tsc`, eslint sạch
- [x] Toàn bộ e2e sau khi gộp T41c (496 test, 27 bỏ qua theo thiết kế): cục bộ 469/469 qua, trên `v2.` 469/469 qua (phiên bản Worker `1cb306d0`, không có deploy nào khác trong lúc chạy). Lượt chạy trước khi gộp gặp 404 trên `v2.` vì bản T41c đè lên, xem "Gộp với T41c".
- [x] `image-budget`: thêm trang danh sách và trang TP0077; đỏ trước khi sửa, xanh sau
- [x] Ảnh: `docs/anh/t16-bao-tuong-phat-giao.png`

**Phụ thuộc:** T15

**File dự kiến:** `src/lib/content/sources/snapshot.ts` (thêm bao-tuong), `src/app/(site)/bao-tuong-phat-giao/page.js`, `src/app/(site)/bao-tuong/[slugCode]/page.js`, `src/components/shared/cards/TeamCard.js`, `tests/e2e/bao-tuong.spec.ts`

**Quy mô:** M

---

### T17: Trí Tuệ Phật Pháp

**Mô tả:** Dùng adapter posts (4 tiểu mục: Bài viết nghiên cứu · Pháp âm giảng giải · Video Phật pháp · Ấn phẩm & kinh sách). `/tri-tue-phat-phap` dùng lại khuôn T7, lọc theo tiểu mục. Chi tiết dùng lại khuôn T8, thêm biến thể: sách (bìa 3:4, nguồn), pháp âm (`<audio controls preload="none">`), video. `/tri-tue-phat-phap/hoc-tieng-tang` render phía server.

**File Bexon:** như T7, T8

**Kết quả 13/11/2026:** xong, đã deploy `v2.`. Có bốn chỗ khác mô tả ở trên, ghi ở mục đầu.
- **Khác mô tả:**
  - **Không có trình phát pháp âm, không có video.** Dữ liệu 15 bài Pháp Âm không có file âm thanh; 15 bài Video Phật Pháp không có link YouTube nào, nội dung chỉ là tiêu đề. Trang cũ của các bài này cũng không phát gì. Hai loại bài này hiện ảnh và chữ như bài thường; khi có dữ liệu thì khối Video của trang bài (T9) tự hiện.
  - **Không có kiểu "bìa 3:4" cho trang bài sách.** Ảnh của bài "Đi Qua Khổ Vui Cuộc Đời" là ảnh chụp sách cạnh tràng hạt (khổ ngang), không phải bìa. Bìa thật (lấy từ chủ đề Giới thiệu của Thầy Thích Tâm Hòa) đặt ở trang sách riêng; bài giới thiệu sách có nút "Đọc sách" dẫn sang đó. Dữ liệu cũng không có trường "nguồn" của sách.
  - **Danh sách cũ không hiện 158 bài.** Trang `/tri-tue-phat-phap` cũ chỉ hiện 7 mục viết sẵn trong mã (2 sách, 2 pháp âm, 1 bài, 1 video, 1 câu chuyện; 3 mục không có trong dữ liệu). Trang mới liệt kê đủ 158 bài theo 4 mục, như Dòng Chảy.
  - **Thêm hai phòng đọc của site cũ.** Ngoài `hoc-tieng-tang`, địa chỉ `/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi` (Tông Chỉ dẫn tới) là bộ đọc toàn văn cuốn sách. Cả hai là ứng dụng riêng. Chủ dự án chọn ngày 13/11: T17 dựng trang giới thiệu phía server, còn việc chuyển ứng dụng tách thành T17b.
- **Dùng chung với Dòng Chảy:**
  - Tách trang danh sách và trang bài thành `PostListPage` và `PostArticle`, nhận chuyên mục từ `src/config/sections.ts` (commit riêng, không đổi hành vi).
  - Mỗi chuyên mục chỉ mở bài của mình: slug Trí Tuệ dưới `/dong-chay-hoang-phap` trả 404, và ngược lại.
- **`/tri-tue-phat-phap`:**
  - 158 bài, lọc theo 4 mục (Bài Viết 126, Pháp Âm 15, Video Phật Pháp 15, Ấn Phẩm & Sách 2), sắp xếp và phân trang trên địa chỉ.
  - Bên dưới là khối "Sách và giáo trình": cuốn sách và khóa Học tiếng Tạng.
- **`/tri-tue-phat-phap/[slug]`:** trang bài như Dòng Chảy, có cache ở edge như các trang bài khác (T41e).
- **`/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi`** (dựng phía server):
  - Bìa và lời giới thiệu lấy từ chủ đề Giới thiệu; tác giả, nhà xuất bản, số trang và mục lục 7 chương mục ghi trong `src/config/triTue.ts`, đọc từ trang cũ.
  - Nút "Đọc toàn văn" mở bộ đọc của site cũ trong thẻ mới; liên kết sang bài giới thiệu sách.
- **`/tri-tue-phat-phap/hoc-tieng-tang`** (dựng phía server; trang cũ chỉ là một khung nhúng trống):
  - Lời giới thiệu (chữ của trang cũ), những gì phòng học có, mục lục 24 bài của Sara Book theo trang.
  - Chữ Tạng trong mục lục được đánh dấu `lang="bo"` để trình đọc màn hình đổi giọng và trình duyệt chọn font Tạng. Site không có font Tạng; font hệ thống trên Windows (Microsoft Himalaya) vẽ nhỏ nên được phóng to.
  - Nút "Vào học ngay" mở phòng học ở site cũ (`/tibetan-study/`) trong thẻ mới.
- **Trang chủ và liên kết:**
  - `LIVE_SECTIONS` thêm Trí Tuệ: "Tin mới nhất" và "Dấu ấn hoằng pháp" lấy cả bài Trí Tuệ.
  - `/tri-tue-phat-phap` vào `livePaths`: liên kết từ Tông Chỉ sang Trí Tuệ (danh sách và cuốn sách) nay là liên kết thật.
  - Unit test trang chủ và Tông Chỉ dùng bài Trí Tuệ làm ví dụ "chuyên mục chưa có trang"; nay đổi sang bài thuộc Vũ Trụ Phật Giáo (chuyên mục không có trang bài) và Liên hệ (chưa có trang).
- **Sửa thêm:** trang tượng (`/bao-tuong/[slug]`, T16) chưa vào cache ở edge vì thiếu `revalidate`; nay có, và có trong `edge-cache.spec.ts` (commit riêng).
- **Chờ Ban Biên Tập:**
  - Tiêu đề bài sách có dấu nháy thừa ở cuối: "Đi Qua Khổ Vui Cuộc Đời' ".
  - Mục "Ấn Phẩm & Sách" có hai tên trong dữ liệu ("Ấn Phẩm & Sách", "Ấn Phẩm Sách").

**Tiêu chí nghiệm thu:**
- [x] 158 mục chia đúng 4 tiểu mục (126 / 15 / 15 / 2)
- [x] Pháp âm không tự phát, không tải trước file âm thanh (không có file âm thanh nào; test kiểm không có `autoplay` và không có yêu cầu media)
- [x] `/tri-tue-phat-phap/hoc-tieng-tang` có nội dung trong HTML ban đầu (test đọc HTML gốc, không chạy JavaScript)

**Kiểm chứng:**
- [x] `npm run test:e2e -- tri-tue`: 10 test × 2 cỡ màn hình, có axe; bốn trang mới vào a11y, ba vào canh gác hiệu ứng, ba vào ngân sách ảnh và cache ở edge
- [x] Unit 163 xanh (thêm 5 test cho phần tách chữ Tạng và mục lục; một đột biến lọt qua lúc đầu, đã thêm test); `tsc`, eslint không lỗi
- [x] Toàn bộ e2e (628 test, các test chỉ chạy một nơi được bỏ qua): bản sạch cục bộ 557 qua; trên `v2.` (phiên bản Worker `468dd736`) 574 qua. Mỗi nơi hỏng 1 test và đều chạy lại thì qua:
  - **Cục bộ:** test lướt tới sự kiện ở trang lịch hỏng khoảng 1–2/10 lần, kể cả trên bản HEAD trước T17 (dựng riêng trong worktree, 2/10 hỏng, cùng dấu hiệu 3226 px như lỗi đã sửa ở T19a). Lỗi có sẵn, chưa sửa.
  - **`v2.`:** test tiêu đề trang bài Dòng Chảy, chạy lại 4/4 qua.
- [x] Ảnh: `docs/anh/t17-tri-tue-phat-phap.png`
- **Cách kiểm (13/11):** trong checkout lúc đó có thay đổi chưa commit của một phiên khác (giao diện ban đêm, trang `demo-bo-cuc`). Vì vậy bản kiểm và bản deploy được dựng từ một worktree sạch ở HEAD, chỉ thêm các file của T17.

**Phụ thuộc:** T8

**File dự kiến:** `src/app/(site)/tri-tue-phat-phap/page.js`, `src/app/(site)/tri-tue-phat-phap/[slug]/page.js`, `src/components/site/PublicationMeta.tsx`, `src/lib/content/sources/snapshot.ts`

**Quy mô:** M

---

### T17b: Chuyển hai phòng đọc của Trí Tuệ sang site mới

**Kết quả 17/11/2026:** sách và Học tiếng Tạng xong trên mã, kiểm cục bộ; **chưa lên `v2.`**.
- **Bản xem thử:** Worker riêng `tlhp-web-xem-thu` (dựng từ worktree sạch ở commit `51a32e2`, nội dung snapshot, không D1), tại https://tlhp-web-xem-thu.database-tunglamhoaphuc.workers.dev — không đụng `v2.`, DNS hay Worker `tlhp-web`. Không dùng `previews deploy` vì `tlhp-web` tắt `workers.dev` nên bản preview `t17b` tạo ra không có địa chỉ. Đã kiểm trên link: trang sách, ứng dụng mở trang 1 không lỗi console; `/api/analyze` (≈ 35 s lần đầu, 0,6 s khi đã có cache), `/api/ask-ai` (≈ 6 s), `/api/crop-analyze`, `/api/tts` (≈ 5 s) đều trả kết quả thật. Xóa Worker này sau khi chủ dự án xem xong. Trên đây ảnh qua `/cdn-cgi/image` không được biến đổi (zone không phục vụ `workers.dev`), nên ảnh bài viết là bản gốc.
- **Giới hạn của AI:** nghĩa và Wylie đúng ở các câu đã thử; cách tách âm tiết đôi khi sai (ví dụ ཡིག bị tách đôi). Lần phân tích đầu chậm (≈ 35 s). Lật sách 3D không làm: ảnh 217 trang không còn (404 trên `www`).
- **Sách "Đi Qua Khổ Vui Cuộc Đời":** chế độ "Đọc Văn Bản" của trang cũ là 7 chương mục, 29 bài (thơ, bài viết, trang lót, thông tin xuất bản), khoảng 21.000 ký tự, nằm trong mã JS của trang cũ. Đã chép sang `src/config/sachDiQuaKhoVui.ts` (bỏ địa chỉ ảnh B2 và danh sách trang lật). Trang `/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi` (cùng địa chỉ cũ) nay có phần "Toàn văn Quyển 1" dựng phía server, đọc được khi tắt JavaScript; mỗi dòng mục lục dẫn tới phần của nó (`#phan-1`…`#phan-7`), nút "Đọc toàn văn" dẫn tới `#toan-van` trên chính trang này.
- Đây là toàn bộ chữ mà trang cũ có, **không phải đủ 217 trang in**: trang cũ chỉ có 217 trang dưới dạng ảnh cho chế độ lật sách (`/pdf/di-qua-kho-vui-q1/page-N.jpg`), và **các ảnh đó đang trả 404 ngay trên `www`** (kiểm trang 1, 50, 217 ngày 17/11). Muốn có lật sách hay đủ 217 trang cần nguồn ảnh hoặc PDF gốc từ chủ dự án.
- Sửa kèm `initSmoothScroller.js`: mở thẳng địa chỉ có neo (`…#toan-van`) trước đây rơi xuống chân trang vì trình duyệt cuộn trước khi ScrollSmoother chạy; nay đi tới đúng neo, dưới thanh đầu trang. Áp dụng cho mọi trang.
- Test: `tests/unit/triTue.test.ts` (dữ liệu sách, tách đoạn, neo), `tests/e2e/tri-tue.spec.ts` (toàn văn khi tắt JavaScript, mục lục dẫn tới từng phần, mở thẳng địa chỉ có neo, vừa màn hình 375 px, axe). Chạy cục bộ: `tri-tue`, `header`, `smoke`, `motion-guard`, `a11y` 233 xanh; `npm test` 237 xanh.
- **Học tiếng Tạng** (chủ dự án duyệt làm theo đề xuất ngày 17/11): ứng dụng cũ chép nguyên sang `public/tibetan-study/`, **cùng địa chỉ** `/tibetan-study/index.html` nên liên kết cũ vẫn chạy sau T22. Là file tĩnh (ra khỏi `runWorkerFirst`, không tốn CPU Worker), `Cache-Control` 1 ngày như ảnh của site.
  - 120 trang Sara Book đổi PNG → WebP (34,2 → 15,8 MB, chữ Tạng vẫn rõ); 34 file mp3 giữ nguyên; `sara_book_data.json`, `sara_words_coords.json` và bản tách mỗi trang một file (`coords/<n>.json`). Bỏ thẻ tải pdf.js (không dùng). Toàn thư mục 22 MB.
  - Bốn API (`src/app/api/*`, `src/libs/tibetan/`), giữ nguyên khuôn hỏi/đáp mà `app.js` đang dùng:
    - `/api/analyze`, `/api/ask-ai`: Workers AI, mô hình `@cf/google/gemma-4-26b-a4b-it` (thử 4 mô hình, cả 4 đọc đúng "bkra shis bde legs"; chọn mô hình này vì đúng, nhanh, rẻ nhất, không có lịch ngừng). Trang cũ trả **mẫu cố định, sai** (dịch བཀྲ་ཤིས་བདེ་ལེགས thành "Đất đai"). Kết quả giữ một tháng trong cache theo nội dung hỏi; AI lỗi thì trả bản dự phòng (tách âm tiết, báo "chưa trả lời được").
    - `/api/crop-analyze`: lấy chữ trong vùng khoanh từ tọa độ chữ của sách, không đọc ảnh; trình duyệt không còn gửi ảnh cắt lên.
    - `/api/tts`: Workers AI **không có giọng tiếng Tạng**, nên vẫn gọi dịch vụ đọc tiếng Tạng trên Hugging Face mà trang cũ dùng (`aipmtdd-tibetan-tts-service.hf.space`, của bên thứ ba, có thể ngừng bất cứ lúc nào); 34 chữ cái đọc từ mp3 thu sẵn; không có dịch vụ thì `app.js` dùng giọng của trình duyệt.
    - Giới hạn: chỉ nhận chữ Tạng, ≤ 300 ký tự (câu hỏi ≤ 600), thân yêu cầu ≤ 16 KB. Chưa có giới hạn số lần gọi theo người dùng: nên thêm (Rate Limiting hoặc Turnstile) trước khi lên `www`.
  - Binding `AI` trong `cloudflare.config.ts`; `/api/` thêm vào `robots.txt` disallow.
  - Test: `tests/unit/tibetan.test.ts` (13), `tests/e2e/tibetan-study.spec.ts` (mở trang 1 không gọi site cũ, file tĩnh, từ chối đầu vào lạ, khoanh vùng ra đúng chữ). Workers AI không chạy cục bộ (chỉ chạy trên Cloudflare): cục bộ chỉ kiểm được nhánh dự phòng.

**Mô tả:** Hai địa chỉ của Trí Tuệ trên site cũ là ứng dụng riêng, chưa có trên site mới (T17 chỉ dựng trang giới thiệu, nút mở bản ở site cũ). Sau khi `www` chuyển sang site mới (T22), hai nút đó sẽ dẫn vào chính trang mới, nên phải chuyển trước T22.
- **Học tiếng Tạng** (`/tibetan-study/index.html` trên Vercel): đọc Sara Book (120 trang ảnh PNG, khoảng 35 MB), giọng đọc 34 chữ cái (`audio/*.mp3`), hai file JSON 2,6 MB (chữ và tọa độ từng từ), thư viện pdf.js. Bốn API chạy trên máy chủ của site cũ: `/api/analyze`, `/api/ask-ai`, `/api/crop-analyze`, `/api/tts` (AI và đọc giọng; cần khóa dịch vụ của chủ dự án).
- **Sách "Đi Qua Khổ Vui Cuộc Đời" (Quyển 1)**: toàn văn 217 trang và chế độ lật sách 3D, nằm sẵn trong mã JavaScript của site cũ (trang không gọi API).

**Cần chủ dự án quyết:** để ảnh và âm thanh ở đâu (thư mục tĩnh của Worker hay kho media), dùng dịch vụ AI và đọc giọng nào cho bốn API, và có giữ bản lật sách 3D không.

**Tiêu chí nghiệm thu:**
- [x] Hai nút "Đọc toàn văn" và "Vào học ngay" mở bản trên site mới, không dẫn về `www` cũ (e2e `tri-tue`, `tibetan-study`)
- [x] Toàn văn sách đọc được khi không có JavaScript (toàn văn như bản đọc văn bản của trang cũ; e2e tắt JavaScript)

**Phụ thuộc:** T17; phải xong trước T22

**Quy mô:** L

---

### T18: Liên hệ và tìm kiếm từ khóa

**Mô tả:** `/lien-he` theo khuôn `ContactTop` + `Contact3` (bỏ form, chưa có nơi nhận): danh bạ (liên kết `tel:` ≥ 48px), giờ mở cửa, địa chỉ, ảnh bản đồ tĩnh + nút "Mở Google Maps", mạng xã hội, đọc từ cấu hình site. `/tim-kiem?q=`: tìm không phân biệt dấu trên tiêu đề + tóm tắt của mọi chuyên mục, nhóm theo chuyên mục, phân trang; nhận truy vấn từ popup tìm kiếm ở header và bật cờ hiện nút tìm kiếm (T5b).

**File Bexon:** `sections/contacts/ContactTop.js`, `sections/contacts/Contact3.js`, `layout/header/Header.js` (popup tìm kiếm)

**Kết quả 13/11/2026:** xong, đã deploy `v2.`. Site cũ không có `/lien-he` (trả 404) cũng như trang tìm kiếm, nên hai trang này mới hoàn toàn.
- **`/lien-he`** (khuôn `ContactTop` + `Contact3`, đọc từ `src/config/site.ts`):
  - Bốn thẻ: Địa chỉ (nút "Chỉ đường" mở Google Maps), Gọi điện (số chính của Trưởng ban lãnh chúng), Giờ mở cửa, Khóa tu và cộng tu (dẫn tới phần đăng ký).
  - Danh bạ 7 người theo vai trò; mỗi dòng là một liên kết `tel:` cao ít nhất 48 px. Hàm nhóm theo vai trò (`contactGroups`) chuyển từ footer vào `site.ts`, footer và trang này dùng chung.
  - Không có form của Bexon (chưa có nơi nhận). Không nhúng bản đồ Google (nặng, đặt cookie): trong lúc chờ ảnh bản đồ tĩnh (GD-06), chỗ đó là ảnh toàn cảnh chùa kèm địa chỉ và nút "Mở Google Maps".
  - Khối mạng xã hội chỉ hiện khi `site.social` có trang (đang trống, chờ GD-06).
- **`/tim-kiem?q=&muc=&trang=`** (dựng phía server, form GET chạy cả khi không có JavaScript):
  - Tìm trong 815 mục của 7 chuyên mục: 471 bài Dòng Chảy, 158 bài Trí Tuệ, 25 bài Tông Chỉ, 6 chủ đề Giới thiệu, 14 khu vực, 126 tôn tượng (cả mã TP), 15 sự kiện lịch tu học (dẫn tới đúng tháng và thẻ sự kiện).
  - So không dấu và theo nguyên từ: "niem phat" và "niệm Phật" cho cùng kết quả; "co" không khớp vào giữa "Cộng". Mỗi từ của truy vấn phải có trong tiêu đề hoặc dòng tóm tắt. Bản đầu so theo chuỗi con, khiến truy vấn toàn từ ngắn ("khong co gi…") vẫn ra kết quả; test e2e bắt được, nay đổi sang nguyên từ.
  - Xếp hạng: tiêu đề trùng khít truy vấn, rồi tiêu đề chứa cả cụm, rồi tiêu đề chứa đủ các từ; cùng hạng thì mới trước.
  - Mặc định hiện mọi chuyên mục, mỗi chuyên mục 4 kết quả kèm "Xem cả N kết quả trong …". Chọn một chuyên mục thì có 12 kết quả một trang, phân trang trên địa chỉ.
  - Truy vấn rỗng hoặc không có kết quả: lời nhắc và 7 chuyên mục để chọn.
  - Kết quả chỉ có chữ, không ảnh thu nhỏ, để không tiêu thêm hạn mức Image Transformations.
  - Trang có `noindex`. Nút tìm kiếm ở header (cờ `site.features.search` của T5b) nay bật trên mọi trang; test "cờ tắt" của T5b đổi thành test mọi trang đều tìm được.
- **Chi phí:** chỉ mục dựng một lần mỗi Worker (khoảng 17 ms), nhưng phải đọc mọi nguồn dữ liệu trước (bài viết khoảng 210 ms, tượng 43 ms khi đo trên Node). Lúc Worker khởi động nguội, tốn như trang danh sách Dòng Chảy; mỗi lần tìm sau đó khoảng 1 ms. Trang có tham số nên không vào cache ở edge (như danh sách và lịch, T41e).

**Tiêu chí nghiệm thu:**
- [x] "niem phat" và "niệm Phật" cho cùng kết quả (unit và e2e)
- [x] Truy vấn rỗng hoặc không có kết quả hiện gợi ý chuyên mục
- [x] Trang liên hệ không nhúng iframe bản đồ khi tải (test kiểm không có iframe và không có yêu cầu nào tới Google Maps)

**Kiểm chứng:**
- [x] `npm test -- search contacts`: 11 test; thử đột biến 9/9 bị bắt (một đột biến lọt qua lúc đầu, đã thêm test)
- [x] `npm run test:e2e -- lien-he tim-kiem header-extras`: 4 + 9 test × 2 cỡ màn hình, có axe và một test chạy không JavaScript; hai trang mới vào a11y, canh gác hiệu ứng; `/lien-he` vào cache ở edge
- [x] Toàn bộ e2e, dựng từ worktree sạch như T17 (trong checkout vẫn có việc dở của phiên khác):
  - **Cục bộ:** 580 qua, 11 hỏng rải rác ở các bộ không liên quan (đa số trên điện thoại). Lượt chạy mất 17 phút vì máy đang chạy test của các phiên khác; chạy lại riêng 11 test đó thì cả 11 qua.
  - **`v2.`** (phiên bản Worker `7b829c64`): 608 qua, 1 hỏng là test lướt trang lịch chập chờn có sẵn (đang sửa ở phiên riêng, xem T17).
- [x] Ảnh: `docs/anh/t18-lien-he-tim-kiem.png`

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

**Tiến độ 14/11/2026: phần mã xong, chờ chuẩn bị #4.** Chưa có bucket và khóa B2 chỉ đọc. Dò thử vài tên file quen thuộc trong hai bucket ảnh công khai (`s2-cnv03`, `media-tunglamhoaphuc`) thì đều 404, nên đã dừng và hỏi chủ dự án. Chủ dự án chọn: viết sẵn, chờ khóa. `v2.` vẫn chạy bằng snapshot. Các bước bật nguồn B2 ghi ở [docs/van-hanh/nguon-b2.md](../docs/van-hanh/nguon-b2.md).
- **Đã làm:**
  - `sources/files.ts`: mọi nguồn chỉ cần một hàm đọc file theo tên, trả `{ version, data }`. Các bộ nạp chỉ dịch lại một file khi version của nó đổi. Bản mới không còn mục nào mà bản trước có thì giữ bản trước và ghi log. Snapshot chạy qua đúng các bộ nạp này (version cố định), nên không đổi hành vi.
  - `sources/b2.ts`:
    - ký GET bằng `aws4fetch` (thêm phụ thuộc `aws4fetch` 1.0.20, MIT, không kéo theo gói nào);
    - mỗi file hỏi lại B2 tối đa mỗi phút một lần, kèm ETag (`If-None-Match`), file không đổi thì B2 trả 304 và không tải lại;
    - dùng chung bản cuối giữa các Worker cùng điểm Cloudflare qua Cache API;
    - B2 lỗi, mạng lỗi hoặc JSON hỏng thì giữ bản tốt gần nhất và ghi log `[b2]`;
    - thiếu biến môi trường thì báo đúng tên biến thiếu, không bao giờ in giá trị khóa.
  - `getContentRepository()`: với `CONTENT_SOURCE=b2`, mỗi phút tạo repository mới trên cùng bộ nạp (dữ liệu dẫn xuất như chỉ mục bài, trang tượng được dựng lại; file không đổi thì không đọc hay dịch lại).
  - Kiểm bản build: mã B2 chỉ nằm trong bundle của Worker, không có trong `assets/` gửi về trình duyệt.
- **Khác mô tả:**
  - Bộ đọc hỏi lại B2 mỗi phút thay vì "mỗi chu kỳ 5 phút". Bài sửa hiện ra sau khoảng 1 phút cộng thời gian trang ISR được làm mới (tối đa 5 phút).
  - Chưa làm KV (gói Free chỉ cho 1.000 lần ghi KV mỗi ngày, cần quyết cùng Câu hỏi mở #8) và trang `/van-hanh/lam-moi` (cần Access).
- **22/11/2026, kiểm lại, vẫn chưa có khóa:** `.dev.vars` và secret của Worker `tlhp-web` chỉ có `ADMIN_ENC_KEY`, `ADMIN_JWT_SECRET`; không có biến `B2_*`. Chưa kiểm được tên và định dạng file thật. Lưu ý: mô tả nói 13 file nhưng `createFileLoaders` chỉ đọc 8 tên (`posts`, `post-albums`, `schedule`, `gioi-thieu`, `tong-chi`, `vu-tru`, `bao-tuong`, `danh-tang`); các file còn lại chưa có adapter, tên thật chỉ biết khi chủ site liệt kê (nguon-b2.md mục 1).
- **Còn phải kiểm khi có khóa:** các adapter viết theo dữ liệu API công khai của site cũ, chưa chắc khớp file gốc trên B2 (tên và định dạng).

**Tiêu chí nghiệm thu:**
- [ ] Sửa một bài trong admin cũ → `v2.` hiện bản mới trong ≤ 5 phút, hoặc ngay sau khi gọi làm mới (đã kiểm với bucket giả lập: bản mới hiện ở lượt repository kế tiếp, sau 1 phút; chưa kiểm thật)
- [ ] Cố tình làm hỏng file JSON (bản sao trên bucket thử) → trang vẫn phục vụ bản cũ, log có lỗi (đã kiểm với bucket giả lập; chưa kiểm thật)
- [ ] Khóa B2 không xuất hiện trong bundle phía trình duyệt; khóa không có quyền ghi (kiểm bằng lệnh ghi thử bị từ chối) (phần bundle đã kiểm; lệnh ghi thử chờ khóa)

**Kiểm chứng:**
- [x] `npm test -- b2 files source` (S3 giả lập): 13 test; thử đột biến 10/10 bị bắt; toàn bộ unit 187 xanh; `tsc`, eslint không lỗi
- [x] 22/11/2026: thêm 11 test vào `b2.test.ts` (tổng 17): từng biến thiếu được gọi đúng tên và không lặp giá trị nào; chỉ gửi GET (kể cả 304, JSON hỏng, B2 lỗi); JSON hỏng hoặc 403 thì giữ bản tốt gần nhất, log có `[b2]` và tên file, không có khóa hay mã khóa; lần đọc đầu hỏng không lộ khóa; bản cache hỏng bị bỏ qua
- [x] Không đổi hành vi với snapshot. Dựng từ worktree sạch, toàn bộ e2e: cục bộ 590 qua, 1 hỏng (test lướt trang lịch chập chờn có sẵn); trên `v2.` (phiên bản Worker `fce3f5db`) 609/609 qua
- [ ] Thử thật trên `v2.` với `CONTENT_SOURCE=b2`

**Phụ thuộc:** Checkpoint D; chuẩn bị #4 (bucket + khóa chỉ đọc)

**File dự kiến:** `src/lib/content/sources/b2.ts`, `src/app/van-hanh/lam-moi/page.tsx`, `vite.config.ts`, `cloudflare.config.ts`, `tests/unit/content/b2.test.ts`

**Quy mô:** M

---

### T20: SEO trước ra mắt

**Mô tả:** `generateMetadata` cho mọi route (thay metadata "Bexon - Corporate Business…" của gói); ảnh OG động (Satori + `brand-tokens.json`); `sitemap.xml` động; `robots.txt` theo host (`www` cho phép index, `v2.` chặn); JSON-LD `Article`, `Event`, `Place`, `Organization`; bộ favicon + manifest (tạm từ logo WebP, thay khi có SVG); bật Cloudflare Web Analytics (không cookie, HT-07).

**Kết quả 17/11/2026:** phần mã xong, đã deploy `v2.` (phiên bản Worker `e4327ff2`, 9.825 KiB, nén 1.251 KiB). Còn hai việc ngoài mã (xem tiêu chí).
- **Kiểm chứng:** toàn bộ e2e trên bản build 601 qua, 1 chập chờn qua ở lần thử lại (không dịch chuyển bố cục khi tải), 1 hỏng là test giữ focus của bộ lọc Dòng Chảy (chập chờn có sẵn khi máy bận; chạy riêng 8/8 xanh). Trên `v2.`: sitemap 811 địa chỉ theo host `v2.`, `robots.txt` chặn tất cả, header noindex còn nguyên, 9 test SEO qua (các test giả lập host `www` chỉ chạy được cục bộ). Sitemap trả trong 0,3–1,3 giây.
- **Theo host** (`src/libs/hosts.ts` là nguồn duy nhất của danh sách host công khai):
  - Header `X-Robots-Tag: noindex, nofollow` chỉ gắn khi host **không** phải `www`/tên miền gốc (`next.config.js`, điều kiện `missing` theo host). Bản đầu viết regex bằng chuỗi thường nên dấu chấm và `\d` mất nghĩa; test đơn vị bắt được, nay dùng `String.raw`.
  - `robots.txt` (`src/app/robots.ts`): host không công khai trả `Disallow: /`; `www` cho vào, chặn `/tim-kiem`, `/cdn-cgi/`, `/anh-goc/`, `/styleguide`, kèm dòng `Sitemap`.
  - `sitemap.xml` (`src/app/sitemap.ts`, làm lại tối đa mỗi giờ, vào cache ở edge): 811 địa chỉ (11 trang cố định, 471 + 158 bài, 6 chủ đề giới thiệu, 25 bài Tông Chỉ, 14 khu vực, 126 tượng), theo host đang hỏi, có `lastmod` cho bài; không có `/tim-kiem`, `/styleguide` hay trang mẫu Bexon.
  - Bản xem thử nhận `Host` giả (`preview.allowedHosts` trong `vite.config.ts`, chỉ chạy cục bộ) để test được câu trả lời của `www` mà chưa chuyển tên miền.
- **Metadata gốc** (`src/app/layout.js`) thay metadata Bexon: `metadataBase` là `www`, canonical của từng trang, `og:image` 1200×630 (`public/brand/og-tung-lam-hoa-phuc.jpg`, 140 KB, dựng từ ảnh toàn cảnh chùa, ấn tròn và UTM Niagara), `og:locale vi_VN`, `twitter:card`, favicon, apple-touch-icon, `manifest.webmanifest` (nền `#1a120b`), `theme-color`. Mỗi trang vẫn có `title` và `description` riêng như trước.
- **JSON-LD** (`src/libs/seo.ts`, thành phần `JsonLd`, chữ `<` được thoát để nội dung không đóng được thẻ): `Organization` + `BuddhistTemple` ở trang chủ, `Article` ở mọi bài Dòng Chảy và Trí Tuệ, `Event` cho từng sự kiện của tháng đang xem ở `/lich-tu-hoc`, `Place` ở `/lien-he`.
- **Khác mô tả:** không làm ảnh OG động bằng Satori. Satori cần WASM (khoảng 2 MB) mà Worker gói Free giới hạn 3 MB nén (hiện 1,2 MB), còn mọi trang dùng chung một ảnh chia sẻ nên ảnh tĩnh đủ. Khi mỗi bài cần ảnh riêng thì dùng ảnh bìa của bài (đã có trong `openGraph` của từng trang).

**Tiêu chí nghiệm thu:**
- [ ] Cloudflare Web Analytics bật trên `www`; sau 2 tuần ra mắt, LCP p75 trên điện thoại ≤ 2,5 s (mục tiêu LCP chốt 13/11, thay cho < 2,0 s trong Lighthouse). Nếu vượt: làm CSS màn hình đầu trong HTML và hoãn script (ghi ở T41b)
- [x] Không có 2 trang trùng `<title>`; sitemap liệt kê mọi trang công khai (e2e: mọi trang chuyên mục, chủ đề, khu vực, Tông Chỉ không trùng tiêu đề; 24 địa chỉ lấy mẫu từ sitemap đều 200 và có tiêu đề riêng. Bài viết được lấy mẫu, vì dữ liệu có sẵn một số bài trùng tiêu đề trong cùng chuyên mục, ghi ở `parsePosts`)
- [ ] Rich Results Test hợp lệ cho 1 bài viết và 1 sự kiện mẫu (dữ liệu có đủ trường Google yêu cầu và có test; công cụ của Google chỉ chạy được trên địa chỉ công khai, nên chờ `www`)
- [x] `v2.` trả noindex, `www` (giả lập host) cho phép index (e2e trên bản build: header, `robots.txt`, trang mẫu 404 trên `www`)

**Kiểm chứng:**
- [x] `npm run test:e2e -- seo`: 12 test (máy tính; trên điện thoại cùng câu trả lời nên bỏ qua); `npm test -- seo next-config`: 12 test, đã bắt lỗi regex host; eslint, `tsc` sạch

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

### T41d: Ảnh nội dung qua Image Transformations của Cloudflare

**Mô tả:** Làm trước T22, để khách thật trên `www` không phải tải ảnh gốc 7–9 MB (mốc đo ở T41c). Ngày 04/11 chủ dự án chọn xử lý bằng Cloudflare, không phụ thuộc bucket R2 `tlhp-media` và tên miền `media.tunglamhoaphuc.com`. Vì vậy bỏ phương án bản thu nhỏ tạo sẵn trên R2 (script `media-variants.ts`, manifest) đã ghi cùng ngày, chuyển sang Image Transformations của zone (quyết định 8 trong plan.md).

- **Cloudflare:** bật Transformations cho zone `tunglamhoaphuc.com` (dashboard → Images → Transformations; API báo `editable: false` nên không bật bằng lệnh được). Nguồn ảnh "This zone only". Gói Free: 5.000 lần biến đổi khác nhau mỗi tháng; vượt thì ảnh đã biến đổi vẫn phục vụ từ bộ đệm, ảnh mới trả lỗi 9422, không tính tiền.
- **`imageAt(src, width)`** trong `media.ts`: ảnh B2 và WordPress đi qua `/cdn-cgi/image/width=…,quality=75,format=auto,onerror=redirect/<nguồn>`. Ảnh của site và host khác giữ nguyên. Ba cỡ (`IMAGE_WIDTH`): 640, 1280, 1920.
- **`/anh-goc/<bucket>/<key>`:** route đưa ảnh B2 về chính zone, vì zone chỉ nhận nguồn của nó, và `onerror=redirect` chỉ chạy khi nguồn cùng tên miền.
  - Chỉ hai bucket `s2-cnv03`, `media-tunglamhoaphuc`; chỉ trả ảnh; từ chối khóa có `.` hay `..`.
  - `Cache-Control` 7 ngày. B2 không gửi header này, mà nguồn giữ dưới 1 giờ thì Cloudflare biến đổi ở mức thấp.
- **`/cdn-cgi/image/` trong app:** cục bộ không có Transformations, nên route này chuyển về ảnh gốc. Chỉ chuyển tới đường dẫn của site và host WordPress, không thành chỗ chuyển hướng tùy ý. Trên Cloudflare, edge trả lời trước nên route không chạy.
- **Album:** `albumImageAt` chỉ biến đổi ảnh WordPress. Ảnh B2 trong album đã nhỏ (trung vị 92 KB), còn album lớn (170 ảnh) sẽ tiêu hạn mức.
- **Ưu tiên tải:** ảnh đã biến đổi vẫn "low", không preload, vì quá hạn mức thì nó là ảnh gốc.

**Kết quả 04/11/2026:** xong, đã deploy `v2.` (commit `f545aee`).
- **Áp vào:** thẻ bài, thẻ tin, ảnh bìa trang bài / Tông Chỉ / khu vực, chân dung Giới thiệu, bìa sách, chương trình ở trang lịch, tranh chủ đề tháng, Lời Thầy dạy, Lời chào, thẻ khu vực, thẻ tượng, ảnh video, khung hero (1280 và 1920, ảnh nhỏ 640), album.
- **Đo ảnh:**
  - WordPress `45-1.jpg` (6048 px, 7,9 MB): 640 px còn 24,8 KB; 1280 px còn 81 KB.
  - B2 `2-2-scaled.jpg` (712 KB) qua `/anh-goc/`: 43 KB ở 640 px, 109 KB ở 1280 px (AVIF).
  - Lần đầu khoảng 3 s (lấy từ B2 rồi biến đổi), sau đó `HIT` khoảng 0,43 s.
- **Lighthouse điện thoại trên `v2.`** (trung vị 3 lượt; "trước" là mốc sáng 04/11):

  | Trang | Ảnh tải về | LCP | Speed Index | Điểm |
  |---|---|---|---|---|
  | Bài "Cộng tu pháp hội niệm Phật tháng 7…" | 9.961 → 186 KB | 47,9 → 4,6 s | 5,2 → 4,5 s | 54 → 77 |
  | `/dong-chay-hoang-phap` | 10.481 → 246 KB | 11,9 → 5,0 s | 6,8 → 4,4 s | 60 → 74 |
  | Trang chủ | 1.625 → 588 KB | 8,4 → 5,0 s | 5,3 → 4,8 s | 66 → 73 |

- **Sửa cùng ngày, trước T41d** (commit `5e79315`):
  - Slider tin tức trên trang chủ tải ảnh của mọi slide đang ẩn khi hiệu ứng bật, lúc bộ hiệu ứng GSAP khởi động, dù ảnh có `loading="lazy"`. Trên điện thoại đó là 9,3 MB, có ảnh 7,9 MB.
  - Nay chỉ slide đang hiện và slide kế tiếp có `src` (`NewsSlider` trong `Blogs2`). Trang chủ: ảnh 10,3 MB → 0,9 MB, điểm 48–53 → 66–74.
  - Chủ dự án giữ slider tự chạy ngay khi mở trang (không đợi cuộn tới).
- **Còn lại:**
  - ~~Chân dung và tác phẩm ở trang tượng~~: xong 13/11 cùng phần sửa T16 (chân dung 1280 px ưu tiên thấp, tác phẩm 360/640 px; test trong `bao-tuong.spec.ts`).
  - Ảnh chèn trong thân bài (`normalize.ts`).
  - Theo dõi trang Usage của Transformations. Các lượt e2e và Lighthouse ngày 04/11 cũng tính vào hạn mức.

**Tiêu chí nghiệm thu:**
- [x] Thẻ bài ≤ 80 KB (test kiểm 6 thẻ đầu trang danh sách), ảnh bìa ≤ 300 KB (81 KB), ô album ảnh WordPress còn 57 KB
- [ ] Không ảnh nào tải lớn hơn 2 lần cỡ hiển thị. Chưa đạt ở ảnh nhỏ 80 px dưới hero: dùng bản 640 (khoảng 25–40 KB), cố ý dùng chung với thẻ tin để khỏi tốn thêm lượt biến đổi
- [x] Trang bài "Cộng tu pháp hội niệm Phật tháng 7…" tải ≤ 1,5 MB ảnh trước khi cuộn (186 KB); LCP 3 trang ghi trước–sau (ở trên)
- [ ] Ảnh đã biến đổi không còn EXIF (chưa kiểm)
- [x] Vượt hạn mức hay Transformations bị tắt thì ảnh vẫn hiện (về ảnh gốc): `onerror=redirect` và route dự phòng

**Kiểm chứng:**
- [x] `npm test -- media`: 7 test mới, đỏ trước khi viết hàm; toàn bộ unit 156 xanh; `tsc`, eslint không lỗi
- [x] `npm run test:e2e -- image-sizes` (mới): đỏ trên bản cũ ở `v2.` (4 test), xanh sau khi deploy. Phần biến đổi bỏ qua khi chạy cục bộ; test ảnh thẻ hiện được và `/anh-goc/` chạy cả hai nơi
- [x] Toàn bộ e2e:
  - Cục bộ: các bộ bị ảnh hưởng 132/132.
  - Trên `v2.`: 480 qua, 3 hỏng (giảm chuyển động ở `/services`, `/portfolios`, `/team` trên điện thoại khi chạy dài 12 phút); chạy lại riêng 6/6 qua.
- [x] Lighthouse điện thoại 3 trang trên `v2.` (số ở trên)

**Phụ thuộc:** T41c

**File:** `src/libs/content/media.ts`, `src/app/anh-goc/[bucket]/[...key]/route.ts`, `src/app/cdn-cgi/image/[...rest]/route.ts`, `src/libs/home.ts`, các component ảnh (thẻ, album, bìa, hero), `tests/unit/content/media.test.ts`, `tests/e2e/image-sizes.spec.ts`

**Quy mô:** L

---

### T41f: Font, icon font, hiệu ứng khởi động sau và ảnh tĩnh (đợt 1 tối ưu hiệu suất)

**Mô tả:** Thêm ngày 04/11 (chủ dự án duyệt), sau khi đọc báo cáo PageSpeed và so với divineshop.vn. Ảnh không còn là nút thắt (T41d). Điểm thấp đến từ font, CSS chặn hiển thị, JavaScript trên luồng chính và TTFB. Đợt 1 gồm các việc nhanh, rủi ro thấp, không đổi giao diện. Đợt 2 là T41a (CSS, hydrate), đợt 3 là T41e (cache HTML ở edge). Cả ba xong trước T22.

- **Mốc đo 04/11/2026** (trang chủ `v2.`, điện thoại, Lighthouse 13.6, 4G chậm):
  - PageSpeed Insights lúc 17:37: **Performance 44**; FCP 2,0 s, LCP 7,4 s, TBT 1.380 ms, Speed Index 5,8 s, CLS 0. Luồng chính bận 6,1 s, 8 tác vụ dài, 217 phần tử có hoạt ảnh không chạy trên GPU.
  - Lighthouse 13.6 trên máy (2 lượt; máy nhanh hơn máy của PageSpeed nên TBT thấp hơn):

    | | `v2.` | divineshop.vn |
    |---|---|---|
    | Điểm | 53–70 | 84 |
    | LCP | 6,3–8,7 s | 2,4 s |
    | TBT | 163–500 ms | 478–521 ms (gần hết do GTM, Facebook) |
    | TTFB | 127 ms nóng, 1.391 ms Worker nguội | 82–93 ms |
    | CSS | 199 KB, 1 file chặn hiển thị | 8 KB |
    | Font | 722 KB | 37 KB |
    | JS | 314 KB | 1.099 KB |
    | Ảnh | 588 KB | 11 MB (tải lười, sau LCP) |
    | Luồng chính | Style & Layout 1,1–1,3 s; script 0,6–0,8 s | script 1,4 s |

  - divineshop.vn nhanh vì HTML dựng sẵn ở edge, CSS 8 KB, gần như không dùng font web, ảnh LCP lấy từ CDN. Không học theo phần tag quảng cáo của họ (GTM, pixel): đó là nguồn TBT của họ.
  - Script tốn CPU nhất: `B0PXqnjO.js` (React DOM, 219 KB) hydrate cả trang 1.708 phần tử, tác vụ dài 250–373 ms; `D08gD7ru.js` (GSAP và ScrollSmoother, 135 KB) khởi động ngay lúc tải.
- **Việc làm:**
  - **Font** (chuyển từ T41b): chỉ preload tối đa 2 file (bộ chữ tiếng Việt của font thân bài và font tiêu đề); chỉ giữ bộ chữ latin và tiếng Việt; bỏ độ đậm không dùng. Hiện trang chủ preload 20 file, tải 26 file.
  - **Icon font:** `bexon-icons` đổi sang woff2 với `font-display: swap` (hiện là TTF, chặn chữ 130–160 ms). Việc cắt chỉ còn biểu tượng dùng tới vẫn ở T41a.
  - **Hiệu ứng khởi động sau:** GSAP, ScrollSmoother, wow và SplitText khởi động khi trình duyệt rảnh, sau lần vẽ đầu, thay vì lúc tải. Giữ toàn bộ hiệu ứng (quyết định của chủ dự án), chỉ bắt đầu muộn hơn. Tách chữ chỉ áp cho tiêu đề ở màn hình đầu, hoặc tách theo từ thay vì từng ký tự, để bớt số phần tử có hoạt ảnh.
  - **Ảnh tĩnh:**
    - `/images`, `/brand` đặt tên theo mã băm nội dung để giữ bộ đệm 1 năm (`immutable`), thay cho 1 ngày.
    - Nén lại ảnh hoa văn và logo (Lighthouse ước tiết kiệm 260–360 KB).
    - `srcSet` của khung hero thêm bản 640 cho điện thoại.

**Kết quả 04/11/2026:** xong, đã deploy `v2.` (phiên bản `9a3276ed`).
- **Sửa 18/11/2026 (hiệu ứng lúc có lúc không):** khối `.wow` bị CSS ẩn (độ mờ 0) từ lần vẽ đầu, nhưng wow.js chỉ chạy sau khi trang hydrate. Giả lập CPU chậm 4 lần và 4G chậm, wow.js bắt đầu sau 4–6 s; trong lúc đó khối dưới màn hình trắng, và không có script thì trắng mãi. Nay `ClientWrapper` đặt lớp `tlhp-wow` lên `<html>` ngay trước khi chạy wow.js, và CSS chỉ ẩn khối khi có lớp này (`_theme.scss`); wow.js lỗi thì gỡ lớp. Máy bật "giảm chuyển động" vẫn chạy bản nhẹ (nguyên nhân thứ hai của hiện tượng; không đổi). Đánh đổi: trang chủ có một khối trên màn hình đầu (`.circle-text-wrap` ở desktop, `.tlhp-hero-bar` ở điện thoại) hiện sẵn rồi mới chạy hiệu ứng, nên có thể chớp một lần. Test `scroll reveals never leave blank blocks` (3 test, `motion-guard.spec.ts`): 2 test đỏ trên bản cũ ở `v2.` (12 khối trắng), xanh trên bản dựng cục bộ; toàn bộ `motion-guard` 120 qua. Đã deploy `v2.` 18/11 (phiên bản Worker `ff37eb4e`, dựng từ worktree sạch ở `b928e3f`, nội dung D1); 3 test mới xanh trên `v2.`.
- **Font:**
  - Tự host Noto Serif và Be Vietnam Pro (`assets/css/fonts.css`, file chép từ bản next/font đã tải về), chỉ bộ chữ latin và vietnamese; bỏ `next/font`.
  - Nguyên nhân chính của 719 KB: CSS của Google khai báo latin-ext sau vietnamese, nên với ă đ ơ ư ĩ ũ trình duyệt lấy file latin-ext (Noto Serif 182–231 KB) thay cho file vietnamese (14–18 KB). Be Vietnam Pro bị cùng lỗi ở cả 4 độ đậm.
  - Bỏ kiểu nghiêng của Be Vietnam Pro (site không dùng); Noto Serif là font biến thiên, một file cho 400–700.
  - Font dự phòng giữ đúng số đo next/font đã tính (`size-adjust`…), nên chữ không nhảy khi font về.
  - Trang chủ: 27 file, 719 KB, 20 preload → 13 file, khoảng 200 KB, 10 preload (khoảng 121 KB). Tên file có mã băm trong `_next/static`, bộ đệm 1 năm.
- **Khác mô tả: preload 10 file chứ không phải 2.** Chỉ preload 2 file thì các độ đậm 500/600 và bộ chữ vietnamese về sau lần vẽ đầu, đẩy thanh chọn tháng ở trang lịch rộng 403 → 413 px (CLS 0,00016; test xô lệch bố cục bắt được). Nay preload mọi kiểu chữ thường của hai font, latin và vietnamese, bằng `import.meta.glob`; không preload chữ nghiêng.
- **Khác mô tả: ngân sách font 200 KB chứ không phải 150 KB.** Trang dùng 4 độ đậm Be Vietnam Pro và Noto Serif thường lẫn nghiêng. Xuống 150 KB phải bỏ một độ đậm đang dùng, tức đổi giao diện.
- **Icon font:** `bexon-icons` đổi sang woff2 (18 → 10 KB, dùng fontTools), bỏ eot/ttf/svg. Vẫn để `font-display: block`: với `swap`, icon hiện trước bằng font dự phòng ở cỡ khác rồi làm trang nhảy khi font về (test xô lệch bố cục bắt được).
- **Hiệu ứng:**
  - Đo trước (điện thoại, CPU chậm 4 lần): khởi động hiệu ứng là một tác vụ 1.484–1.789 ms; tắt hiệu ứng (giảm chuyển động) thì tác vụ dài nhất 466–507 ms. Khởi động lúc trình duyệt rảnh cũng không giảm TBT, vì tác vụ dài vẫn bị tính.
  - `ClientWrapper` nay chạy mỗi hiệu ứng trong một tác vụ riêng, cùng thứ tự, nhường luồng chính giữa các bước (`scheduler.yield` hoặc `setTimeout`). `contextSafe` giữ mọi thứ trong context, nên rời trang vẫn gỡ được. Mỗi bước có `performance.measure("effect …")` để xem trong tab Performance.
  - Hai bước nặng nhất chuyển sang chạy khi khối tới cách màn hình 200 px: `titleAnim2` (SplitText tách mọi tiêu đề `.text-anim` thành từng ký tự, 892 ms) và `tjLeftSwipeAnimation` (242 ms). Tiêu đề vẫn ẩn bằng CSS cho tới lúc đó, nên không chớp. Kiểm bằng cách cuộn hết trang chủ: 7/7 tiêu đề tách và hiện đủ, 4/4 thẻ Chư Tôn Đức hiện đủ.
  - Tổng thời gian chặn ở trang chủ (cục bộ, CPU chậm 4 lần): 1.741–1.928 → 835–942 ms. Tác vụ dài nhất còn lại (423–495 ms) cũng có khi tắt hiệu ứng: đó là React hydrate, việc của T41a.
- **Ảnh tĩnh:** hai ảnh hoa văn 45 → 22 KB (làm tròn kênh alpha theo bước 3; độ đục đổi tối đa 1/255).
- **Chưa làm:**
  - Đặt tên ảnh `/images`, `/brand` theo mã băm để giữ bộ đệm 1 năm: phải sửa mọi đường dẫn trong SCSS, config và component, mà chỉ có lợi cho lần vào sau, không đổi điểm Lighthouse. Để cùng T41a.
  - Bản 640 cho khung hero: khung đầu là ảnh của site đã có bản dọc 760 px cho điện thoại; các khung sau tải lười, không ảnh hưởng LCP.
- **Lighthouse 13.6 điện thoại trên `v2.`** (trước: 2 lượt; sau: 3 lượt):

  | Trang | Điểm | LCP | TBT | Font | Tổng tải |
  |---|---|---|---|---|---|
  | Trang chủ | 53–70 → 71–74 | 6,3–8,7 → 4,9–5,0 s | 163–500 → 132–181 ms | 722 → 201 KB | 1.882 → 1.357 KB |
  | `/dong-chay-hoang-phap` | – → 78–87 | 3,6–4,5 s | 12–63 ms | 201 KB | 974 KB |
  | Bài "Cộng tu pháp hội niệm Phật tháng 7…" | – → 71–85 | 3,6–5,4 s | 6–148 ms | 201 KB | 938 KB |

  - TTFB trong các lượt sau: 136–2.010 ms (Worker khởi động nguội). Đó là phần lớn của LCP còn lại, việc của T41e.
  - PageSpeed Insights chưa đo lại được: API hết hạn mức trong ngày, trang web đứng ở "Running analysis".

**Tiêu chí nghiệm thu:**
- [x] Trang chủ chỉ preload kiểu chữ thường (10 file, khoảng 121 KB, thay cho 20 file); tổng font tải ≤ 200 KB (đổi từ "tối đa 2 file, ≤ 150 KB", lý do ở trên)
- [x] Hiệu ứng không còn khởi động trong một tác vụ dài; hiệu ứng vẫn chạy (test canh gác hiệu ứng xanh; tiêu đề và thẻ hiện đủ khi cuộn)
- [ ] Ảnh tĩnh có `Cache-Control` 1 năm, tên có mã băm (chưa làm, chuyển sang T41a). Font đã có
- [x] Lighthouse điện thoại 3 trang ghi số trước–sau. PageSpeed Insights chưa đo lại được (hạn mức trong ngày)

**Kiểm chứng:**
- [x] `npm run test:e2e -- performance` (mới): đỏ trên bản cũ ở `v2.` (20 preload; tác vụ 1.595 ms), xanh sau khi sửa
- [x] Unit 156 xanh; `tsc`, eslint không lỗi
- [x] Toàn bộ e2e:
  - Trên `v2.` 488/488 (28 bỏ qua theo thiết kế).
  - Cục bộ: các bộ bị ảnh hưởng xanh. Test xô lệch bố cục ở trang chủ thỉnh thoảng hỏng khi máy chạy song song nặng (CLS 0,000013, font chữ về sau lần vẽ đầu, đúng trường hợp test đã ghi chú và cho chạy lại 2 lần); chạy tuần tự 16/16.
  - Test tách chữ ở styleguide nay lăn chuột tới tiêu đề trước khi kiểm.

**Phụ thuộc:** T41d. Cần xong trước T22.

**File:** `src/app/layout.js`, `src/app/assets/css/fonts.css`, `src/app/assets/fonts/tlhp/*`, `src/app/assets/css/bexon-icons.css`, `src/components/shared/wrappers/ClientWrapper.js`, `src/libs/titleAnim2.js`, `src/libs/tjLeftSwipeAnimation.js`, `public/images/shape/pattern-*.webp`, `tests/e2e/performance.spec.ts`

**Quy mô:** M

---

### T41a: Gọn CSS, icon font và bớt phần phải hydrate (đợt 2 tối ưu hiệu suất)

**Mô tả:** Kéo lên trước T22 ngày 04/11 (trước đây xếp sau Checkpoint E), vì CSS chặn hiển thị là đòn bẩy lớn nhất của LCP trên điện thoại (mốc đo ở T41f). Không đổi giao diện.

- **CSS:**
  - Thay `bootstrap.min.css` bằng import SCSS Bootstrap theo module thực dùng; xóa partial SCSS không còn phần tử nào dùng.
  - Inline phần CSS của màn hình đầu và nạp phần còn lại sau.
  - Lighthouse báo 177 KB CSS không dùng, ước tiết kiệm 0,7–1,5 s chặn hiển thị. Style & Layout đang tốn 1,1–1,3 s.
- **Icon font:** cắt `font-awesome-pro` / `bexon-icons` chỉ còn biểu tượng dùng tới.
- **Ảnh tĩnh** (chuyển từ T41f): `/images`, `/brand` đặt tên theo mã băm (import qua Vite hoặc đổi tên khi thay file) để giữ bộ đệm 1 năm thay cho 1 ngày.
- **JavaScript:**
  - Xóa hàm hiệu ứng GSAP không còn phần tử nào dùng.
  - Swiper, Chart.js, glightbox, odometer và GSAP chỉ nạp ở trang cần, và nạp sau khi trang rảnh nếu hiệu ứng không nằm ở màn hình đầu. Giữ toàn bộ hiệu ứng Bexon (quyết định của chủ dự án).
- **Bớt phần phải hydrate:**
  - Khối nào không cần tương tác thì chuyển thành server component.
  - Menu điện thoại và header dính nhân đôi chỉ dựng khi cần.
  - React DOM hiện hydrate cả trang 1.708 phần tử; dữ liệu nhúng trong HTML thu gọn cùng T41e.
  - Sau T41f, tác vụ dài nhất ở trang chủ là React hydrate: 423–495 ms trên điện thoại CPU chậm 4 lần (có cả khi tắt hiệu ứng).
- **Mốc đo 04/11/2026** (trang chủ `v2.`, desktop, so với divineshop.vn):
  - CSS: 198 KB br / 1,08 MB chưa nén, thêm 41 KB style nhúng. divineshop: 7,7 KB br.
  - JS: khoảng 306 KB br / 895 KB chưa nén, có một tác vụ dài 356 ms. divineshop: khoảng 100 KB br.

**Kết quả 05/11/2026:** xong phần lớn, đã deploy `v2.` (phiên bản `090e8557`).
- **CSS: 1,11 MB / 141 KB br → 430 KB / 50 KB br** (bản build).
  - `font-awesome-pro.min.css` (512 KB, hơn nửa CSS) thay bằng `assets/css/fa-brands.css`: chỉ `fa-brands` và 6 icon mạng xã hội có trong code. `site.social` đang rỗng, nên font brands không tải ở trang nào.
  - Bỏ `nice-select2.css` và `meanmenu.css`: không component nào dùng.
  - `postcss.config.mjs`: PurgeCSS chỉ chạy trên `bootstrap.min.css` và `animate.min.css`, có danh sách giữ lại các class do Bootstrap JS và wow.js thêm lúc chạy, cùng các thẻ HTML trong nội dung bài.
  - SCSS của Bexon/TLHP không lọc: nhiều class ghép lúc chạy (`is-${…}`, `tlhp-theme-${…}`) mà quét mã nguồn không thấy.
  - **Khác mô tả:** không thay `bootstrap.min.css` bằng module SCSS. Lọc file có sẵn cho kết quả tương đương mà ít đụng mã hơn.
- **So ảnh:** `tests/e2e/visual.spec.ts` (mới, chạy khi đặt `VISUAL=1`, ảnh không vào git). 7 mẫu trang × 2 cỡ màn hình chụp từ bản trước rồi so với bản sau: **14/14 giống**.
  - Ảnh nội dung được che, chỉ so bố cục và kiểu dáng.
  - Ảnh không khai báo kích thước được cho tải trước khi chụp, vì khi chưa tải chúng rộng 0 px.
- **JS ban đầu của trang chủ: khoảng 235 → 175 KB br.**
  - `ErrorPrimary` (trong ranh giới lỗi, mọi trang đều nạp) dùng `next/image`, kéo shim 45 KB / 13 KB br vào mọi trang. Nay là `<img>` thường.
  - GSAP (47 KB br) và các hiệu ứng chuyển sang `libs/pageEffects.js`, được `ClientWrapper` nạp bằng `import()` sau khi trang lên, và không bao giờ nạp khi bật giảm chuyển động. `libs/smoother.ts` giữ ScrollSmoother hiện tại, để `revealTarget` và `ListStatus` không phải import GSAP.
  - Lighthouse vẫn đếm GSAP trong tổng JS tải về (trang chủ 322 → 307 KB), vì người xem không tắt hiệu ứng vẫn tải nó, chỉ là muộn hơn.
- **Bớt phần phải hydrate:**
  - Header dính (103 phần tử) dựng khi trình duyệt rảnh, hoặc khi đã cuộn 300 px (nó hiện từ 500 px).
  - Mỗi menu điện thoại (2 × 69 phần tử) dựng ở lần mở đầu tiên. Menu mở ở khung hình sau đó để hiệu ứng trượt vẫn chạy; `aria-controls` chỉ gắn khi menu đã có trong trang.
  - DOM lúc mở trang: trang chủ 1.758 → 1.515, danh sách 789 → 546, lịch 1.153 → 910.
  - Khối không cần tương tác ở trang chủ vốn đã là server component; bốn khối còn lại cần Swiper.
- **Lighthouse 13.6 điện thoại:**
  - Trên `v2.` (T41f 3 lượt, T41a 7 lượt) không so trung vị được: các lượt chia hai nhóm theo TTFB. Khi Worker nguội (TTFB 0,6–1,2 s), FCP 1,3–2,1 s và LCP 2,8–4,7 s, tốt hơn T41f. Khi TTFB nhanh (0,23–0,42 s), lần vẽ đầu chờ JS và hydrate, khoảng 1,8 s, nên FCP 2,7–3,3 s. Cả 3 lượt T41f đều rơi vào nhóm nguội.
  - So cùng điều kiện (hai bản chạy cục bộ, xen kẽ, mỗi trang 5 lượt; chưa nén nên số tuyệt đối cao hơn thực tế):

    | Trang | Điểm | FCP | LCP | TBT |
    |---|---|---|---|---|
    | Trang chủ | 53 → 58 | 7,3 → 4,0 s | 17,3 → 13,2 s | 248 → 177 ms |
    | `/dong-chay-hoang-phap` | 59 → 57 (56–59 → 57–68) | 6,8 → 6,6 s | 16,4 → 11,3 s | 5 → 0 ms |

  - Ở trang danh sách, Speed Index tệ hơn (6,8 → 8,0 s); chưa rõ nguyên nhân.
  - CSS tải về trên `v2.` ở mọi trang: 199 → 69 KB. TBT trang danh sách và trang bài về 0.
  - PageSpeed Insights chưa đo lại được: API hết hạn mức (khóa ẩn danh dùng chung).
- **Chưa làm:**
  - **CSS màn hình đầu đặt thẳng vào HTML:** CSS vẫn là một file 50 KB br chặn hiển thị.
  - **Tác vụ dài lúc tải:** React hydrate cả trang, 390–500 ms trên điện thoại CPU chậm 4 lần. Thu gọn dữ liệu nhúng trong HTML (T41e) là bước tiếp theo.
  - **Ảnh tĩnh tên có mã băm.**
  - **Cắt `bexon-icons` theo icon dùng tới:** file chỉ còn 10 KB, lợi ích nhỏ.
- **Ghi chú test:**
  - Test tách chữ ở styleguide giữ nguyên.
  - Trên `v2.` có 2 test chập chờn khi bộ test chạy dài (dấu tiếng Việt ở styleguide, không có hộp thoại ở một trang bài); chạy lại riêng 39/39 qua.
  - Cục bộ, test "ô tìm kiếm trong menu điện thoại" hỏng một lần vì bấm trước khi trang hydrate xong; chạy riêng 12/12 qua.

**Tiêu chí nghiệm thu:**
- [x] Trang chủ: CSS ≤ 60 KB br (50 KB), JS ban đầu ≤ 180 KB br (175 KB)
- [ ] Không tác vụ dài nào trên 200 ms lúc tải: chưa đạt (React hydrate 390–500 ms trên điện thoại CPU chậm 4 lần)
- [ ] Không còn CSS chặn hiển thị quá 20 KB ở màn hình đầu: chưa làm
- [x] Ảnh chụp 7 mẫu trang trước–sau không khác nhau (14/14)
- [x] Mọi biểu tượng đang dùng vẫn hiển thị (`bexon-icons` giữ nguyên; Font Awesome còn bộ brands)

**Kiểm chứng:**
- [x] `npm run build` ghi dung lượng; `VISUAL=1 npm run test:e2e -- visual`
- [x] Unit 156 xanh; `tsc`, eslint không lỗi
- [x] Toàn bộ e2e: cục bộ 481/482; trên `v2.` 485 qua, 2 hỏng và 1 chập chờn khi chạy dài (chạy lại riêng đều qua)
- [x] Lighthouse 13.6 điện thoại trên `v2.` và so cục bộ cùng điều kiện (số ở trên). PageSpeed Insights chưa đo lại được

**Phụ thuộc:** T41f (làm sau để đo riêng từng đợt). Cần xong trước T22.

**File:** `postcss.config.mjs`, `src/app/layout.js`, `src/app/assets/css/fa-brands.css`, `src/components/sections/error/ErrorPrimary.js`, `src/components/shared/wrappers/ClientWrapper.js`, `src/libs/pageEffects.js`, `src/libs/smoother.ts`, `src/libs/reveal.ts`, `src/libs/initSmoothScroller.js`, `src/components/sections/posts/ListStatus.tsx`, `src/components/layout/header/Header.js`, `tests/e2e/visual.spec.ts`

**Quy mô:** L

---

### T41e: Cache HTML và RSC ở edge

**Mô tả:** Thêm ngày 04/11, sau khi so với divineshop.vn (Gatsby, HTML dựng sẵn, TTFB khoảng 150 ms). Trang công khai chỉ đổi khi dữ liệu đổi, nhưng hiện mỗi lượt xem đều dựng lại trang.

- **Mốc đo 04/11/2026** (trang chủ `v2.`, desktop, không giả lập mạng chậm, mỗi số một lượt đo):
  - HTML trả `Cache-Control: private, no-cache, no-store`; TTFB dao động 0,35–2,7 s, có lẽ vì Worker khởi động nguội.
  - Mỗi lượt xem kéo thêm 11 lần dựng RSC để tải trước liên kết (đã ghi ở T19a). Đây là phần tốn CPU Worker lớn nhất trên gói Free (Câu hỏi mở #8).
  - divineshop.vn cùng lúc: TTFB 147 ms, HTML 23 KB (của mình 251 KB chưa nén).
- **Việc làm:**
  - Route công khai khai báo `revalidate` (cùng chu kỳ 5 phút của T19). vinext khi đó sinh `s-maxage=…, stale-while-revalidate`.
  - Kiểm cơ chế cache thật trên Workers: phản hồi của Worker không tự vào cache CDN. Chọn giữa bộ đệm ISR của vinext (KV, T19 đã định bật) và Cache API trong Worker. Đo cả hai nếu chưa rõ.
  - Payload RSC dùng đường dẫn riêng (`.rsc`), nên khóa cache không lẫn với HTML. Kiểm lại bằng test trước khi bật.
  - Không cache khi phản hồi phụ thuộc người xem (cookie, `/van-hanh/*`, `/admin*`), và không cache lỗi 5xx.
  - Nút "Làm mới site" (T19) phải xóa cả bản cache ở edge, không chỉ dữ liệu.
  - Nếu cache RSC đã bật thì giữ tải trước liên kết. Nếu chưa, chỉ tải trước khi rê chuột cho liên kết ở menu và footer.
  - Thu gọn dữ liệu nhúng trong HTML: client component chỉ nhận các trường nó dùng.
  - Từ T41a: khi HTML về nhanh, lần vẽ đầu chờ JS và hydrate (khoảng 1,8 s trên điện thoại giả lập); tác vụ hydrate 390–500 ms. Thu gọn dữ liệu nhúng là cách giảm cả hai. CSS màn hình đầu đặt vào HTML và ảnh tĩnh tên có mã băm cũng chưa làm ở T41a.

**Kết quả 05/11/2026** (đo lại 10/11): phần cache đã xong và deploy `v2.` (phiên bản `9dcc5ee5`, vẫn là bản đang chạy). Làm trước T19, vì cơ chế cache của vinext không cần KV: nguồn dữ liệu vẫn là snapshot trong kho.
- **Cơ chế:** `vinext({ cache: { cdn: workersCacheCdnAdapter() } })` và `createWorkersCacheConfig()` trong `cloudflare.config.ts` (đã có trong `@vinext/cloudflare`, không phải viết Worker bọc ngoài).
  - Cloudflare Workers Cache chỉ bật cho entrypoint `VinextCachedResponse`; entrypoint mặc định vẫn chạy định tuyến ở mọi yêu cầu rồi chuyển sang entrypoint có cache. Lượt trúng cache không chạy mã ứng dụng.
  - Khóa cache có mã băm của bản build, nên mỗi lần deploy là một bộ cache mới (kiểm: lượt đầu sau deploy là `MISS`).
  - Trình duyệt vẫn nhận `Cache-Control: private, max-age=0, must-revalidate`: không giữ trang. Chỉ edge giữ.
- **Việc làm:**
  - Trang chủ: `revalidate = 300` thay cho `dynamic = "force-dynamic"`. Đếm ngược ngày có thể trễ tối đa 5 phút, và test trang chủ nay kiểm điều này thay cho "không bao giờ cache".
  - 7 route công khai khai báo `revalidate = 300`: Giới thiệu, Tông Chỉ, Vũ Trụ (mỗi loại gồm trang nhóm và trang bài), Dòng Chảy (trang bài). Trang có `[slug]` thêm `generateStaticParams` trả mảng rỗng, nếu không vinext coi là trang động và trả `no-store`.
  - Dữ liệu nhúng cho slider tin tức: `NewsCard` chỉ gồm các trường thẻ dùng (bỏ `summary`, `subtitle`, `author`, `banner`, `galleryCount`; `thumbnail` lấy bìa nếu thiếu).
- **Đo (10/11, `v2.`, 20 lượt mỗi mẫu trang, TTFB phía máy chủ = bỏ thời gian bắt tay TLS):**

  | Trang | p50 | p75 | p90 | Cache |
  |---|---|---|---|---|
  | Trang chủ | 87 ms | 105 ms | 131 ms | HIT |
  | Bài Dòng Chảy | 83 ms | 102 ms | 125 ms | HIT |
  | Bài Giới thiệu | 83 ms | 92 ms | 99 ms | HIT |
  | Bài Tông Chỉ | 81 ms | 87 ms | 94 ms | HIT |
  | Khu vực Vũ Trụ | 81 ms | 86 ms | 92 ms | HIT |
  | Danh sách Dòng Chảy | 110 ms | 118 ms | 122 ms | BYPASS |
  | Lịch tu học | 109 ms | 127 ms | 136 ms | BYPASS |

  - Trước T41e: 0,35–2,7 s, hay vượt 1 s khi Worker khởi động nguội. Lượt đầu tiên sau mỗi 5 phút vẫn là `MISS` (0,6–1,3 s).
  - Payload RSC của trang bài cũng `HIT` (`/gioi-thieu/…?_rsc=…` 94 s tuổi, 0,2 s đầu-cuối). Yêu cầu RSC cần đúng mã `_rsc`; không có thì nhận 307.
  - Danh sách và lịch đọc tham số truy vấn nên vẫn `BYPASS`; ở trạng thái Worker nóng TTFB vẫn khoảng 110–127 ms, nhưng chi phí dựng khi nguội còn nguyên.
  - Mã 404 của slug không tồn tại cũng được cache 5 phút (`MISS` rồi `HIT`).
- **Lighthouse 13.6 điện thoại trên `v2.`: không đổi điểm, vì lab đã chạy khi Worker nóng:**
  - T41a (7 lượt) → T41e (5 lượt), trang chủ: TTFB 168 → 85 ms; điểm 64 → 63; LCP 6,3 → 6,4 s.
  - Đo lại 10/11 (3 lượt, cùng bản): điểm 80–85, FCP mô phỏng khoảng 2,0 s (quan sát 0,7 s), LCP 3,5–4,5 s.
  - Chênh giữa hai lượt đo (59–64 và 80–85) lớn hơn mọi cải thiện của một đợt, nên điểm lab một mình không đủ để kết luận về T41e; xem TTFB thật ở bảng trên.
- **CPU Worker (telemetry 20 phút sau deploy, gồm cả các lượt e2e và Lighthouse):** 1.187 lượt chạy `ok`, trung vị 9 ms, p90 47 ms; entrypoint dựng trang (`VinextCachedResponse`, tức lượt `MISS`) 192 lượt, trung vị 20 ms, p90 188 ms. Chưa có số cùng điều kiện từ trước T41e để so, nên chưa đánh dấu tiêu chí CPU.
- **Chưa làm:**
  - **"Làm mới site":** `/van-hanh/lam-moi` thuộc T19, chưa có. Khi làm phải xóa cả bản cache ở edge (`revalidatePath` hoặc `ctx.cache.purge`). Hiện dữ liệu chỉ đổi khi deploy, và mỗi deploy là bộ cache mới.
  - **Trang có tham số truy vấn** (danh sách Dòng Chảy, lịch, Bảo Tượng Phật Giáo) chưa vào cache.
  - **HTML trang chủ 207 → 201 KB chưa nén** (đích ≤ 120 KB). Phần lớn là payload RSC (khoảng 106 KB, dòng lớn nhất là khối tin tức 9,5 KB, rồi header, vòng Lời Thầy dạy, các khối server). Muốn giảm tiếp phải chuyển khối nào chỉ hiển thị sang không nhúng dữ liệu hai lần.
  - **Chi phí yêu cầu trên gói Workers Free:** tài liệu Workers Cache ghi khi bật cache mọi yêu cầu tới Worker đều tính theo giá yêu cầu chuẩn, kể cả yêu cầu giữa các entrypoint. Chưa kiểm một lượt xem trang tính 1 hay 2 yêu cầu so với hạn mức 100.000 yêu cầu mỗi ngày; cần biết trước T22 (Câu hỏi mở #8).
  - Tải trước liên kết (RSC) vẫn bật: với trang có `revalidate` nó nay phục vụ từ cache.

**Tiêu chí nghiệm thu:**
- [x] Trang công khai lượt thứ hai trở đi: TTFB p75 ≤ 200 ms (86–105 ms ở 5 mẫu có cache; 118–127 ms ở 2 mẫu chưa cache)
- [ ] CPU Worker trung vị mỗi lượt xem trang chủ giảm so với mốc T19a: chưa có số trước cùng điều kiện (số sau ở trên)
- [ ] Sửa bài ở admin cũ rồi bấm "Làm mới site": chờ T19
- [ ] Trang có cookie phiên, `/van-hanh/*`, `/admin*` và lỗi 5xx không bao giờ được cache: test mới chỉ kiểm `/van-hanh/lam-moi`, một trang 404 cấp cao nhất và `/anh-goc/` với bucket lạ; chưa kiểm cookie và 5xx
- [ ] HTML trang chủ ≤ 120 KB chưa nén: chưa đạt (201 KB)

**Kiểm chứng:**
- [x] `npm run test:e2e -- edge-cache` (mới): 5 trang `HIT` ở lượt hai, payload RSC khác HTML, trang không công khai không `HIT`. Đỏ trên bản cũ (5/7), xanh sau khi deploy; bỏ qua khi chạy cục bộ và ở chế độ điện thoại
- [x] Unit 156 xanh; `tsc`, eslint không lỗi
- [x] Toàn bộ e2e trên `v2.`: 495/495 (49 bỏ qua theo thiết kế). Cục bộ các bộ chính 148/148, một test xô lệch bố cục chập chờn như đã ghi
- [x] Workers telemetry sau deploy (số ở trên); Lighthouse điện thoại ở mốc T41c

**Phụ thuộc:** T19 (ISR, bộ đệm KV, nút làm mới). Cần xong trước T22.

**File:** `cloudflare.config.ts`, `vite.config.ts`, `src/app/(home)/page.tsx`, `src/app/(site)/{dong-chay-hoang-phap,gioi-thieu,tong-chi-tu-hoc,vu-tru-phat-giao}/**/page.tsx`, `src/libs/home.ts`, `src/components/sections/blogs/Blogs2.js`, `src/components/shared/cards/BlogCard2.js`, `tests/e2e/edge-cache.spec.ts`, `tests/e2e/home.spec.ts`

**Quy mô:** M

---

### T22: Kiểm thử trước ra mắt và chuyển `www`

**Mô tả:** Trên `v2.` với `CONTENT_SOURCE=b2`: lập danh sách mọi URL công khai từ dữ liệu (bài, tông chỉ, giới thiệu, khu vực, bảo tượng, trí tuệ) và kiểm từng URL trả 200; Lighthouse 6 mẫu trang; axe mọi mẫu trang; Ban Biên Tập soát 20 trang tiêu biểu. Trên app mới: `/admin*` và `/login` chuyển hướng sang `quantri.`. Gỡ route `www…/api/*` của Worker `tlhp-admin-guard` (T21) trước khi chuyển. Chuyển: gắn Workers Custom Domain `www.tunglamhoaphuc.com` (và tên miền gốc chuyển về `www`) cho Worker `tlhp-web`, gỡ bản ghi trỏ về Vercel. Ghi sẵn và diễn tập các bước quay lại Vercel. Theo dõi 48 giờ: log Worker, tỷ lệ 404, Web Analytics.

**Tiến độ 17/11/2026: phần mã và tài liệu xong, chưa chuyển** (còn chờ T19 khóa B2, T21 phần 2, duyệt của Ban Trị Sự). Điều kiện và các bước ở [docs/van-hanh/chuyen-www.md](../docs/van-hanh/chuyen-www.md); các bước chuyển và quay lại ghi theo cấu hình hiện có nhưng **chưa diễn tập**.
- `npm run check:urls -- --base=… [--write=…]` (`scripts/check-urls.ts`): lấy danh sách từ sitemap (dựng từ dữ liệu), kiểm từng địa chỉ trả 200 và có `h1`, thử lại khi 5xx, thoát mã 1 nếu có lỗi. Kết quả: **811/811** trên bản build và trên `v2.`; danh sách lưu ở `docs/van-hanh/url-cong-khai.txt`.
- `/admin`, `/login`, `/van-hanh` (và đường con) chuyển 307 sang `quantri.` chỉ trên host công khai (`next.config.js`); `tunglamhoaphuc.com` chuyển 308 sang `www`. Đã đo: vinext làm mất chuỗi truy vấn khi chuyển sang tên miền khác, nên tên miền gốc nên dùng Redirect Rule của Cloudflare (ghi trong tài liệu).
- `smoke.spec.ts` theo host: trên `www` không noindex, các trang chính 200, địa chỉ admin cũ chuyển sang `quantri.` (cục bộ giả lập bằng Host).

**Tiêu chí nghiệm thu:**
- [x] 100% URL công khai từ dữ liệu trả 200 trên `v2.` trước khi chuyển (danh sách lưu trong repo) (811/811, `docs/van-hanh/url-cong-khai.txt`; lặp lại bằng nguồn B2 khi có khóa)
- [ ] Sau khi chuyển, e2e smoke xanh trên `https://www.tunglamhoaphuc.com`; `www/admin` chuyển sang `quantri.`
- [ ] Các bước quay lại Vercel đã diễn tập, thực hiện được trong ≤ 15 phút

**Kiểm chứng:**
- [x] `npm run check:urls -- --base=https://v2.tunglamhoaphuc.com`
- [ ] `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke`

**Phụ thuộc:** T19, T20, T21, T41d (ảnh đúng cỡ trước khi khách thật vào), T41f và T41a (font, hiệu ứng, CSS), T41e (cache HTML ở edge)

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

**Kết quả 17/11/2026:** schema, migration và script nhập xong, chạy được trên SQLite thật và trên D1 mô phỏng cục bộ; chưa đụng D1 thật (chưa tạo D1 production, đó là việc của T25/T39 và cần tài khoản Cloudflare của chủ site). Chi tiết vận hành ở [docs/van-hanh/d1.md](../docs/van-hanh/d1.md).
- **Số bản ghi khớp nguồn:** 632 bài · 25 Tông Chỉ · 6 Giới thiệu (25 mốc niên biểu) · 14 khu vực · 126 tượng · 91 Danh Tăng · 15 sự kiện · 3 chương trình · 12 chủ đề tháng (cộng 19 cụm tượng, 29 nhóm, 554 album với 21.102 ảnh, 12 ảnh pháp ngữ).
- **Chạy lại cho cùng kết quả:** upsert theo id của admin cũ, dòng nguồn đã bỏ bị xóa, bảng của site và admin (`page_view`, `registration`, `user`, `audit_log`, `setting`, `notice`, `redirect`) không bao giờ bị đụng; cột admin sửa sau nhập (`area.visible`, `calendar_event.registration_open`…) giữ nguyên khi nhập lại. Test: băm toàn bộ bảng sau 1 và 3 lần nhập bằng nhau, cả với dữ liệu thật.
- **Khóa ngoại thay tên lặp:** tượng trỏ khu vực (`area_id`, theo bảng mã trong `config/vuTru.ts`; chỉ "cong_thap" không có khu vực), cụm tượng (`statue_cluster`) và chúng hội (`category` loại `assembly`); không còn cột tên lặp. `PRAGMA foreign_key_check` sạch.
- **Ảnh lưu bằng khóa:** mỗi ảnh một dòng `media` (id băm từ địa chỉ, nên ảnh dùng nhiều nơi chỉ một dòng): 21.452 dòng, 20.340 ảnh B2 chỉ có `r2_key` (khóa trên B2, cũng là khóa sẽ dùng khi chép sang R2), 1.112 ảnh WordPress còn `url`. Tên miền phía trước là một chỗ đổi (`MEDIA_BASE`).
- **Khác mô tả / khác đặc tả 3.1, có chủ ý:**
  - Khóa chính là chuỗi (id admin cũ đã dùng: `post-1060`, `khuong-viet`), không phải số nguyên: nhập lại trúng đúng dòng cũ, địa chỉ và số liệu cũ vẫn đúng.
  - Khối nhỏ sửa chung một lần (từ khóa, khối video, sách, giờ của sự kiện, trích dẫn) là cột json; thứ nhiều dòng cùng trỏ tới là bảng. Danh Tăng chưa có trang nào đọc, nên `Monk` mới chỉ có bảng và bộ đọc (`libs/content/monks.ts`).
  - Snapshot chưa có Danh Tăng: thêm `danh-tang.json` vào `npm run snapshot:fetch` (cùng đường GET của admin cũ như các tệp khác).
  - 631 bài ra từ bộ đọc của site vì bài `post-1045` trùng slug với `post-29713` (site chỉ phục vụ bài đầu): D1 giữ cả 632, `slug` không duy nhất; ai sửa slug trong admin mới thì bài đó mở được.
  - Chưa có `StatueRelation`, `Series`, `Publication`, `AiConversation` (không có dữ liệu nguồn hoặc không thuộc T23); `StatueRelation` đến cùng T37.
- **Giới hạn D1 đã tính:** một câu lệnh ≤ 100 KB. Một tượng (TP0083) có bài 155 KB nên ghi theo từng đoạn 40 KB (câu đầu chèn dòng, các câu sau nối thêm vào cột chữ dài nhất); câu dài nhất sau khi cắt 79,6 KB. 1.799 câu lệnh, file `.sql` khoảng 9 MB.
- **Chưa thử:** nhập vào D1 thật (cần D1 production); `cf d1 query --local` không có tương đương cục bộ nên kiểm D1 mô phỏng bằng chính file SQLite của nó.

**Mô tả:** Schema Drizzle theo mô hình đặc tả 3.1 (thêm `Monk` cho Danh Tăng): Post, Category, TeachingArticle (+ khối con), Page + Milestone, Area, Statue, StatueCluster, ArtVariation, Monk, CalendarEvent, MonthTheme, FeaturedProgram, Media, Album, PageView, Setting, Notice, User, AuditLog, Registration, Redirect. `scripts/import.ts` đọc từ nguồn `snapshot` hoặc `b2` (dùng lại bộ chuẩn hóa), lưu khóa R2 thay URL tuyệt đối, khu vực / cụm tượng chỉ lưu một nơi. Script chạy lại được nhiều lần (sẽ chạy lần cuối ở T39).

**Tiêu chí nghiệm thu:**
- [x] Chạy import nhiều lần cho cùng kết quả (idempotent) trên D1 local
- [x] Số bản ghi khớp nguồn: 632 bài · 25 Tông Chỉ · 6 Giới thiệu · 14 khu vực · 126 tượng · 91 Danh Tăng · 15 sự kiện · 3 chương trình · 12 chủ đề tháng
- [x] Khu vực và cụm tượng liên kết bằng khóa ngoại, không còn tên lặp

**Kiểm chứng:**
- [x] `cf d1 migrations apply <id> --local --persist-to <thư mục>` (chạy được, bảng tạo đủ) rồi `npm run import -- --from=snapshot --db=<file .sqlite của D1 cục bộ>`
- [x] `npm test -- import`: 8 test (7 với dữ liệu nhỏ, 1 với snapshot thật), cộng 5 test đọc Danh Tăng và bài trùng slug; eslint (0 lỗi), `tsc`, 212 test đơn vị và build sạch

**Phụ thuộc:** Checkpoint D

**File dự kiến:** `src/db/schema.ts`, `drizzle.config.ts`, `migrations/`, `scripts/import.ts`, `tests/unit/import.test.ts`

**Quy mô:** L (không tách: schema và script nhập phải kiểm cùng nhau trên cùng bộ số liệu)

---

### T24: Repository D1 và contract test

**Kết quả 17/11/2026:** phần mã và contract test xong, chạy được trên SQLite thật; **chưa nối vào Worker** (cần D1 thật, xem dưới). Hai việc còn lại ở tiêu chí.
- **Nguồn `d1`** (`src/libs/content/sources/d1.ts`): danh sách bài lấy bằng một truy vấn nhẹ (không chữ, không album), từng bài đọc đủ khi trang hỏi; Tông Chỉ, Giới thiệu, lịch, khu vực, tượng đọc nguyên bảng một lần rồi đi qua đúng mã của hai nguồn kia. Lượt xem = số cũ của admin cũ + tổng `page_view` (T25). Bài `draft` và khu vực `visible = 0` không hiện. Phần lọc, sắp xếp, phân trang tách thành `queryPosts`/`countCategories` dùng chung (`repository.ts`).
- **Contract test** (`tests/unit/content/contract.test.ts`): với snapshot thật, B2 (qua bộ đọc thật, bucket giả) và D1 (nhập vào SQLite) trả **y hệt** snapshot cho mọi câu hỏi: danh sách theo chuyên mục × 5 kiểu sắp × trang (và trang 9999, cỡ trang 0 và 5000), từng mục con, cả 631 bài đọc đủ theo slug (kể cả slug mã hóa phần trăm), lịch, Giới thiệu, 25 bài Tông Chỉ, khu vực, 126 tượng, và các câu trả lời "không có" (`null`). Bốn test riêng cho D1: cộng lượt xem, ẩn bài nháp và khu vực, slug trùng, bài sửa sau nhập.
- **Sửa lại schema T23 để D1 trả đủ như nguồn tệp** (chưa ai áp migration thật nên làm lại `0000`): thêm `teaching_article.name`, `art_variation.variation_id`, `calendar_event.position`; `post.gallery_count` giữ đúng số của admin cũ; nhóm không có slug nhưng có tên không còn mất tên.
- **Khác nguồn tệp, có chủ ý:** D1 có 632 bài, nhưng danh sách và đường dẫn chỉ cho 631 như site cũ: bài `post-1045` trùng slug với `post-29713` nằm trong D1 và ra khỏi danh sách cho tới khi admin đặt slug khác.
- **Nối với Worker:** `CONTENT_SOURCE=d1` đọc binding `DB` (`cloudflare:workers`), làm repository mới mỗi phút; thiếu binding thì báo rõ (có test). **D1 thật đã tạo** (`tlhp-db`, APAC, migration áp, đã nhập đủ 632 bài và các bảng khác, đếm lại trên D1 thật; chi tiết ở `docs/van-hanh/d1.md` mục 6) và binding `DB` đã khai báo trong `cloudflare.config.ts`, build qua. **Đã deploy `v2.`** (phiên bản Worker `a6e935fd`, 9.904 KiB, nén 1.266 KiB, khởi động 3 ms) với `CONTENT_SOURCE=d1` đặt trong `cloudflare.config.ts` (văn bản cố định; một Worker phục vụ cả `v2.` và sau T22 là `www`, nên đây là công tắc chung cho cả hai). Bản trước để lùi: `4a6620cd`.
- **Kiểm trên `v2.` đọc D1:** toàn bộ e2e (`BASE_URL=https://v2.tunglamhoaphuc.com`, máy tính và điện thoại) 620 qua, 72 bỏ qua theo thiết kế, 0 hỏng; `check:urls` 811/811. Chứng minh trang đọc D1 thật chứ không phải snapshot: đổi tiêu đề một bài trong D1, sau 70 giây trang (địa chỉ có chuỗi truy vấn lạ để tránh cache) hiện tiêu đề mới; đã trả lại tiêu đề cũ ngay sau đó.

**Mô tả:** Nguồn `d1` cho `ContentRepository`. Bộ contract test chạy chung cho cả 3 nguồn (`snapshot`, `b2`, `d1`). Cache theo tag (`cacheTag` / `revalidateTag` của vinext trên bộ đệm KV) để trang cập nhật khi admin mới lưu. Trong giai đoạn này `d1` chỉ bật trên `v2.`; `www` vẫn đọc `b2` cho tới T39.

**Tiêu chí nghiệm thu:**
- [x] Contract test xanh cho cả 3 nguồn (với snapshot thật; trên máy không có snapshot test này bỏ qua, CI có snapshot nên chạy)
- [x] Toàn bộ e2e site công khai xanh khi chạy với `CONTENT_SOURCE=d1` (620 qua trên `v2.`)
- [ ] Gọi `revalidateTag` sau khi ghi thì trang liên quan đổi ngay lần tải kế tiếp

**Kiểm chứng:**
- [x] `npm test -- contract`: 8 test; eslint (0 lỗi), `tsc`, 221 test đơn vị, build sạch
- [x] e2e đầy đủ trên `v2.` đang đọc D1 (thay cho `npm run preview` cục bộ, vì D1 thật đã có)

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

**Mô tả:** `/admin/thu-vien-anh`: cây thư mục + lưới ảnh, tìm, lọc thời gian. Tải lên kéo-thả, bắt buộc mô tả ảnh (alt). Trình duyệt tự xoay ảnh theo EXIF, bỏ metadata và nén thành một bản WebP cạnh dài ≤ 2560px (canvas, nhận ảnh gốc ≤ 25 MB), đẩy thẳng lên R2; Worker chỉ ghi bản ghi `Media` (mã băm, cỡ gốc, alt), nên không tốn CPU Worker và Ban Biên Tập không phải tự nén. Các cỡ hiển thị do `imageAt()` lo qua Image Transformations (T41d), nên ảnh R2 phải được phục vụ từ một địa chỉ trong zone: thêm bucket mới vào `/anh-goc/`, hoặc gắn tên miền con của zone cho bucket. Đổi tên / xóa có kiểm "đang dùng ở N bài". `MediaPicker` để chọn ảnh trong form. Cần bucket R2 (Giai đoạn 1 của kế hoạch Cloudflare); khi phát triển dùng R2 local.

**Tiêu chí nghiệm thu:**
- [ ] Ảnh JPG 8 MB (6048 px) tải lên thành một bản WebP ≤ 2560px trong R2, không còn EXIF; có bản ghi `Media` kèm alt
- [ ] Trang công khai hiện ảnh mới tải lên qua `imageAt()` ngay (bản 640 ≤ 80 KB)
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
3. Nếu Giai đoạn 1 của kế hoạch Cloudflare chép ảnh B2 và WordPress sang R2 thì đổi `mediaUrl()` và nguồn của `imageAt()` (T41d) sang địa chỉ trong zone của bucket R2. Ảnh WordPress phải chép trước khi tắt WordPress, nếu không `imageAt()` mất nguồn.
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

### T41b: Đo toàn site, ngân sách ảnh và Lighthouse CI

**Mô tả:** Phần sửa ảnh đã tách sang T41c (sửa nhanh) và T41d (Image Transformations của Cloudflare) ngày 04/11, cả hai đã xong. Ảnh mới tải lên do T30 lo; font chuyển sang T41f. T41b chỉ còn:
- Lighthouse CI cho 6 mẫu trang, có ngân sách: ảnh tải trước khi cuộn ≤ 1,5 MB mỗi trang, không ảnh nào lớn hơn 2 lần cỡ hiển thị; CSS và JS theo ngân sách của T41a; font ≤ 150 KB.
- axe cho mọi route công khai và admin.

**Kết quả 13/11/2026:** xong, đã deploy `v2.` (phiên bản `ab4ff104`).
- **Lighthouse CI** (`lighthouserc.json`, `npm run lhci`; `@lhci/cli` 0.15 dùng Lighthouse 12.6): 6 mẫu trang trên `v2.`, mỗi trang 3 lượt, báo cáo ghi vào `.lighthouseci/` (không vào git).
  - Báo **lỗi** khi vượt: CSS 80 KB, JS 340 KB, font 210 KB, ảnh 1.500 KB (dung lượng tải về lúc mở trang), CLS 0,01.
  - Chỉ **cảnh báo**: LCP trên 2,5 s, TBT trên 300 ms, có ảnh lớn hơn cỡ hiển thị.
  - Ngưỡng tính theo dung lượng Cloudflare thật sự gửi (CSS 69 KB, JS 227–247 KB gồm cả GSAP nạp sau), nên cao hơn số brotli ở T41a (50 KB, 175 KB).
- **Số đo 13/11** (điện thoại 4G giả lập, lượt đại diện):

  | Trang | Điểm | LCP | TBT | CLS | Ảnh |
  |---|---|---|---|---|---|
  | Trang chủ | 77 | 5,2 s | 109 ms | 0 | 537 KB |
  | Danh sách Dòng Chảy | 83 | 4,2 s | 0 | 0 | 244 KB |
  | Bài Dòng Chảy | 85 | 4,1 s | 0 | 0 | 189 KB |
  | Lịch tu học | 85 | 4,0 s | 0 | 0 | 158 KB |
  | Bài Giới thiệu | 84 | 4,1 s | 0 | 0 | 49 KB |
  | Khu vực Tam Bảo | 85 | 3,9 s | 0 | 0 | 640 KB |

  - CSS 69 KB, font 201 KB ở mọi trang.
- **Sửa khi đo:**
  - Thẻ sự kiện ở trang lịch (`EventCard`) còn dùng ảnh gốc B2, sót từ T41d: nay qua `imageAt()`. Ảnh trang lịch 367 → 158 KB.
  - Thẻ tượng thêm `srcSet` 360/640 (`imageSrcSet`): trên điện thoại thẻ chỉ rộng khoảng 185 px. Trang Tam Bảo 1.171 → 640 KB. Bản nhỏ là 360 chứ không phải 320, vì 185 px × 1,75 = 324 px vừa vượt 320. Đổi lại mỗi ảnh tượng tốn thêm một lượt biến đổi trong hạn mức.
- **axe** (`tests/e2e/a11y.spec.ts`): 14 mẫu trang công khai × 2 cỡ màn hình, hiệu ứng bật, 0 lỗi nghiêm trọng (28/28). Route admin thêm vào khi có admin mới.
- **Chưa đạt:**
  - **LCP < 2,0 s:** LCP mô phỏng 3,9–5,2 s. Phần còn lại là lần vẽ đầu chờ CSS 69 KB chặn hiển thị, JS và hydrate (đã ghi ở T41a, T41e). Cần chủ dự án quyết: làm tiếp (CSS màn hình đầu trong HTML, bớt hydrate) hay nới mục tiêu.
  - **Ảnh lớn hơn cỡ hiển thị** còn ở 4 trang (1–10 ảnh), nên chỉ để cảnh báo: ảnh bìa một cỡ 1280, logo và icon của site, thẻ tượng 360 cho ô 324 px.
- **Làm tiếp LCP (13/11, phiên bản `f27e6d3a`):**
  - Chẩn đoán: ở trang trong, phần tử LCP là banner đầu trang với ảnh nền CSS (`pheader-bg.webp`). Là file riêng nên trình duyệt chỉ hỏi sau khi CSS về (trễ 1,7–2,5 s trong mô phỏng).
  - Thử `<link rel="preload">` trong `HeroInner`: bỏ, vì cơ chế tải trước liên kết làm trang chủ cũng preload hai ảnh này (test ảnh hero bắt được).
  - Cách dùng: hai ảnh nền thu còn 945 px (1,1 và 1,3 KB; chênh trung bình 0,75/255) và nhúng thẳng vào CSS bằng `?inline`; file chuyển từ `public/` sang `src/app/assets/images/`. CSS 50,3 → 52,6 KB br (Cloudflare gửi 72 KB, ngưỡng 80 KB).
  - Lighthouse CI sau khi sửa (trung vị 3 lượt): bài Dòng Chảy 4,1 → 3,5 s; Tam Bảo 3,9 → 3,2 s; bài Giới thiệu 4,1 → 3,9 s; lịch 4,0 → 3,9 s; danh sách 4,2 s và trang chủ 5,2 s không đổi. FCP 1,9–2,3 s.
  - **Vì sao chưa xuống dưới 2,0 s:** LCP đo thật trong cùng các lượt (không giả lập) là 0,6–0,8 s và trùng lần vẽ đầu. Số 3,2–5,2 s là ước lượng của Lighthouse cho 4G chậm và CPU chậm 4 lần: nó cộng mọi JS đã tải xong trước thời điểm LCP thật (toàn bộ script của trang), nên phần "chờ vẽ" còn 1,0–2,0 s dù ảnh đã nằm trong CSS. FCP mô phỏng 1,9–2,3 s đã chạm mục tiêu 2,0 s trước khi tính LCP.
  - Muốn xuống tiếp phải đổi cách nạp: CSS màn hình đầu đặt trong HTML (bỏ 72 KB chặn hiển thị) và hoãn script của vinext tới sau lần vẽ đầu. Cả hai đụng vào cách vinext dựng trang, chưa làm.
  - Đề nghị: lấy LCP của người dùng thật làm mục tiêu (p75 ≤ 2,5 s, đo bằng Cloudflare Web Analytics ở T20), còn Lighthouse CI giữ cảnh báo để canh thụt lùi.
- **Ghi chú:** thư mục trình duyệt của Playwright (`ms-playwright`) bị mất khỏi máy trước lượt chạy này; đã cài lại bằng `npx playwright install chromium`.

**Tiêu chí nghiệm thu:**
- [x] CLS = 0 đạt. Mục tiêu LCP đổi ngày 13/11 (chủ dự án): p75 ≤ 2,5 s của người dùng thật, đo ở T20 sau khi ra mắt; Lighthouse CI cảnh báo khi LCP mô phỏng trên 5,5 s (hiện 3,2–5,2 s)
- [x] Lighthouse CI báo lỗi khi một trang vượt ngân sách ảnh, CSS, JS hoặc font (lượt đầu báo lỗi đúng ở 4 trang khi quy tắc ảnh quá cỡ còn là lỗi)
- [x] Mọi trang giữ ngân sách font của T41f (201 KB, ngưỡng 210 KB)
- [x] axe 0 lỗi nghiêm trọng trên mọi mẫu trang

**Kiểm chứng:**
- [x] `npm run lhci` trên `v2.`: qua, chỉ còn cảnh báo
- [x] `npm run test:e2e -- a11y`: 28/28 trên `v2.`
- [x] Unit 157 xanh; `tsc` sạch; toàn bộ e2e trên `v2.` 523/523 (49 bỏ qua theo thiết kế). Cục bộ: các bộ bị ảnh hưởng qua; 4 test hỏng khi máy chạy song song nặng, chạy lại với 2 luồng 25/25

**Phụ thuộc:** T41a, T41d, T41f

**File:** `lighthouserc.json`, `package.json`, `tests/e2e/a11y.spec.ts`, `src/libs/content/media.ts`, `src/components/sections/vu-tru/StatueCard.tsx`, `src/components/sections/calendar/EventCard.tsx`

**Quy mô:** M

---

### T42a: Kiểm kê chỗ v2 còn dùng chung với web cũ

**Mô tả:** Thêm 17/11/2026, theo phương án A của chủ dự án (tách dữ liệu dùng chung khỏi web cũ theo từng bước, giữ nguyên kiến trúc `ContentRepository`). Làm trước, vì các task sau cần số liệu thật. Chỉ đọc, không đổi code chạy.

- Sơ đồ dữ liệu: nguồn (`snapshot`, `b2`, `d1`) → `createFileLoaders` → `getContentRepository()` → trang; ảnh `mediaUrl()` → `imageAt()` → `/cdn-cgi/image` → B2 / WordPress. Vẽ bằng graphify, lưu ở `docs/van-hanh/tach-du-lieu.md`.
- Danh sách mọi host và bucket mà v2 còn gọi: `s2-cnv03`, `media-tunglamhoaphuc`, `admin.tunglamhoaphuc.com` (WordPress), `www` (Vercel; ảnh câu kệ `/images/lich-tu-hoc/quotes/…`), `www/api/admin/*` (chỉ `snapshot:fetch`).
- Đo thật: tổng số ảnh duy nhất và tổng dung lượng gốc theo từng host (HEAD hàng loạt, có giới hạn tốc độ), để chủ dự án quyết chi phí lưu trữ. Mẫu T41c: ảnh thẻ/bìa 395 MB cho 591 ảnh; album một bài có thể gần 190 MB.
- Đọc `normalize.ts` và `schema.ts`: ghi những quy ước chỉ đúng với dữ liệu web cũ.

**Kết quả 17/11/2026:** xong phần đo; còn chờ chủ dự án duyệt chi phí. Chi tiết ở [docs/van-hanh/tach-du-lieu.md](../docs/van-hanh/tach-du-lieu.md).
- **Số ảnh gấp hơn 3 lần dự tính:** 21.424 ảnh của chùa (B2 `s2-cnv03` 20.379, `media-tunglamhoaphuc` 133, WordPress 912), cộng 157 ảnh của trang bên ngoài (không chép được) và 12 ảnh câu kệ trên site cũ. Kế hoạch cũ ghi khoảng 6.000.
- **Dung lượng ≈ 3,65 GB** (B2 2,94 + 0,06; WordPress 0,65), dưới hạn mức miễn phí 10 GB của R2. Ảnh album trung vị 92 KB; ảnh WordPress trung vị 549 KB, p90 5,4 MB, 45 file trên 5 MB.
- **540 file không tìm thấy** (21 B2, 519 WordPress; mức tối đa, chưa tách 404 khỏi hết thời gian chờ). Phần lớn ở WordPress là ảnh "chưa từng tải lên" đã biết.
- **Rủi ro:** 495 ảnh trỏ `tunglamhoaphuc.com/wp-content/…` đang được `mediaUrl()` đổi sang `admin.`; chỗ này tắt ở Checkpoint J, nên 393 ảnh WordPress còn sống phải chép sang R2.
- **Quy ước riêng của web cũ** đã liệt kê ở mục 4 của tài liệu (3 kiểu ngày, Markdown nhẹ, ảnh emoji, album rỗng ở API danh sách, schema dễ dãi nuốt bản ghi hỏng).
- Script đo nằm ở thư mục tạm của phiên, chưa đưa vào kho; T42b sẽ có script chép riêng.

**Tiêu chí nghiệm thu:**
- [x] `docs/van-hanh/tach-du-lieu.md` có sơ đồ và bảng host, bucket, số ảnh, dung lượng
- [x] Chủ dự án duyệt dung lượng và chi phí R2 (miễn phí 10 GB đầu; quá thì tính theo GB): dung lượng ≈ 3,65 GB; chủ dự án cho làm T42b ngày 17/11

**Phụ thuộc:** không. **Quy mô:** S

---

### T42b: Chép ảnh sang bucket R2 riêng của v2

**Kết quả 17/11/2026:** xong, **20.912 ảnh (2,95 GB) đã nằm trong `tlhp-media`**. Chi tiết, quy ước khóa và cách chạy lại ở mục 6 của [docs/van-hanh/tach-du-lieu.md](../docs/van-hanh/tach-du-lieu.md).
- Bucket riêng tư, vùng APAC, không tên miền. Khóa: `<bucket>/<key>` cho B2, `wordpress/<đường dẫn sau uploads/>`, `site/<đường dẫn>` cho ảnh câu kệ.
- Danh sách 21.470 khóa; 558 lỗi (557 là 404 thật, 1 khóa có `..` bị Cloudflare từ chối), không thiếu khóa nào khác, không khóa thừa.
- 5.950 ảnh được gỡ EXIF hoặc thu về ≤ 2560 px; mẫu 50 ảnh đọc lại từ R2 không còn EXIF. Chạy: 67 + 20 phút; lần chạy thứ ba chép 0 ảnh.
- Thêm `sharp` vào `devDependencies` và lệnh `npm run media:copy` (`--verify` để kiểm).

**Mô tả:** Giữ quyết định 8 (xử lý ảnh bằng Image Transformations, không có tên miền `media.`): bucket R2 `tlhp-media` **riêng tư**, chỉ Worker đọc qua binding. Cần chủ dự án đồng ý tạo bucket (chi phí) trước khi làm.

- Script `scripts/media-copy.ts` chép ảnh của hai bucket B2 và WordPress sang R2, giữ nguyên khóa (`<bucket>/<key>`) để `mediaUrl()` không đổi. Chạy lại được, chỉ chép ảnh chưa có; báo ảnh lỗi (404, `.jfif` trả `application/octet-stream`).
- Bỏ metadata EXIF (có thẻ GPS) khi chép; ảnh gốc quá lớn thì giữ bản ≤ 2560 px, như T30.
- Chép cả ảnh câu kệ của lịch từ `www`/Vercel vào cùng bucket.

**Tiêu chí nghiệm thu:**
- [x] Số ảnh trong R2 khớp danh sách của T42a; ảnh lỗi được liệt kê (20.912 + 558 lỗi = 21.470)
- [x] Chạy lần hai không chép lại ảnh nào
- [x] Mẫu 50 ảnh: không còn EXIF

**Phụ thuộc:** T42a; T1b nếu chạy bằng CI; chủ dự án duyệt chi phí. **Quy mô:** M

---

### T42c: `/anh-goc/` đọc từ R2, chuyển nguồn ảnh

**Kết quả 17/11/2026:** mã xong, kiểm cục bộ (workerd); **chưa deploy**, còn hai việc chỉ làm được trên `v2.` (xem ô tiêu chí).
- Binding R2 `MEDIA` → `tlhp-media` trong `cloudflare.config.ts`. Route `/anh-goc/<bucket>/<key>` (`src/libs/content/mediaRoute.ts`, `serveMedia`) đọc R2 trước, rơi về B2 / WordPress khi R2 chưa có hoặc lỗi. Khóa R2: `<bucket>/<key>` cho B2, `wordpress/<đường dẫn sau uploads/>` cho WordPress. Chỉ ảnh (đuôi ảnh và `Content-Type: image/*`), chỉ `s2-cnv03`, `media-tunglamhoaphuc`, `wordpress`; từ chối khóa rỗng, `.`, `..`. `Cache-Control` 7 ngày giữ nguyên.
- `mediaUrl()` nay cho ảnh B2 và WordPress ra `/anh-goc/<bucket>/<key>` và `/anh-goc/wordpress/<đường dẫn>` (`MEDIA_BASE` thành `/anh-goc/s2-cnv03`); `imageAt()` biến đổi các địa chỉ này; `topImagePriority` coi `/anh-goc/` là "low" như ảnh cũ. File không phải ảnh (mp3, pdf) vẫn giữ địa chỉ gốc, vì route chỉ phục vụ ảnh.
- Test: `tests/unit/content/mediaRoute.test.ts` (ảnh có trong R2, thiếu → B2/WordPress, R2 lỗi, khóa lạ), `media.test.ts` (mediaUrl, mediaSource), `tests/e2e/image-origin.spec.ts` (test canh gác); sửa các kỳ vọng cũ về địa chỉ ảnh. `image-budget` xanh (desktop, 26 test).
- Phần rơi về B2/WordPress **còn giữ**: bỏ ở T42e khi đã kiểm R2 đủ ảnh trên `v2.`. Ảnh lỗi 404 ở T42b (558) vẫn 404.

**Mô tả:** Route `/anh-goc/<bucket>/<key>` (đã có ở T41d) đọc R2 trước, rơi về B2 / WordPress khi chưa có. Khi R2 đủ ảnh thì bỏ phần rơi về, và `mediaUrl()` không còn trả địa chỉ B2 hay WordPress.

- Thêm binding R2 vào `cloudflare.config.ts`; giữ `Cache-Control` 7 ngày và chỉ ảnh.
- Test: ảnh có trong R2, ảnh thiếu (rơi về B2), ảnh lạ (từ chối); `image-budget` vẫn xanh.
- Kiểm không còn request nào tới `admin.tunglamhoaphuc.com` hay bucket B2 từ trang công khai.

**Tiêu chí nghiệm thu:**
- [x] Trang chủ, Dòng Chảy, Lịch, Bảo Tượng (và Giới Thiệu, Tông Chỉ, Vũ Trụ): không có request ảnh tới B2, WordPress, `www` cũ (test canh gác `image-origin.spec.ts`, kiểm cục bộ; chạy lại trên `v2.` sau deploy)
- [x] Ngân sách ảnh của T41c: `image-budget.spec.ts` xanh (cục bộ)
- [ ] Sau deploy: ảnh qua `/cdn-cgi/image` của zone đọc được nguồn `/anh-goc/` từ R2 (cục bộ `/cdn-cgi/image` chỉ là đường chuyển hướng); đọc thật từ R2 thay vì B2 (cục bộ R2 mô phỏng rỗng)

**Phụ thuộc:** T42b. **Quy mô:** M

---

### T42d: Bản sao JSON riêng của v2

**Mô tả:** JSON chữ (13 file, ~12 MB) vẫn do admin cũ ghi cho tới T39. Thêm bước đồng bộ B2 → bucket R2 riêng `tlhp-data`; v2 đọc bucket này qua binding, không cần khóa B2 ở Worker. Nếu web cũ hay B2 hỏng, v2 vẫn có bản gần nhất.

- Nguồn thứ tư `r2` cho `ContentRepository` (dùng lại `createFileLoaders`, so `ETag`). Giữ `snapshot` làm nguồn thử và `b2` làm phương án dự phòng.
- Đồng bộ chạy theo lịch (GitHub Actions sau T1b), dùng khóa B2 chỉ đọc (chuẩn bị #4); giữ bản tốt gần nhất khi file hỏng.
- Thay `snapshot:fetch` từ `www/api/admin/*` bằng đọc file gốc trên B2 sau khi so định dạng ở T19.

**Xét lại phạm vi 22/11/2026 — CHỜ QUYẾT ĐỊNH của chủ dự án.** Mô tả trên viết khi `v2.` còn đọc snapshot. Nay `v2.` và `www` đọc D1 (`CONTENT_SOURCE=d1`) và Admin CMS mới ghi vào D1, nên "B2 → `tlhp-data` → nguồn `r2`" không còn là đường dữ liệu: nguồn `r2` sẽ bị D1 che. Việc còn cần làm là **B2 → D1** cho tới T39. Chưa viết mã, vì cách nhập hiện có sẽ làm mất dữ liệu của admin mới (đọc `src/db/import.ts`):
- `upsert` ghi đè **mọi cột nội dung** của dòng đã có (tiêu đề, thân bài, ảnh…); chỉ các cột nhập không đụng tới (`version`, `created_by`, `updated_by`, `deleted_at`, `visible`, `registration_open`…) được giữ. Bài sửa bằng admin mới mất chữ, còn `version` vẫn như đã sửa.
- `prune` **xóa** mọi dòng không có trong nguồn: bài, tượng, sự kiện, Danh Tăng… do admin mới **tạo** (không có ở B2) sẽ bị xóa; bài xóa mềm ở admin mới (còn trong B2) bị ghi đè nội dung.
- Bảng con (`album_item`, `milestone`, `art_variation`) bị xóa hết rồi nhập lại.
- Admin mới chạy trên `www` từ 22/11. **Đọc D1 thật (chỉ SELECT, chủ dự án cho phép 22/11) :** `post` 632, `teaching_article` 25, `page` 6, `area` 14, `statue` 126, `calendar_event` 15 dòng, tất cả `version = 1`, không dòng nào có `created_by`, `updated_by` hay `deleted_at`; `revision` 0; `audit_log` 12 dòng, `user` 1. Tức là **tới giờ chưa có dữ liệu nào của admin mới bị rủi ro**; nhưng khoảng an toàn này hết ngay khi Ban Biên Tập lưu bài đầu tiên. (`monk` không có cột kiểm toán, không đọc.)

Phương án:

| | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **(a)** Chỉ thêm dòng mới | Chế độ `--merge`: chỉ `INSERT … ON CONFLICT DO NOTHING`, không `prune`, không xóa bảng con | An toàn với dữ liệu admin mới; mã nhỏ, kiểm bằng S3 giả lập và SQLite | Bài đã có mà admin cũ sửa tiếp thì **không** sang v2; bài admin cũ xóa vẫn còn ở v2 |
| **(b)** Đóng băng B2 từ ngày X | Từ ngày X chỉ soạn ở admin mới; admin cũ chỉ đọc. Nhập B2 một lần cuối trước ngày X | Không mã mới, không nguy cơ ghi đè; rút ngắn thời gian hai admin song song | Cần Ban Biên Tập đồng ý chuyển sớm; sửa nhầm ở admin cũ sau ngày X bị mất; không đồng bộ gì trong lúc chờ |
| **(c)** Một chiều có cờ "đã sửa ở admin mới" | `ON CONFLICT DO UPDATE … WHERE version = 1 AND updated_by IS NULL AND deleted_at IS NULL`; `prune` chỉ xóa dòng `created_by IS NULL` và chưa sửa; bảng con chỉ chạy lại cho dòng được cập nhật | Admin cũ sửa tiếp vẫn sang v2 cho dòng chưa ai đụng ở admin mới; dòng admin mới tạo hay sửa được bảo vệ | Mã phức tạp nhất (mỗi bảng một điều kiện, cả bảng con); dòng bị admin mới sửa một chữ thì ngừng nhận sửa từ admin cũ (cần báo cáo dòng bị bỏ qua); lỗi ở đây là mất dữ liệu nên cần test kỹ |
| **(d)** Giữ thiết kế `r2` | Đồng bộ B2 → `tlhp-data`, nguồn `r2` | Đúng mô tả cũ | Không còn nghĩa vì v2/www đọc D1; thêm một nơi lưu dữ liệu mà không ai đọc. **Không khuyến nghị** |

**Khuyến nghị:** nếu T39 (chuyển hẳn sang admin mới) còn xa hơn vài tuần: làm **(a)** trước (ít rủi ro, làm ngay), nâng lên **(c)** nếu Ban Biên Tập vẫn cần sửa bài ở admin cũ. Nếu T39 gần (khoảng 2 tuần): **(b)**, rẻ và an toàn nhất. Dù chọn gì, trước mọi lần nhập lên D1 thật phải chạy `npm run import` vào `--db=<bản sao D1>` rồi so khác biệt, và có sao lưu (quy trình ở d1.md mục 7). Thiếu khóa B2 nên chưa chạy được bước nào trên dữ liệu thật.

**Đã làm 22/11/2026 (phần an toàn của phương án (a), chưa chạy trên D1 thật):** `npm run import` có `--merge` (chỉ `INSERT … ON CONFLICT DO NOTHING`; không `prune`, không xóa hay sửa dòng có sẵn; con khóa ghép chỉ thêm khi cha chưa qua tay admin), `--dry-run` (in "N sẽ thêm", cảnh báo trùng slug/mã), từ chối cờ lạ, và chặn nhập mặc định vào CSDL đã có `user`/`audit_log` trừ khi `--force`. Làm theo TDD, một reviewer độc lập tìm ra hai lỗi (con bị hồi sinh, cờ gõ sai chạy bản nguy hiểm) đã sửa; test-engineer thử 15 đột biến, mọi đột biến bị test mới bắt. `src/db/import.ts`, `scripts/import.ts`, `tests/unit/importMerge.test.ts` (+Gaps, +Flags). Kiểm: typecheck sạch, eslint sạch, `vitest tests/unit` 813/814 (hỏng đúng `taxonomyHeader`, có sẵn, của phiên khác). Giới hạn đã biết: dòng admin xóa vĩnh viễn bị nhập lại; sửa của admin cũ cho dòng đã có không sang; câu `INSERT … SELECT … VALUES … WHERE EXISTS` chưa thử trên D1 thật. Chưa có đồng bộ theo lịch.

**Mô tả (đã chốt 22/11/2026, chủ dự án chọn phương án (a) "chỉ thêm dòng mới" làm trước):** nhập B2 → D1 bằng `npm run import -- --from=b2 --merge`, **chỉ đọc B2, không ghi gì vào B2**, chạy lại được, có `--dry-run`. Bài đã có mà admin cũ sửa tiếp **không** sang v2 (chấp nhận). Bỏ `tlhp-data` và nguồn `r2`. Nâng lên (c) khi Ban Biên Tập vẫn cần sửa bài cũ ở admin cũ; chuyển (b) nếu T39 gần.

**Thử dry-run 22/11/2026 (chủ dự án cho đọc D1 thật, chỉ đọc):** D1 thật không có dòng nào của admin mới (số đếm ở trên). Không xuất được D1 thật ra tệp, nên dry-run chạy trên bản sao của bản sao lưu trước admin (`data/sao-luu-d1/…truoc-admin.sqlite`, đã áp migration 0001–0005 lên bản sao ở thư mục tạm; dữ liệu tương đương vì D1 thật chưa bị admin đụng). `npm run import -- --from=snapshot --merge --dry-run --db=<bản sao>`: mọi bảng **0 dòng sẽ thêm** (post 632, teaching_article 25, page 6, area 14, statue 126, monk 91, calendar_event 15, featured_program 3, month_theme 12, album 554, album_item 21.102…), trừ **`media`: 21.452 trong nguồn, 21.352 sẽ thêm**. **Bất thường, cần xử lý trước khi nhập thật:** id của `media` là sha1 của địa chỉ sau `mediaUrl()`; T42c (e106e0a) đổi địa chỉ ảnh sang `/anh-goc/…` sau khi D1 được nhập ngày 17/11, nên id nguồn hiện nay lệch id đang có trong D1 (chỉ 100 id trùng). Merge không mất dữ liệu, nhưng sẽ thêm ~21 nghìn dòng `media` trùng ảnh (id mới, không bài cũ nào trỏ tới) và làm bài mới trỏ vào id mới. Cần chọn: (1) đổi cách tính id `media` sang khóa ổn định (ví dụ băm `r2_key` hoặc `url` gốc) rồi ánh xạ id cũ, hoặc (2) chỉ nhập `media` mà bài mới thật sự dùng, bỏ qua phần còn lại. Chưa sửa, chờ chủ dự án.

**Quyết định 22/11/2026: id `media` ổn định (cách 1), đã làm.** Id nay là sha1 của **địa chỉ lưu** (`storedMediaAddress` trong `media.ts`): địa chỉ B2 `https://<bucket>.s3.us-east-005.backblazeb2.com/<khóa>` cho ảnh B2 (mọi dạng nguồn: S3, `b1.congngheviet`, `f005.backblazeb2.com`, `/anh-goc/…`), `https://admin.tunglamhoaphuc.com/wp-content/uploads/<đường dẫn>` cho WordPress (kể cả link `www`, `/anh-goc/wordpress/…`), còn lại giữ nguyên. Đó đúng là địa chỉ lúc D1 được nhập 17/11, nên **không phải ghi lại id nào trong D1 thật**; đổi `mediaUrl()` hay `MEDIA_BASE` về sau không làm lệch id nữa. Cột `media.url` cũng giữ địa chỉ gốc (khớp D1 thật); nguồn `d1.ts` nay đưa nó qua `mediaUrl()` khi đọc, nên ảnh WordPress ra `/anh-goc/wordpress/…` (trước đó D1 thật trả thẳng `admin.tunglamhoaphuc.com`, bỏ qua R2). Dry-run `--merge` trên bản sao D1 tái hiện như trên: `media` **21.452 trong nguồn, 0 sẽ thêm** (trước 21.352); tổng 0. Test mới `tests/unit/importMediaId.test.ts` (6): mọi dạng địa chỉ của cùng ảnh cho cùng id, id khớp công thức đóng băng, ảnh khác id khác, hàng `media` mang đúng id và khóa như D1. Kiểm: typecheck sạch, eslint sạch cho file đã đổi, `npm test` 819/820 (hỏng đúng `taxonomyHeader` có sẵn). `npm run lint` toàn kho đang lỗi vì thư mục `.claude/worktrees/deploy-admin` làm `tsconfigRootDir` mơ hồ (không liên quan). Chưa kiểm: ảnh có query string trong địa chỉ nguồn cũ (nay bị `mediaUrl()` bỏ query, id có thể lệch; dry-run không thấy dòng nào).

**Mốc T39:** chủ dự án dự kiến cuối tháng 12/2026 (còn khoảng 5 tuần kể từ 22/11), nên giữ (a) làm đường chính trong thời gian này, chưa chuyển (b). Xét nâng lên (c) nếu tới giữa tháng 12 Ban Biên Tập vẫn sửa nhiều bài cũ ở admin cũ; xét (b) (đóng băng B2) từ khoảng đầu tháng 12 nếu Ban Biên Tập đã quen admin mới.

**Tiêu chí nghiệm thu:**
- [x] Chủ dự án chọn phương án: (a) trước (22/11/2026)
- [x] Bài đã sửa, đã tạo hoặc đã xóa mềm bằng admin mới không bị ghi đè, không bị xóa sau khi nhập; con admin đã xóa không quay lại (`importMerge`, `importMergeGaps`, `importFlags`; đột biến đã thử)
- [x] Cờ gõ sai không chạy bản mặc định; bản mặc định bị chặn trên CSDL đã có `user`/`audit_log` (`importFlags`)
- [ ] Đăng bài mới ở admin cũ → sau khi chạy nhập `--merge`, `v2.` hiện bài trong ≤ 10 phút (cần khóa B2; chưa kiểm thật)
- [ ] `--merge --dry-run` trên bản sao D1 hiện tại với nguồn B2 thật cho số dòng hợp lý (cần khóa B2)
- [ ] Thử câu `INSERT … SELECT … VALUES … WHERE EXISTS` trên D1 thật (chỉ sau khi chủ dự án đồng ý chạy nhập)
- [ ] File JSON hỏng không làm trang đổi, log có lỗi (phần đọc B2 đã có test ở T19)
- [ ] (tùy chọn) chạy theo lịch (T1b), chưa làm

**Phụ thuộc:** T19 (khóa B2, so định dạng), T23/T24 (D1), T42a; quyết định của chủ dự án. T1b chỉ cần nếu chạy theo lịch. **Quy mô:** M

---

### T42e: Gỡ phụ thuộc cuối

**Mô tả:** Sau T39 (D1), bỏ nguồn `snapshot`, `b2` và bước đồng bộ T42d; `ContentRepository` chỉ còn `d1`. Rà `grep` toàn kho không còn `backblazeb2`, `admin.tunglamhoaphuc.com`, `www/api/admin`, `congngheviet`. Phải xong trước khi tắt B2 và WordPress ở Checkpoint J.

**Tiêu chí nghiệm thu:**
- [ ] `grep` ở trên không còn kết quả trong `src/` và `scripts/`
- [ ] Tắt thử B2 và WordPress: toàn bộ e2e trên `v2.` vẫn xanh

**Phụ thuộc:** T39, T42c, T42d. **Quy mô:** S

---

### Checkpoint J: Hoàn tất
- [ ] Mọi tiêu chí nghiệm thu đạt; 6 lệnh chuẩn xanh
- [ ] `www` chạy D1 + admin mới ổn định 2 tuần
- [ ] Tắt admin cũ ở `quantri.`, chuyển B2 và WordPress sang chỉ đọc rồi tắt theo kế hoạch Cloudflare

---

## Review 22/11/2026 (tab "Review" của sheet Q&A, RV-01…RV-12)

Trạng thái 22/11/2026: **mới kiểm kê, chưa sửa mã.** Cây làm việc có khoảng 150 file đang sửa dở của các phiên khác (trang chủ classic, footer, hero, slider, bảo tượng, trí tuệ…), trùng gần hết file mà RV-01…RV-08 và RV-11 cần đụng. Sửa chồng lên sẽ ghi đè việc dở, nên chờ các phiên đó commit.

| Mã | Việc | Ghi nhận |
|---|---|---|
| RV-01…RV-08 | Header, Hero, Tìm kiếm AI, tinh gọn và thứ tự Trang chủ, thẩm mỹ, Lịch, Khu vực nổi bật | Vùng file đang do phiên "Đồng bộ phong cách web cũ và mới" và phiên "Agent Skills" sửa dở. Chờ commit rồi kiểm lại từng mục. Mục bỏ/thu gọn khối nội dung chỉ đề xuất, không tự cắt. |
| RV-09 | Kế thừa thẩm mỹ V1 cho trang chuyên mục (P0, định hướng) | Ghi nhận. Giữ A−/A+ và 3 nền Ngà/Giấy dó/Đêm thiền. |
| RV-10 | Chỗ cắm trang Infographic sau này (P2) | Ghi nhận, chưa làm. |
| RV-11 (1) | Ảnh `…/tieu-su-hoa-thuong-ngo-chan-tu-1.jpg` 404 | Đã đo: `www/anh-goc/…` trả 404. Địa chỉ nằm trong dữ liệu bài (snapshot/D1), không nằm trong mã; sửa ở dữ liệu, thuộc phiên T19/T42d và cần ghi D1 thật (chờ chủ dự án đồng ý). |
| RV-11 (4) | Typo "cở" → "ở", dấu nháy thừa, số "2" thừa, mã thô `LAM_TI_NI` | Cũng nằm trong dữ liệu bài (`data/snapshot/posts.json` có "cở"); cùng nhóm sửa dữ liệu như trên. |
| RV-11 (2)(3)(4 nút) | Hero mobile, Footer, mũi tên Tin tức, bộ lọc bảo tượng | File đang sửa dở của phiên khác. Chờ commit. |
| RV-12 | Hero banner ảnh riêng ở trang chi tiết (mới trên sheet, ngoài danh sách ban đầu) | Ghi nhận; liên quan `DetailHero.tsx` chưa commit. |

Lên live: `www` và `v2.` đang cùng trả 200 từ Worker `tlhp-web`. Chưa deploy gì trong đợt này vì HEAD không chứa việc dở nào ở trên.

**Cập nhật 22/11/2026 (sau deploy):**
- Đã deploy Worker `tlhp-web` (v2 và www dùng chung một Worker nên là một lần deploy): phiên bản **`cb625f4d-c758-4be6-b971-5b6f67e5d409`**. Phiên bản trước để lùi: `8dc0692e-859d-4a91-a8eb-9bd6c4c21e0a` (trước nữa `84f3824b-553e-448b-b741-89129696b25c`); lùi bằng `npx cf workers deployments` / rollback về mã đó.
- Nội dung deploy: fc674f5 và d4ef7b1 (phiên Agent Skills: lịch một dòng mobile, Lộ trình, CTA, iframe Maps, công tắc dừng chung, mũi tên slider) cộng 2 commit RV-11 trên nhánh `fix/review-rv11` (tượng TP0001: bỏ số "2" thừa, đổi `LAM_TI_NI`; footer thêm giờ Sám hối 19:00). Không bật admin, không migration.
- Kiểm trên www: các trang chính 200, trang lạ 404, `/api/quan-tri` 503; e2e smoke, footer, motion-toggle, slider-arrows, lien-he, lich-tu-hoc: 72 đạt, 2 lỗi cũ (test "địa chỉ admin cũ chuyển sang quantri." vì `/admin` hiện đi qua Cloudflare Access).
- Còn lại: icon mạng xã hội footer (chờ link chính thức, GD-06); ảnh Sư tổ 404 và chính tả "cở" (sửa dữ liệu D1, chờ đồng ý); RV-02, RV-04, RV-05, RV-08 (đề xuất, chờ quyết thiết kế); hero mobile 390px đã đạt.
- **Quyết định của chủ dự án 22/11/2026:** giữ nguyên Trang chủ, chưa cắt hay thu gọn khối nào. RV-02 (đổi Hero), RV-04 (tinh gọn), RV-05 (đổi thứ tự), RV-08 (khu vực nổi bật) tạm dừng, không làm cho tới khi có quyết định mới.
