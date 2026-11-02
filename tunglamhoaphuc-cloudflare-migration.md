# Dự án: Chuyển hạ tầng web Tùng Lâm Hòa Phúc sang Cloudflare

> Ghi chú phiên làm việc ngày 31/10/2026. Dùng file này làm ngữ cảnh khi tiếp tục trò chuyện.

---

## 1. Mục tiêu

Chuyển toàn bộ website **https://www.tunglamhoaphuc.com/** sang hạ tầng Cloudflare, giống mô hình web Novamed:

- **Cloudflare Workers**: chạy Next.js (web + admin)
- **Cloudflare R2**: lưu trữ ảnh
- **Cloudflare D1**: cơ sở dữ liệu

---

## 2. Hiện trạng đã khảo sát (qua Chrome extension)

### 2.1. Nền tảng web
- Website **đã chạy Next.js**: có `/_next/static/chunks`, build bằng Turbopack, dùng React Server Components (`?_rsc=`).
- Trang admin `/admin` cũng là Next.js, có API riêng `/api/admin/upload?path=...` (GET trả về danh sách `folders` và `files`).
- Vẫn còn phụ thuộc **WordPress** tại `admin.tunglamhoaphuc.com`: trang chủ còn lấy ảnh từ domain này, và admin có mục "Ảnh mới tải lên WordPress".
- Domain đã nằm trên Cloudflare (đã xác minh 02/11/2026, xem mục 9).
- Next.js hiện host trên **Vercel**: `www` và `beta` CNAME tới `cname.vercel-dns.com`, response có header `x-vercel-id`.

### 2.2. Kho ảnh (Backblaze B2)
- Region: `us-east-005` (Mỹ).
- 2 bucket:
  - `tunglamhoaphuc2`: admin đọc (`s2-cnv03.s3.us-east-005.backblazeb2.com`)
  - `media-tunglamhoaphuc`: website công khai đọc (`media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com`)
  - ⚠️ Cần kiểm tra 2 bucket có đồng bộ với nhau không.
- Kho được map thành **Ổ Z:** trên máy (nhiều khả năng qua rclone hoặc công cụ tương tự).

| Chỉ số | Giá trị |
|---|---|
| Tổng số file | 2.820 file / 96 thư mục |
| Tổng dung lượng | ~1,16 GB |
| Trung bình | ~420 KB/file |
| File lớn nhất | 7,74 MB |
| Định dạng | 1.626 WebP · 1.168 JPG/JPEG · 9 PNG · 3 GIF · 1 SVG · 13 JSON |
| Phân bổ kích thước | 577 file <100 KB · 1.426 file 100–500 KB · 483 file 500 KB–1 MB · 330 file 1–3 MB · 4 file >3 MB |

**Theo thư mục gốc:**

| Thư mục | Số file | Dung lượng |
|---|---|---|
| 01-trang-chu | 17 | 3,3 MB |
| 02-tong-chi-tu-hoc | 160 | 30,6 MB |
| 03-dong-chay-hoang-phap | 1.198 | 771,4 MB |
| 04-vu-tru-phat-giao | 292 | 44,2 MB |
| 05-bao-tuong-phat-giao | 748 | 242,3 MB |
| 06-33-ung-hoa-than-duc-quan-am | 64 | 10,5 MB |
| 07-anh-tho-cac-vi-cao-tang | 275 | 25,4 MB |
| 08-tu-an-book | 31 | 15,8 MB |
| 09-icon-minh-hoa | 22 | 1,6 MB |
| database (13 file JSON, có thể là CSDL hiện tại) | 13 | 11,9 MB |

*(Thư mục `10-uploads` có trong giao diện admin nhưng không xuất hiện ở cấp gốc của API, có thể đang trống.)*

### 2.3. Nội dung & lưu lượng (dashboard admin)
- Tổng lượt xem toàn web: **923.233**
- Dòng Chảy Hoằng Pháp: 475 bài · Tông Chỉ Tu Học: 25 bài · Trí Tuệ Phật Pháp: 158 bài · Bảo Tượng: 126 tôn tượng (15 cụm)
- Lượt xem được đếm real-time khi người đọc mở bài.

### 2.4. Vấn đề phát hiện
1. **Ảnh tải trực tiếp từ B2 ở Mỹ, không qua CDN**, nên chậm với người đọc Việt Nam. Trang `/bao-tuong` tải 109 ảnh cùng lúc.
2. **Rủi ro phí egress B2**: B2 chỉ miễn phí lượng tải ra khoảng 3 lần dung lượng lưu trữ (~3,5 GB/tháng).
3. **Không resize ảnh**: thumbnail tải bản gốc, có file 1–2 MB.
4. Còn 1.168 file JPG chưa chuyển sang WebP.

---

## 3. Kết luận về Cloudflare Images

- Cloudflare Images **đáp ứng được dung lượng** (giới hạn 10 MB/ảnh; kho chỉ dùng chưa tới 3% gói 100.000 ảnh).
- **Không khuyến nghị dùng**, vì 3 lý do:
  - Không tương thích S3, nên mất quy trình Ổ Z:
  - Không lưu được file JSON
  - Phải viết lại module admin
