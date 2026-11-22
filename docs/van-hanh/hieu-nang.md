# Hiệu năng trang chủ (PageSpeed Insights, điện thoại)

Đo bằng [PageSpeed Insights](https://pagespeed.web.dev/) chế độ điện thoại (Moto G Power giả lập, 412 px, tỉ lệ điểm ảnh 1,75, mạng 4G chậm). Điểm dao động vài điểm giữa các lần chạy; so sánh nên chạy 2–3 lần.

## 22/11/2026

| | Trước (`f9a855f`) | Sau `24ded15` | Sau `f7fbf73` (đang chạy) |
|---|---|---|---|
| Performance | 77 | 89 | **90** |
| First Contentful Paint | 1,1 s | 1,0 s | 1,1 s |
| Largest Contentful Paint | 4,5 s | 3,5 s | **3,2 s** |
| Total Blocking Time | 260 ms | 60 ms | 150 ms |
| Cumulative Layout Shift | 0 | 0 | 0 |
| Speed Index | 4,3 s | 4,4 s | 3,8 s |
| LCP: chờ hiển thị phần tử | 1 000 ms | 550 ms | 430 ms |
| Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 |

Báo cáo: trước `…/analysis/https-www-tunglamhoaphuc-com/t1oul72s9u`, sau cùng `…/analysis/https-www-tunglamhoaphuc-com/u2eit2b733` (trên pagespeed.web.dev, giữ được một thời gian).

### Đã sửa

- **Chữ của khung hero đầu tiên** hiện ngay khi trang tới, không chờ Swiper khởi động cộng 1–1,5 s trễ CSS (`_slider.scss`, quy tắc `.hero-slider:not(.swiper-initialized)`). Hiệu ứng chữ hero chỉ đổi `opacity`/`transform`, không đổi `visibility`.
- **Ảnh hero** có bản 640, 960, 1280, 1920 px (`framePicture` trong `src/libs/home.ts`, bản dọc 640/960/1280); máy của PageSpeed lấy bản 960. Ảnh nhỏ dưới hero dùng bản 360. Logo đầu trang có bản 200 px (`public/brand/logo-moc-an-200.webp`). Ảnh hoa văn và con dấu có `width`/`height`.
- **Bộ nhớ đệm:** `/images/*`, `/brand/*` (`public/_headers`) và `/anh-goc/*` (`mediaRoute.ts`) giữ 30 ngày trong trình duyệt, thêm 7 ngày `stale-while-revalidate`. **Thay ảnh trong `/images` hay `/brand` thì đặt tên tệp mới**, nếu không khách cũ có thể thấy ảnh cũ tới 30 ngày.
- **JS lúc tải trang:** GSAP và wow.js chạy sau sự kiện `load`, khi trình duyệt rảnh (`whenIdleAfterLoad` trong `src/libs/motion.ts`); bộ đếm odometer chỉ tải khi còn cách khoảng một màn hình; nút về đầu trang nghe cuộn kiểu passive.
- Bỏ CSS `swiper/css/effect-coverflow` không dùng.
- **Header bảo mật** (`next.config.js`, mọi trang và API): `Strict-Transport-Security: max-age=31536000` (không gồm tên miền con), `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Chưa có CSP.

### Để lại có chủ ý

| Mục PageSpeed | Lý do |
|---|---|
| CSS chặn hiển thị (75 KB gzip, ~58 KB không dùng trên trang chủ) | Phần lớn là SCSS của theme; tách theo trang làm đổi thứ tự cascade (`_tlhp-night.scss` ghi đè sau cùng), dễ vỡ trang khác |
| `font-display` của `bexon-icons` (10–30 ms) | `swap` từng gây dịch bố cục; giữ CLS = 0 |
| JS không dùng (~95 KB), luồng chính 2,7–3,7 s | Chủ yếu Swiper các slider dưới màn hình; hoãn chúng đụng autoplay, thumbs và focus, chưa chắc an toàn |
| Ảnh còn ~240 KB "có thể bớt" | Ảnh hero chất lượng 75 và ảnh hoa văn có nhiều chi tiết alpha; bản nhỏ hơn không nhẹ hơn đáng kể |
| Legacy JavaScript 10 KB | Beacon của Cloudflare Web Analytics, bên thứ ba |
| CSP, Trusted Types | Trang và admin có script nội tuyến, bản đồ, YouTube; chính sách sai làm hỏng trang |
