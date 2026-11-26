# Kiểm kê tài khoản Cloudflare của Tùng Lâm Hòa Phúc (23/11/2026)

> Chỉ đọc: toàn bộ số liệu lấy bằng lệnh `cf ... list/get`, `cf d1 query` (chỉ `SELECT`), `curl` vào địa chỉ công khai. Không xóa, tạo, sửa, deploy hay purge gì; không đổi gói cước; không in giá trị bí mật (chỉ ghi tên).
> Tài khoản `b91a395bd9b7ab86ef4cba41d1d828ae` (đăng nhập database.tunglamhoaphuc@gmail.com, hồ sơ cf `tlhp`). Zone `tunglamhoaphuc.com` (id `411520190ae6e5f3fcb524cacdf9bc91`, gói Free, NS aaden/dara, trạng thái active).
> Liên quan: [d1.md](d1.md), [sao-luu.md](sao-luu.md), [admin-cu.md](admin-cu.md), [chuyen-www.md](chuyen-www.md), [tach-du-lieu.md](tach-du-lieu.md).

Cách đọc cột **dùng bởi**: *www* = Worker `tlhp-web` (repo `E:\tlhp-av3`), *V3* = Worker `tlhp-v3` (repo `E:\tlhp-v3-doc`, bản cũ `E:\tung-lam-hoa-phuc-v3` cùng cấu hình), *cả hai*, *CÓ THỂ KHÔNG DÙNG* (không mã nào nhắc tới), *KHÔNG RÕ*. Kho site cũ `E:\tung-lam-hoa-phuc-old` không có tham chiếu nào tới tài nguyên Cloudflare (đã grep tên bucket, id D1, tên Worker, tên máy chủ).

## 0. Tóm tắt

- Tài khoản rất gọn: 4 Worker, 1 D1, 2 R2, 12 bản ghi DNS, 2 ứng dụng Access. **Không có** KV, Queues, Durable Objects, Vectorize, Hyperdrive, Pages, Turnstile, Tunnel, Logpush, Images đã lưu, Health Checks, Load Balancer, Email Routing (chưa cấu hình), quy tắc WAF/Redirect/Cache/Rate limit tùy chỉnh, Page Rules.
- Chi phí cố định đọc được: **Workers Paid 5 USD/tháng**; mọi gói khác 0 USD (Zone Free, R2 Paid trả theo mức dùng, Zero Trust Free, Images/Stream Basic 0). Mức dùng thật không đọc được: `cf billing usage` trả 403.
- **Ứng viên xóa** (xem mục 11): chỉ có 2 Worker (`tlhp-web-xem-thu`, `tlhp-admin-guard`) và 1 vài mục phụ phải hỏi chủ; tiết kiệm tiền gần như bằng 0, lợi ích chính là giảm bề mặt tấn công.
- **Điều đáng chú ý nhất:** (1) `tlhp-web-xem-thu` còn mở công khai trên `workers.dev` với quyền gọi Workers AI; (2) `tlhp-backup` đang **rỗng**: chưa có bản sao lưu nào trên đám mây (cron chưa nối); (3) 495 dòng bảng `media` vẫn trỏ ảnh về WordPress `admin.tunglamhoaphuc.com`, các ảnh đó **chưa có trong R2**, nên máy chủ WordPress `209.42.27.235` vẫn là chỗ dựa của trang; (4) cài đặt zone: `min_tls_version=1.0`, `ssl=full` (không phải strict), `always_use_https=off`. Chi tiết ở mục 12.

## 1. Workers