- **Thay thế bằng R2 + Image Transformations.**

---

## 4. Kiến trúc đích

| Thành phần | Sau chuyển đổi |
|---|---|
| Next.js (web + admin) | Cloudflare Workers qua `@opennextjs/cloudflare` (không dùng Pages / `next-on-pages`, đã ngừng phát triển) |
| Kho ảnh | R2 + custom domain `media.tunglamhoaphuc.com` |
| Resize/nén ảnh | Image Transformations (`/cdn-cgi/image/width=...,format=auto/...`) |
| Dữ liệu | D1 (SQLite) + Drizzle ORM |
| Nội dung WordPress | Xuất sang D1 + R2, sau đó tắt WordPress |
| Bảo vệ admin | Cloudflare Access (Zero Trust) cho `/admin/*` và `/api/admin/*` |
| Cache ISR | R2 incremental cache + D1 tag cache (OpenNext) |

---

## 5. Lộ trình 4 giai đoạn (ước tính tổng 1,5–3 tuần)

### Giai đoạn 1: Kho ảnh sang R2 (1–2 ngày) ⭐ Làm trước
- [ ] Tạo bucket R2
- [ ] Copy dữ liệu từ 2 bucket B2 (Super Slurper hoặc rclone)
- [ ] Gắn custom domain `media.tunglamhoaphuc.com`, bật Image Transformations
- [ ] Đổi cấu hình Ổ Z: sang endpoint R2

### Giai đoạn 2: Dữ liệu sang D1 (2–4 ngày)
- [ ] Thiết kế schema: `posts`, `categories`, `statues`, `books`, `views`, `media`…
- [ ] Script import từ 13 file JSON và từ WordPress (REST API hoặc export XML)
- [ ] Viết lại URL ảnh trong nội dung bài viết sang `media.tunglamhoaphuc.com`

### Giai đoạn 3: Chuyển code lên Workers (3–7 ngày)
- [ ] Cài `@opennextjs/cloudflare`, tạo `wrangler.jsonc` (binding R2, D1, Images; bật `nodejs_compat`)
- [ ] Thay chỗ đọc/ghi JSON và SDK B2 bằng binding D1/R2
- [ ] Viết lại tầng upload và nén WebP (xem rủi ro bên dưới)
- [ ] Thêm Cloudflare Access cho admin
- [ ] Tái sử dụng cấu hình từ dự án Novamed nếu có

### Giai đoạn 4: Chạy thử & chuyển DNS (1–2 ngày)
- [x] Tạo subdomain chạy thử `v2.tunglamhoaphuc.com` (thay cho `staging.`), gắn Worker `tlhp-web` (02/11/2026, xem mục 9)
- [ ] Deploy ứng dụng mới lên `v2.tunglamhoaphuc.com`, kiểm tra từng chuyên mục
- [ ] Tạo bảng redirect 301 từ URL WordPress cũ để giữ SEO
- [ ] Chuyển route domain chính sang Worker
- [ ] Giữ B2 và WordPress ở chế độ chỉ đọc 2–4 tuần rồi mới tắt

---

## 6. Rủi ro kỹ thuật

| Rủi ro | Mức độ | Cách xử lý |
|---|---|---|
| Nén WebP nhiều khả năng dùng `sharp`, không chạy được trên Workers | 🔴 Cao | Nén phía trình duyệt (canvas / jSquash WASM) hoặc dùng Images binding |
| Code dùng `fs` / đọc file JSON | 🔴 Cao | Viết lại sang D1/R2 |
| Giới hạn kích thước Worker (10 MB nén, gói Paid) | 🟡 TB | Tách thư viện nặng nếu vượt |
| Build Turbopack chưa chắc tương thích OpenNext | 🟡 TB | Chưa xác minh; nếu lỗi thì build bằng webpack |
| Mất SEO khi bỏ URL WordPress | 🟡 TB | Redirect 301 đầy đủ |
| Đếm lượt xem real-time ghi vào D1 | 🟢 Thấp | D1 đủ đáp ứng; có thể gộp ghi theo lô |

---

## 7. Chi phí ước tính/tháng

| Hạng mục | Ước tính |
|---|---|
| Workers Paid | $5 |
| R2 (~1,2 GB, dưới mức miễn phí 10 GB; egress = 0) | $0 |
| D1 | $0 (nằm trong gói) |
| Image Transformations | ~$0–2 |
| Cloudflare Access | $0 |
| **Tổng** | **~$5–7** |

*Giá theo thông tin đến giữa 2026; cần đối chiếu lại trên trang giá của Cloudflare.*

---

## 8. Việc còn mở, cần trả lời ở lần tới

