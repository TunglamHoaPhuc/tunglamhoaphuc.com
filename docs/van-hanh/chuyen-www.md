# Chuyển `www.tunglamhoaphuc.com` sang site mới (T22)

> Cập nhật 17/11/2026. Liên quan: [tasks/todo.md](../../tasks/todo.md) T22 và Checkpoint E, [admin-cu.md](admin-cu.md), [nguon-b2.md](nguon-b2.md).
> **Chưa diễn tập và chưa chuyển.** Mục 3 và 4 ghi cách làm theo cấu hình hiện có; mọi bước đánh dấu ⚠️ cần kiểm lại khi diễn tập, vì chưa ai chạy chúng. Tiêu chí "quay lại trong 15 phút" chỉ được đánh dấu xong sau khi diễn tập thật.

## 1. Điều kiện trước khi chuyển

| # | Điều kiện | Hiện trạng 17/11/2026 |
|---|---|---|
| 1 | Mọi địa chỉ công khai lấy từ dữ liệu trả 200 trên `v2.` | ✅ 811/811 (`npm run check:urls -- --base=https://v2.tunglamhoaphuc.com`); danh sách ở [url-cong-khai.txt](url-cong-khai.txt) |
| 2 | `v2.` đọc dữ liệu B2 (`CONTENT_SOURCE=b2`), không phải snapshot đóng gói | ❌ chờ khóa B2 chỉ đọc (T19, [nguon-b2.md](nguon-b2.md)) |
| 3 | Admin cũ chạy ở `quantri.` sau Access, `*.vercel.app` bị khóa | ❌ T21 phần 2, cần người có quyền vào project Vercel |
| 4 | Ban Trị Sự duyệt `v2.` | ❌ chưa |
| 5 | Web Analytics đã bật cho `www` | ❌ chưa (cài đặt tài khoản Cloudflare, chủ site quyết) |
| 6 | e2e xanh trên `v2.` (nhóm `smoke`, `seo`, `a11y`, `home`) | ✅ 17/11 |

Chỉ chuyển khi cả sáu mục đều xanh.

## 2. Mã đã sẵn sàng cho ngày chuyển

- Header noindex, `robots.txt` và `sitemap.xml` tự đổi theo host: trên `www` cho lập chỉ mục, trên mọi host khác thì không (T20).
- Trên host công khai, `/admin`, `/login`, `/van-hanh` (và mọi đường con) chuyển 307 sang `https://quantri.tunglamhoaphuc.com/…`; tên miền gốc `tunglamhoaphuc.com` chuyển 308 sang `www` (`next.config.js`). Chỉ có tác dụng khi app nhận yêu cầu mang các host đó, nên **hiện chưa làm gì**.
- **Giới hạn đã đo:** vinext không mang chuỗi truy vấn (`?q=…`, `?thang=…`) sang tên miền khác, nên chuyển hướng trong app làm mất nó (kiểm 17/11: `…/gioi-thieu?x=1` ra `www…/gioi-thieu`). Với tên miền gốc, nên thêm một Redirect Rule ở Cloudflare (Rules → Redirect Rules, giữ chuỗi truy vấn) từ `tunglamhoaphuc.com/*` sang `https://www.tunglamhoaphuc.com/${1}`; luật trong app chỉ là lớp dự phòng. Với `/admin` và `/login` mất chuỗi truy vấn không sao.
- Trang mẫu Bexon và `/styleguide` trả 404 trên `www`.
- `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke` kiểm sau chuyển: trang chủ không noindex, các trang chính 200, trang lạ 404, địa chỉ admin cũ chuyển sang `quantri.`.

## 3. Các bước chuyển ⚠️

Làm theo thứ tự, ngoài giờ cao điểm của Phật tử (tránh sáng sớm và trước ngày lễ).

