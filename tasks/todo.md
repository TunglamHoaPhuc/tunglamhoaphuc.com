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
- [ ] Ghi mốc LCP và dung lượng CSS/JS; nếu preloader làm trượt LCP < 2,0 s thì chủ dự án quyết (Câu hỏi mở #6 trong plan.md)
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