1. **Mã nguồn web đang ở đâu?** (repo GitHub, hay chỉ có trên máy)
2. ~~Next.js hiện đang host ở đâu?~~ Đã trả lời: Vercel (mục 2.1).
3. Có sẵn cấu hình `wrangler` / schema D1 từ dự án Novamed để tái sử dụng không?
4. Nén WebP hiện dùng thư viện gì?
5. 2 bucket B2 (`tunglamhoaphuc2` và `media-tunglamhoaphuc`) có đồng bộ với nhau không?
6. Lượng nội dung còn lại trên WordPress là bao nhiêu?

**Gợi ý:** việc sửa code trên toàn repo (Giai đoạn 2–3) nên thực hiện bằng **Claude Code**.

---

## 9. Tài khoản Cloudflare và kết nối trình duyệt

> Cập nhật 02/11/2026. Không ghi mật khẩu hay token vào file này.

### 9.1. Tài khoản giữ tên miền

| Mục | Giá trị |
|---|---|
| Người dùng Cloudflare | `database.tunglamhoaphuc@gmail.com` |
| Tài khoản giữ zone | **Database.tunglamhoaphuc@gmail.com's Account** · ID `b91a395bd9b7ab86ef4cba41d1d828ae` |
| Tài khoản thứ hai (đang trống) | Tùng lâm Hòa Phúc · ID `51a3209462b01ebcfe76b0a133789bd6` |
| Zone | `tunglamhoaphuc.com` · gói Free · nameserver `aaden` / `dara.ns.cloudflare.com` |

⚠️ Worker muốn gắn Custom Domain phải nằm **cùng tài khoản với zone**, nên mọi Worker, R2, D1 của TLHP tạo trong tài khoản `b91a…`, không tạo ở tài khoản Novamed hay Ngọc Tín.

- **Quyết định 02/11/2026:** giữ code mới (Worker, R2, D1) ở tài khoản giữ zone `b91a…`. Đã cân nhắc chuyển sang tài khoản "Tùng lâm Hòa Phúc" nhưng không làm, vì phải chuyển cả đăng ký tên miền (Cloudflare Registrar) và làm mất toàn bộ cấu hình zone.
- Tên miền đăng ký qua **Cloudflare Registrar** ở tài khoản `b91a…`, hết hạn **15/11/2026**, đang bật tự gia hạn. Cần có phương thức thanh toán hợp lệ ở tài khoản này.

### 9.2. Kết nối trình duyệt (Claude in Chrome)

- Hồ sơ Chrome tên **"TLHP"** đang đăng nhập Cloudflare bằng `database.tunglamhoaphuc@gmail.com`. Khi Claude cần thao tác trên dashboard hoặc duyệt đăng nhập CLI, chọn trình duyệt này (`select_browser` theo tên "TLHP").
- Các hồ sơ Chrome khác đang kết nối: "Hiếu PC - Home" (Cloudflare `hieupq3010.work@gmail.com`, chỉ thấy tài khoản Novamed và Ngọc Tín), "Home", "Ngọc Tín", "Ngọc Tín - Work", "ASUS", "Asus". Không dùng các hồ sơ này cho TLHP.

### 9.3. Đăng nhập dòng lệnh

- Dùng `cf` CLI (cài global, gọi bằng `cf` hoặc `cloudflare`), hồ sơ đăng nhập **`tlhp`** đã gắn với thư mục `E:\tung-lam-hoa-phuc`.
- Do người dùng thấy 2 tài khoản, mỗi lệnh cần chỉ rõ tài khoản:

```bash
export CLOUDFLARE_ACCOUNT_ID=b91a395bd9b7ab86ef4cba41d1d828ae
```

- Chạy ngoài thư mục dự án thì thêm `--profile tlhp`.
- Đăng nhập lại khi hết hạn: `cf auth create tlhp --no-browser`, mở link hiện ra trong Chrome "TLHP", chỉ chọn tài khoản cần dùng rồi bấm Authorize.
- Wrangler trên máy đang đăng nhập `hieupq3010.work@gmail.com` (Novamed), **không** thấy zone TLHP. Không đổi đăng nhập Wrangler để tránh ảnh hưởng dự án Novamed.

### 9.4. Trạng thái DNS và Worker

| Bản ghi | Trỏ tới |
|---|---|
| `tunglamhoaphuc.com` | A `76.76.21.21` (Vercel) |
| `www`, `beta` | CNAME `cname.vercel-dns.com` (Vercel) |
| `admin`, `old` | A `209.42.27.235` (WordPress cũ) |
| `*` (wildcard) | A/AAAA proxied |
| `v2` | Custom Domain của Worker **`tlhp-web`** (Cloudflare tự quản lý bản ghi và SSL) |

- `tlhp-web` hiện là trang chờ: trả `x-robots-tag: noindex, nofollow`, `robots.txt` chặn toàn bộ, tắt `workers.dev`.
- Khi xong T1, deploy ứng dụng Next.js (OpenNext) vào **cùng tên Worker `tlhp-web`** trong tài khoản `b91a…` để giữ nguyên domain `v2`. Giữ noindex cho tới khi chuyển `www` sang Worker.