| tên | loại | dùng bởi | bằng chứng (tệp:dòng) | khuyến nghị |
|---|---|---|---|---|
| `tlhp-web` | Worker (vinext), tạo 02/11, deploy gần nhất 23/11 03:54 UTC (phiên bản #70 `edd6b3a4`). Domain tùy chỉnh: `v2.`, `www.`, `tunglamhoaphuc.com` (apex). workers.dev tắt. Quan sát (Workers Logs) bật, 100% mẫu. 152.178 yêu cầu trong 7 ngày | **www** (đang phục vụ công khai) | `cloudflare.config.ts:12-16` | **giữ** |
| `tlhp-v3` | Worker (vinext), tạo 22/11, deploy 23/11 04:30 UTC (#10 `175a956a`). Domain `v3.tunglamhoaphuc.com`. workers.dev tắt. 13.319 yêu cầu/7 ngày | **V3** | `E:\tlhp-v3-doc\cloudflare.config.ts:13-16` | **giữ** |
| `tlhp-web-xem-thu` | Worker tạo 17/11 14:31, cập nhật 17/11 14:37, **workers.dev BẬT** (`https://tlhp-web-xem-thu.database-tunglamhoaphuc.workers.dev`, trả 200, không sau Access). Không domain/route. Bindings: `AI`, `ASSETS`, `MEDIA` (không D1). 87 yêu cầu/7 ngày, cuối cùng 17/11 15:41 UTC (nên phần lớn 87 yêu cầu là của ngày 17/11) | **CÓ THỂ KHÔNG DÙNG**: bản xem thử tạm của T17b (hai phòng đọc Trí Tuệ), không tệp cấu hình nào của hai repo nhắc tới | `tasks/todo.md:1201` ghi rõ "Xóa Worker này sau khi chủ dự án xem xong"; không nơi nào khác trong mã/tài liệu dùng tên này (đã `grep xem-thu`) | **có thể xóa** (sau khi hỏi chủ đã xem xong, xem mục 11) |
| `tlhp-admin-guard` | Worker chặn API admin site cũ, tạo 02/11, cập nhật 20/11 08:38. Không domain, không route đọc được qua `cf` (không có lệnh liệt kê route theo zone); sự kiện cuối trong Workers Logs: 20/11 08:38 UTC, sau đó không còn yêu cầu nào, khớp việc đã gỡ route `www…/api/*` lúc chuyển www. Chỉ 1 phiên bản. Bindings là chữ thường `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (định danh Access, không phải bí mật) | **CÓ THỂ KHÔNG DÙNG** (còn giữ để quay lại Vercel) | `workers/admin-guard/cloudflare.config.ts:19-21` ("T22: route ... removed"; `triggers: []`); `docs/van-hanh/chuyen-www.md:33,50` | **hỏi chủ**: giữ nếu còn khả năng lùi về Vercel; nếu không thì có thể xóa (mã nguồn vẫn nằm trong repo, deploy lại được) |

Không đọc được: **Cron Triggers** và **route theo zone** (CLI `cf` không có lệnh tương ứng). Suy từ mã: không Worker nào có handler `scheduled` (`grep scheduled src` chỉ thấy chuỗi "cron" trong `src/admin/ops/backup.ts:195` để ghi nhật ký; `docs/van-hanh/sao-luu.md:37` nói thẳng "Việc nối cron chưa làm"). Route của `tlhp-admin-guard` suy từ nhật ký không còn yêu cầu từ 20/11. Muốn chắc chắn: Dashboard, Workers & Pages, từng Worker, Settings, Domains & Routes.

### 1.1 Phiên bản Worker (ứng viên dọn)

| Worker | Số phiên bản | Số hiệu | Cũ nhất | Mới nhất | Ghi chú |
|---|---|---|---|---|---|
| `tlhp-web` | 70 (cũng 70 lần deployment) | #1 đến #70 | 02/11/2026 08:58 UTC | 23/11/2026 03:54 UTC | theo ngày: 02/11:12, 03/11:17, 04/11:8, 05/11:2, 13/11:6, 17/11:7, 18/11:4, 20/11:2, 22/11:9, 23/11:3. Đang phục vụ #70 100% |
| `tlhp-v3` | 10 | #1 đến #10 | 22/11 07:48 | 23/11 04:30 | đang phục vụ #10 |
| `tlhp-web-xem-thu` | 2 | #1, #2 | 17/11 14:31 | 17/11 14:37 | đang phục vụ #2 |
| `tlhp-admin-guard` | 1 | #1 | 02/11 09:49 | 02/11 09:49 | |

Phiên bản cũ không tính tiền riêng. Dọn là việc tùy chọn, **lợi ích rất thấp**; rủi ro là mất điểm quay lui. `docs/van-hanh/d1.md` mục 7 ghi các điểm quay lui theo mã 8 ký tự, 12 mã trong đó vẫn còn trong danh sách: `ac9b547c` (#69), `dd08f84a` (#68), `2095e8d7` (#67), `346835cf` (#66), `2f838b88` (#65), `322a86e7` (#64), `4fe0615a` (#63), `59df72f8` (#62), `8dc0692e` (#60), `1e403dce` (#58), `a6e935fd` (#50), `4a6620cd` (#49). Nếu dọn thì **giữ 10 bản gần nhất và mọi bản được ghi ở d1.md**; chỉ xóa các bản #1 đến #48 (phần lớn là bản thử trên `v2.` từ 02-05/11), và chỉ khi chủ đồng ý. Phiên bản #70 (`edd6b3a4`) và #10 của V3 đang chạy chưa được ghi ở d1.md (xem mục 12).

## 2. D1

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| `tlhp-db` (`dfee6bc6-9acf-4fcf-b25c-3ca1535c689a`) | D1, APAC, tạo 17/11, **18.001.920 byte (khoảng 17 MiB)**, 41 bảng, không bản sao đọc. 6 migration đã áp: `0000_khoi-tao` … `0005_admin-tong-chi-html` | **cả hai** (`DB` của www và V3; V3 chỉ đọc) | `cloudflare.config.ts:34`; `E:\tlhp-v3-doc\cloudflare.config.ts:29` | **giữ, không bao giờ xóa** (bản duy nhất của nội dung và admin) |

Số dòng chính (đếm 23/11): `post` 632, `media` 21.452, `media_usage` 22.701, `album` 554, `album_item` 21.102, `statue` 126, `monk` 91, `role_permission` 251, `teaching_article` 25, `milestone` 25, `calendar_event` 15, `category` 29, `area` 14, `art_variation` 40, `page` 6, `menu` 3 / `menu_item` 12, `role` 4, `user` 1, `session` 7, `audit_log` 30, `setting` 2. Bảng rỗng: `media_crop`, `media_folder`, `notice`, `page_view`, `password_reset`, `post_related`, `quote`, `redirect`, `registration`, `revision`, `statue_image`, `statue_related`, `user_totp`. Chỉ có **1 tài khoản admin**, chưa bật 2FA, chưa có phiên bản bài (`revision` rỗng).

Ghi chú nhỏ: CLAUDE.md nói migration admin là 0001–0004; D1 thật đã có thêm `0005`.

## 3. R2

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| `tlhp-media` | R2, APAC, Standard, tạo 17/11. **20.912 đối tượng, 2.953.892.303 byte (khoảng 2,75 GiB)**. Riêng tư: r2.dev tắt, không tên miền tùy chỉnh, không CORS, không thông báo sự kiện; luật vòng đời mặc định (hủy tải lên dở sau 7 ngày) | **cả hai** (binding `MEDIA`, route `/anh-goc/…`) | `cloudflare.config.ts:30`; `E:\tlhp-v3-doc\cloudflare.config.ts:28`; `src/libs/content/mediaRoute.ts:31-48`; `src/libs/content/media.ts:13-22,93-113` | **giữ, không bao giờ xóa** |
| `tlhp-backup` | R2, APAC, tạo 22/11. **0 đối tượng**, riêng tư, cùng cấu hình như trên | **www** (binding `BACKUP`, chỉ khi bật admin) | `cloudflare.config.ts:49`; `docs/van-hanh/sao-luu.md:27-30` | **giữ**. Đang rỗng: chưa chạy "Sao lưu vào kho lưu trữ" lần nào và cron chưa nối (mục 12) |

Chi phí R2 ước tính: 2,75 GiB nhỏ hơn mức miễn phí 10 GB-tháng của R2, nên khoảng 0 USD/tháng (giá công bố 0,015 USD/GB-tháng, nghĩa là cỡ 0,04 USD nếu không có mức miễn phí).

### 3.1 Tiền tố cấp cao của `tlhp-media` (số đối tượng, byte, ngày ghi)

Tất cả đều ghi ngày 17/11/2026 (đợt chép `scripts/media-copy.ts`).

| tiền tố | đối tượng | byte | dùng bởi trang? |
|---|---|---|---|
| `s2-cnv03/tunglamhoaphuc-com/wp-content` | 19.657 | 2.305.123.919 | có: khớp `media.r2_key` kiểu `tunglamhoaphuc-com/…` (19.661 dòng) |
| `s2-cnv03/tunglamhoaphuc2/<mục>` (03-dong-chay-hoang-phap 581, 07-anh-tho-cac-vi-cao-tang 76, 02-tong-chi-tu-hoc 32, 05-bao-tuong-phat-giao 14, 04-vu-tru-phat-giao 3, 01-trang-chu 2, 08-tu-an-book 1, 06-33-ung-hoa… 1) | 710 | khoảng 413 triệu | có (675 dòng `media.r2_key` kiểu `tunglamhoaphuc2/…`) |
| `s2-cnv03/uploads` | 7 | 2.249.602 | có (4 dòng `uploads/…`; 3 đối tượng khác là tệp mới tải qua admin, xem dưới) |
| `media-tunglamhoaphuc/tunglamhoaphuc2/<mục>` (05-bao-tuong-phat-giao 112, 01-trang-chu 18, 04-vu-tru-phat-giao 2, 02-tong-chi-tu-hoc 1) | 133 | khoảng 36 triệu | có: 129 dòng `media.url` trỏ `media-tunglamhoaphuc.s3.…backblazeb2.com`, cả 129 có trong R2 |
| `wordpress/2026/{07,08,09,10}` | 393 | khoảng 189 triệu | có: 389 dòng `media.url` dạng `admin.tunglamhoaphuc.com/wp-content/uploads/…` khớp |
| `site/images/lich-tu-hoc` | 12 | 7.323.488 | có: 12 dòng `media.url` dạng `/images/…` |

Đối chiếu bằng dữ liệu: dựng tập khóa R2 và tập `media.r2_key`/`media.url`, đối chiếu có xét mã hóa phần trăm; **20.830 trên 20.912 đối tượng được bảng `media` nhắc tới** (99,6%). 82 đối tượng còn lại (khoảng 29 MB) phần lớn là chênh lệch ký tự mã hóa (tên tệp tiếng Việt, ví dụ `Kỷ-niệm…` so với `K%E1%BB%B7…`) hoặc tệp tải lên mới (`s2-cnv03/uploads/…-17874…webp`) chưa vào bảng; **không có kho ảnh mồ côi đáng kể, không có gì để xóa ở đây**. 40 dòng `media.r2_key` không tìm thấy trong R2 chỉ do cùng nguyên nhân mã hóa; cần kiểm tay nếu muốn chắc.

Tải lên mới qua admin dùng tiền tố `cms/` (`src/admin/media/service.ts:67`); hiện chưa có tiền tố `cms/` nào trong R2.

## 4. KV, Queues, Durable Objects, Vectorize, Hyperdrive, Pages, Containers, Workflows

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| (không có) KV namespace | `cf kv namespaces list` = `[]` | | không binding KV trong cả hai `cloudflare.config.ts` | không có gì |
| (không có) Queues | `[]` | | | không có gì |
| (không có) Durable Objects | `[]`; `references.durable_objects` của cả 4 Worker rỗng. Hai export `VinextCachedResponse`/`VinextUncachedResponse` của vinext là cache Workers, không phải Durable Object | | `cloudflare.config.ts:54` | không có gì |
| (không có) Vectorize, Hyperdrive, Pages, Tunnels, Health Checks, Logpush, Images đã lưu (Cloudflare Images `images: []`) | tất cả trả rỗng | | | không có gì |
| Workers AI | không phải tài nguyên riêng; là binding `AI` trên `tlhp-web`, `tlhp-v3`, `tlhp-web-xem-thu` | **cả hai** (API tiếng Tạng: `src/app/api/analyze`, `ask-ai`, `crop-analyze`, `tts`, có giới hạn tần suất trong mã `@/libs/tibetan/server`); **V3** chỉ khai binding | `cloudflare.config.ts:32`; `E:\tlhp-v3-doc\cloudflare.config.ts:30` | **giữ** |

## 5. DNS của zone `tunglamhoaphuc.com` (12 bản ghi)

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| `tunglamhoaphuc.com` (apex) | AAAA `100::`, proxied | **www** (Custom Domain của Worker `tlhp-web`; trả 308 sang `www`; bản ghi do Cloudflare tạo ngày 20/11, thay A `76.76.21.21` về Vercel) | `cloudflare.config.ts:16`; `docs/van-hanh/dns-truoc-khi-chuyen-www-2026-11-20.zone` | **giữ** (không sửa tay; do Custom Domain quản lý) |
| `www.tunglamhoaphuc.com` | AAAA `100::`, proxied (Custom Domain) | **www** | như trên | **giữ** |
| `v2.tunglamhoaphuc.com` | AAAA `100::`, proxied (Custom Domain) | **www** (cùng Worker, trả cùng nội dung 200, 221.146 byte) | `cloudflare.config.ts:16` | **hỏi chủ**: `v2.` giờ trùng hệt `www`; vẫn là mục tiêu của `npm run deploy:v2` (tên tập lệnh), nên đừng gỡ khi chưa đổi cấu hình |
| `v3.tunglamhoaphuc.com` | AAAA `100::`, proxied (Custom Domain) | **V3** | `E:\tlhp-v3-doc\cloudflare.config.ts:16` | **giữ** |
| `beta.tunglamhoaphuc.com` | CNAME `cname.vercel-dns.com`, proxied | **KHÔNG RÕ**: site cũ trên Vercel, nằm sau Access (302 sang đăng nhập Access). Không mã nào trong 4 repo tham chiếu | `docs/van-hanh/admin-cu.md:12,46` | **hỏi chủ**: nếu bản beta cũ trên Vercel không còn cần thì xóa DNS + ứng dụng Access `Beta site cũ` cùng lúc |
| `admin.tunglamhoaphuc.com` | A `209.42.27.235`, proxied | **www** (gián tiếp): WordPress `My Blog`; còn 495 dòng `media` trỏ ảnh `admin…/wp-content/uploads/…` chưa có trong R2, nên route `/anh-goc/wordpress/…` rơi về máy chủ này | `src/libs/content/media.ts:16,107-108`; `src/libs/content/mediaRoute.ts:45-47`; đối chiếu D1 + R2 (mục 3) | **giữ** (hỏi chủ trước khi đổi). Nếu muốn gỡ: phải chép 495 ảnh WordPress vào R2 trước (`scripts/media-copy.ts`) |
| `old.tunglamhoaphuc.com` | A `209.42.27.235`, proxied | **KHÔNG RÕ**: cùng máy chủ với `admin.`, trang WordPress thật "Tùng Lâm Hoà Phúc - Chùa Hoà Phúc" (200, 177.652 byte). Không mã nào dùng | `docs/van-hanh/admin-cu.md:12` ("Máy chủ WordPress, không thuộc việc này") | **hỏi chủ** |
| `*.tunglamhoaphuc.com` | 2 A (`104.21.13.214`, `172.67.133.42`) + 2 AAAA, proxied (đều là IP của Cloudflare) | **KHÔNG RÕ**: wildcard, mọi tên lạ nhận trang 403 của Cloudflare (đã thử một tên ngẫu nhiên). Đã có từ lúc thêm zone (30/10) | `docs/van-hanh/admin-cu.md:13` | **hỏi chủ**: vô hại nhưng không thấy tác dụng; bản ghi riêng (`www`, `v3`…) vẫn thắng wildcard |
| `tunglamhoaphuc.com` | TXT `google-site-verification=…` | Google Search Console | | **giữ** |

Không có bản ghi MX, SPF, DKIM, DMARC, CAA. Không có `quantri.` (kế hoạch T21 phần 2, chưa làm).

## 6. Zero Trust Access và chứng chỉ

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| Team `lingering-heart-cb52` | Zero Trust Free (50 chỗ), phương thức đăng nhập một lần qua email | www/hạ tầng cũ | `docs/van-hanh/admin-cu.md:37` | giữ (chưa có lý do xóa) |
| Ứng dụng Access `Admin site cũ (www)` (`f9305e45-…`) | self-hosted, chặn `www…/admin`, `www…/login`, `www…/van-hanh`, phiên 24 giờ. **Vẫn hoạt động**: `www/login` và `www/admin` trả 302 sang trang đăng nhập Access | **KHÔNG RÕ**: site mới không dùng các đường dẫn này (admin ở `/quan-tri`); là mục tiêu `ACCESS_AUD` của `tlhp-admin-guard` | `docs/van-hanh/admin-cu.md:46,57`; `chuyen-www.md:22` | **hỏi chủ**: đã vô nghĩa sau khi www đổi site; có thể đổi thành chuyển hướng hoặc gỡ cùng `tlhp-admin-guard`. Nếu lùi về Vercel thì cần lại |
| Ứng dụng Access `Beta site cũ` (`1c0a226f-…`) | self-hosted, cả `beta.tunglamhoaphuc.com` | **KHÔNG RÕ** (theo DNS `beta`) | như trên | **hỏi chủ** (đi cùng DNS `beta`) |
| Chính sách `Quản trị TLHP – email được phép` | Allow đúng 1 email (database.tunglamhoaphuc@gmail.com), dùng chung 2 ứng dụng | | | giữ |
| Chứng chỉ SSL | 5 gói: universal (Let's Encrypt, `*.tunglamhoaphuc.com`, hết hạn 28/01/2027) + 4 gói advanced (Google, cho apex+`v2`, apex+`www`, apex+`*`, apex+`v3`; hết hạn 31/01 đến 20/02/2027) | tự quản, gắn với Custom Domain | | giữ (Cloudflare tự gia hạn) |
| Tên miền | Cloudflare Registrar, hết hạn **15/11/2027**, tự gia hạn bật, khóa chuyển nhượng bật, ẩn thông tin chủ | | | giữ |

## 7. Quy tắc, WAF, bộ nhớ đệm, chuyển hướng

| tên | loại | dùng bởi | bằng chứng | khuyến nghị |
|---|---|---|---|---|
| Rulesets do Cloudflare quản lý (4): Normalization, Managed Response Firewall Default, DDoS L7, Managed Free Ruleset | managed, mặc định của gói Free | | `cf rulesets list` | giữ |
| Quy tắc tùy chỉnh (WAF custom, Rate limiting, Cache rules, Config rules, Transform, Redirect Rules, Page Rules) | **không có** (các điểm vào `http_request_firewall_custom`, `http_ratelimit`, `http_request_cache_settings`, `http_config_settings`, `http_request_dynamic_redirect`, `http_request_transform` đều 404; `http_request_redirect` không áp ở mức zone) | | | không có gì. Mọi chuyển hướng/cache nằm trong mã Worker (`public/_headers`, `next.config.js`) |
| Firewall access-rules, UA rules, Lockdowns | `[]` | | | không có gì |
| Zaraz | Bật tự chèn mã nhưng **0 công cụ**, có 2 trigger mặc định | | `cf zaraz config get` | **hỏi chủ**: vô hại; có thể tắt tự chèn nếu không định dùng |
| Turnstile | `[]` | | | không có |
| Email Routing | `enabled: false`, `status: unconfigured` (bản ghi chỉ là mặc định, không do kiểm kê tạo) | | | không có |

## 8. Cài đặt zone đã đọc (không sửa)

`ssl=full` (không phải strict), `always_use_https=off`, `min_tls_version=1.0`, `tls_1_3=on`, `http3=on`, `brotli=on`, `security_level=medium`, `browser_check=on`, `email_obfuscation=on`, `automatic_https_rewrites=on`, `cache_level=aggressive`, `browser_cache_ttl=14400`, `challenge_ttl=1800`, `waf=off` (cài đặt WAF cũ, không phải ruleset), `rocket_loader=off`, `polish=off`, `mirage=off`, `early_hints=off`, `always_online=off`, `hotlink_protection=off`, `ipv6=on`. Header `Strict-Transport-Security: max-age=31536000` có ở `www` (đặt trong `next.config.js:19`), nhưng `http://www.tunglamhoaphuc.com/` vẫn trả 200 không chuyển hướng.

## 9. Gói cước và mức dùng

| mục | giá/chu kỳ | ghi chú |
|---|---|---|
| Workers Paid | 5 USD/tháng, gia hạn 02/12 | đang hiệu lực; admin cần gói này (CLAUDE.md) |
| R2 Paid | 0 USD cố định | trả theo mức dùng; 2,75 GiB nằm trong mức miễn phí |
| Cloudflare Free Plan (zone) | 0 USD | |
| Teams (Zero Trust) Free | 0 USD | 50 người dùng |
| Images/Stream Basic | 0 USD | không dùng |

Mức dùng thật (yêu cầu Worker, đọc/ghi D1, nơ-ron AI, ghi nhật ký): `cf billing usage` và `GET /zones/…/subscription` trả **403 Authentication error** với quyền hiện tại, nên không đọc được. Quan sát: `tlhp-web` 152.178 yêu cầu/7 ngày, `tlhp-v3` 13.319, `tlhp-web-xem-thu` 87, `tlhp-admin-guard` 893 (tất cả trước 20/11). Cả 4 Worker bật Workers Logs 100% mẫu, ghi mọi yêu cầu (`observability.logs.persist`), đáng để xem xét nếu hóa đơn tăng.

Thành viên tài khoản: 1 người (Super Administrator), **chưa bật xác thực hai lớp** (`two_factor_authentication_enabled: false`). Danh sách API token: không đọc được (403).

## 10. Cách kiểm kê và giới hạn

- Đã chạy: `cf workers list/get/versions list/deployments list`, `cf d1 list/get/query` (chỉ SELECT), `cf r2 buckets get/list/lifecycle/cors/domains/metrics`, `cf r2 objects list`, `cf kv/queues/durable-objects/vectorize/hyperdrive/pages list`, `cf dns records list`, `cf zero-trust access applications/policies list`, `cf rulesets list`, `cf zones get/settings get`, `cf ssl certificate-packs list`, `cf zaraz config get`, `cf accounts subscriptions/members list`, `cf o11y telemetry query` (đếm yêu cầu, đọc 5 sự kiện), `curl` các địa chỉ công khai.
- **Không đọc được bằng `cf`**: route theo zone, Cron Triggers, bảng điều khiển thanh toán, danh sách API token, Web Analytics (RUM), cấu hình Workers Builds. Nên đối chiếu trong Dashboard nếu cần chắc.
- Liệt kê R2 chỉ đọc khóa và kích thước (không tải đối tượng).

## 11. Ứng viên xóa (tất cả đều chờ chủ dự án đồng ý)

| ứng viên | dung lượng/chi phí | rủi ro | khuyến nghị |
|---|---|---|---|
| Worker `tlhp-web-xem-thu` (+ 2 phiên bản) | 0 USD cố định; chỉ tốn yêu cầu hiếm hoi. Lợi ích là đóng địa chỉ công khai `workers.dev` có binding Workers AI | rất thấp: bản chụp ngày 17/11, `todo.md:1201` đã hẹn xóa. Điều kiện: chủ đã xem xong; nội dung tương ứng đã nằm trên www | **xóa** sau khi chủ xác nhận |
| Worker `tlhp-admin-guard` (1 phiên bản) | 0 USD | thấp nhưng đây là phương án quay lại Vercel (`chuyen-www.md:50`); mã nguồn còn trong repo | **hỏi chủ** (xóa khi chốt không lùi về Vercel) |
| Ứng dụng Access `Admin site cũ (www)` và `Beta site cũ` + DNS `beta` | 0 USD | trung bình: nếu bản beta cũ trên Vercel vẫn còn được dùng, xóa sẽ làm nó công khai (hiện nằm sau Access) hoặc hỏng | **hỏi chủ** |
| DNS wildcard `*` (4 bản ghi) | 0 USD | thấp; đổi cách trả lời của tên lạ (từ 403 sang không phân giải) | **hỏi chủ**, không cần làm |
| Phiên bản Worker cũ `tlhp-web` #1–#48 (khoảng 48 phiên bản) | 0 USD | thấp; mất điểm quay lui cũ | không cần dọn; nếu dọn thì giữ 10 bản gần nhất + các mã trong d1.md |
| Zaraz tự chèn mã | 0 USD | thấp | hỏi chủ, không cần làm |

**Không có khoản tiết kiệm đáng kể**: toàn bộ tài khoản tốn khoảng 5 USD/tháng (Workers Paid) cộng mức dùng nhỏ. Không có gì nên xóa vì lý do chi phí. `tlhp-db`, `tlhp-media`, `tlhp-backup`, `tlhp-web`, `tlhp-v3`, các bản ghi `www`/`v3`/`v2`/apex và `admin.` (còn ảnh WordPress) **không** nằm trong danh sách xóa.

## 12. Điều bất ngờ và rủi ro cần chủ biết

1. **Chưa có bản sao lưu nào trên đám mây.** `tlhp-backup` có 0 đối tượng; cron chưa nối (`sao-luu.md:37`), và chưa ai bấm "Sao lưu vào kho lưu trữ ngay" (nhật ký `audit_log` chỉ có 30 dòng). D1 hiện chỉ có Time Travel của Cloudflare và bản sao cục bộ `data/sao-luu-d1/` (ghi ở `d1.md:90`, nằm ngoài git). Đề nghị: chạy một lần sao lưu thủ công và quyết định nối cron.
2. **`tlhp-web-xem-thu` mở công khai** trên `workers.dev` (trả 200), có binding `AI` và `MEDIA`. API AI có giới hạn tần suất trong mã nhưng đây là bề mặt thừa; còn 87 yêu cầu trong 7 ngày. (Đóng bằng cách xóa Worker, hoặc tắt workers.dev; việc đó là của chủ.)
3. **WordPress `admin.`/`old.` (209.42.27.235) còn là một phần phụ thuộc thật**: 495 dòng `media` (trong 884 dòng trỏ `admin…/wp-content/uploads/`) chưa có bản trong R2, trang vẫn kéo ảnh qua `/anh-goc/wordpress/…` về máy chủ này. Máy chủ ấy công khai `wp-json` và `wp-login.php` (`xmlrpc.php` trả 403), WordPress 7.1.5, tiêu đề mặc định "My Blog". Rủi ro bảo mật của máy chủ ngoài Cloudflare nằm ngoài tài khoản này. Nên chép 495 ảnh vào R2 (`scripts/media-copy.ts`) rồi mới tính chuyện tắt `admin.`. Ngoài ra 87 dòng `media` trỏ thẳng vào máy chủ báo chí/mạng xã hội bên thứ ba (infonet, tienphong, fbcdn…): ảnh có thể hỏng bất cứ lúc nào, không do ta kiểm soát.
4. **Cài đặt zone yếu**: `min_tls_version=1.0`, `ssl=full` (không xác thực chứng chỉ gốc; không ảnh hưởng nhiều vì Worker chạy trên Cloudflare, nhưng `admin.`/`old.` về máy chủ ngoài nên strict mới có ý nghĩa), `always_use_https=off` (http://www trả 200 thay vì chuyển sang https). HSTS đã có ở www nên người dùng cũ đã được ghim https.
5. **Tài khoản Cloudflare duy nhất chưa bật 2FA** và là Super Administrator, đồng thời là email duy nhất được Access cho vào các host cũ. Đề nghị bật 2FA.
6. **Chỉ có 1 tài khoản admin trong D1**, chưa có 2FA (`user_totp` rỗng), `revision` rỗng (chưa có bản phiên bản bài viết nào).
7. **Không có SPF/DKIM/DMARC/MX** cho `tunglamhoaphuc.com`: nếu admin gửi thư (đặt lại mật khẩu) từ tên miền này sẽ dễ vào thư rác và ai cũng giả mạo được. `setting` chưa có cấu hình SMTP (chỉ `home.hero`, `home.welcome`).
8. **Bí mật trong biến thường: không có.** Biến thường của `tlhp-web` chỉ là `ADMIN_BASE_URL` (địa chỉ, không bí mật) và `CONTENT_SOURCE`; bí mật nằm đúng loại `secret_text` (`ADMIN_ENC_KEY`, `ADMIN_JWT_SECRET`, chỉ tên). `tlhp-admin-guard` có biến thường `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`: là định danh Access, không phải bí mật. Cấu hình Zaraz có một khóa gỡ lỗi (`debugKey`, không ghi lại ở đây), không nhạy cảm.
9. **V3 cũng gọi Workers AI**: V3 có cùng 4 route API tiếng Tạng (`E:\tlhp-v3-doc\src\app\api\analyze`, `ask-ai`, `crop-analyze`, `tts`, đọc `AI` ở `src/lib/tibetan/server.ts:7`), nên www và V3 cùng tiêu nơ-ron AI của một tài khoản; giới hạn tần suất nằm trong mã từng Worker.
10. **Tài liệu chưa theo kịp**: `d1.md` mục 7 chưa ghi phiên bản đang chạy `edd6b3a4` (#70, 23/11 03:54) của www và `175a956a` (#10) của V3; CLAUDE.md liệt kê migration 0001–0004 trong khi D1 đã áp tới 0005. `v2.` và `www` cùng Worker nên trả cùng nội dung (221.146 byte), `v2.` không còn khác biệt so với www.
11. **`www/login`, `www/admin`, `www/van-hanh` vẫn bị Access chặn** (302 đến đăng nhập một lần qua email): người mở đường dẫn cũ thấy trang đăng nhập Access thay vì 404 hay chuyển hướng của site mới.
12. Lệnh `cf zones subscriptions get`, `cf billing usage get-v1`, `cf accounts tokens list` đều 403 với quyền OAuth hiện tại (hồ sơ `tlhp`): đây là giới hạn quyền, không phải lỗi.