1. **Ghi lại trạng thái hiện tại** để quay lại: bản xuất DNS (`npx cf dns records export --zone tunglamhoaphuc.com --profile tlhp` ⚠️) lưu vào nơi an toàn, kèm ID phiên bản Worker `tlhp-web` đang chạy (`npx cf workers deployments list --worker tlhp-web --profile tlhp`).
   Giá trị cũ cần khôi phục (ghi từ [admin-cu.md](admin-cu.md), 02/11/2026, kiểm lại bằng bản xuất DNS): `www` CNAME `cname.vercel-dns.com` (proxied); `tunglamhoaphuc.com` A `76.76.21.21` (proxied).
2. **Gỡ route `www.tunglamhoaphuc.com/api/*`** của Worker `tlhp-admin-guard` (Workers → `tlhp-admin-guard` → Settings → Domains & Routes). Site mới không có `/api/admin`; nếu để lại, route này vẫn chặn.
3. **Gỡ hai bản ghi DNS** `www` và `tunglamhoaphuc.com` đang trỏ về Vercel. Worker Custom Domain không gắn được vào tên đang có bản ghi DNS khác. ⚠️ Cloudflare có thể từ chối thay vì ghi đè; khi đó gỡ trước rồi gắn.
4. **Thêm hai tên miền vào Worker** trong `cloudflare.config.ts`: đổi `domains: ["v2.tunglamhoaphuc.com"]` thành `["v2.tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]`, rồi `CLOUDFLARE_ACCOUNT_ID=b91a395bd9b7ab86ef4cba41d1d828ae npm run deploy:v2` ⚠️ (tên lệnh giữ `v2` vì cùng một Worker).
5. **Kiểm ngay** (trong 5 phút):
   - `BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke seo`
   - `curl -sI "https://tunglamhoaphuc.com/tim-kiem?q=niem+phat"` chuyển sang `www` và giữ `?q=niem+phat`;
   - `npm run check:urls -- --base=https://www.tunglamhoaphuc.com`
   - mở bằng điện thoại: trang chủ, một bài, Lịch tu học;
   - `https://www.tunglamhoaphuc.com/admin` chuyển tới `quantri.` và đòi đăng nhập Access.
6. **Gửi sitemap** `https://www.tunglamhoaphuc.com/sitemap.xml` cho Google Search Console (chủ site có quyền) và chạy Rich Results Test cho một bài và một sự kiện (tiêu chí còn lại của T20).

## 4. Quay lại Vercel (mục tiêu ≤ 15 phút) ⚠️

Khi nào quay lại: tỷ lệ lỗi 5xx tăng rõ, trang chính không mở được, hoặc Ban Trị Sự yêu cầu.

1. Trong `cloudflare.config.ts` trả `domains` về `["v2.tunglamhoaphuc.com"]`, deploy lại. Việc này nhả hai tên miền khỏi Worker.
2. Tạo lại hai bản ghi DNS theo bản xuất ở bước 1 của mục 3 (`www` CNAME `cname.vercel-dns.com`, `tunglamhoaphuc.com` A `76.76.21.21`, cả hai proxied).
3. Gắn lại route `www.tunglamhoaphuc.com/api/*` cho Worker `tlhp-admin-guard`.
4. Kiểm: `https://www.tunglamhoaphuc.com/` hiện site cũ, `…/admin` bị Access chặn như trước.

Admin cũ ở `quantri.` không bị ảnh hưởng khi quay lại. **Cần diễn tập** (làm hết các bước 3 và 4 với một tên miền thử, ví dụ `thu.tunglamhoaphuc.com`, đo thời gian) trước khi chuyển thật.

## 5. Theo dõi 48 giờ

- Nhật ký Worker `tlhp-web` (Workers Logs): lỗi và `exceededCpu`. Gói Workers Free chỉ cho 10 ms CPU mỗi yêu cầu; lượng người thật có thể làm số `exceededCpu` tăng, và đó là căn cứ để chủ site quyết nâng gói (Câu hỏi mở #8). Cách truy vấn ghi ở bộ nhớ dự án và `cf o11y telemetry query`.
- Tỷ lệ 404 không tăng so với trước khi chuyển (đối chiếu Cloudflare Analytics của zone).
- Web Analytics: LCP p75 trên điện thoại ≤ 2,5 giây sau 2 tuần (tiêu chí T20).
