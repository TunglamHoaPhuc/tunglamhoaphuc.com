# Khóa trang quản trị site cũ (T21 · HT-01)

> Cập nhật 02/11/2026. Liên quan: [tasks/todo.md](../../tasks/todo.md) T21, [hồ sơ đặc tả – Cảnh báo bảo mật](../../dac-ta-ky-thuat-tunglamhoaphuc.md).

## 1. Hiện trạng đã kiểm (02/11/2026)

### Các host đang chạy site cũ (Next.js trên Vercel)

| Host | DNS | `/admin`, `/login` |
|---|---|---|
| `www.tunglamhoaphuc.com` | CNAME `cname.vercel-dns.com` (proxied) | `/admin` chuyển sang `/login`, trang đăng nhập mở công khai |
| `beta.tunglamhoaphuc.com` | CNAME `cname.vercel-dns.com` (proxied) | Chạy nguyên bản site cũ, `/login` mở công khai |
| `tunglamhoaphuc.com` | A `76.76.21.21` (Vercel, proxied) | Chuyển hướng 308 sang `www` |
| `*.tunglamhoaphuc.com` | A/AAAA về IP Cloudflare | Trả 403, không chạy site |
| `admin.`, `old.` | A `209.42.27.235` | Máy chủ WordPress, không thuộc việc này |
| `v2.` | Worker `tlhp-web` | Site mới (đang xem thử) |

### Site công khai cũ đọc dữ liệu qua API admin

Site cũ lấy dữ liệu công khai bằng các lệnh **GET vào `/api/admin/*`** ngay từ trình duyệt người đọc. Vì vậy **không thể khóa trọn `/api/admin*` bằng Cloudflare Access**: làm vậy sẽ hỏng trang chủ và các trang chi tiết.

| Trang công khai | API admin được gọi |
|---|---|
| Trang chủ | `GET /api/admin/schedule` |
| Danh sách Dòng Chảy, Trí Tuệ | `GET /api/admin/posts?category=…` |
| Chi tiết bài Dòng Chảy | `GET /api/admin/posts/<slug>` |
| Chi tiết Tông Chỉ | `GET /api/admin/tong-chi`, `GET /api/admin/tong-chi/<slug>` |
| Chi tiết Giới thiệu | `GET /api/admin/gioi-thieu/<slug>?sync=true` |
| Lượt xem | `POST /api/public/increment-view` (không thuộc admin) |

Trang Vũ Trụ, Bảo Tượng render phía server, không gọi API từ trình duyệt.

⚠️ **Cần chú ý:** trang Giới thiệu công khai gửi `?sync=true` mỗi lần có người đọc mở trang. Nếu tham số này kích hoạt đồng bộ từ WordPress, dữ liệu bị ghi lại sau mỗi lượt đọc. Chưa xác minh được (không có mã nguồn). Lớp chặn dưới đây vẫn cho lệnh này đi qua để không làm hỏng trang.

### Cloudflare Zero Trust

Bật ngày 02/11/2026 trên tài khoản sở hữu zone (`b91a395bd9b7ab86ef4cba41d1d828ae`), gói Zero Trust Free. Tên nhóm do Cloudflare tự đặt: `lingering-heart-cb52` → trang đăng nhập `https://lingering-heart-cb52.cloudflareaccess.com`. Đổi tên nhóm (Zero Trust → Settings) thì phải sửa `ACCESS_TEAM_DOMAIN` của Worker và deploy lại.

## Đã cấu hình (02/11/2026)

| Thành phần | Tên | ID |
|---|---|---|
| Phương thức đăng nhập | Mã một lần qua email (One-time PIN) | `5c305134-6822-4cf7-9cd0-153a7ef25e4e` |
| Chính sách dùng chung | Quản trị TLHP – email được phép (Allow `database.tunglamhoaphuc@gmail.com`, phiên 24 giờ) | `30991a9d-4647-453e-8a98-4193f596f7f7` |
| Ứng dụng Access | Admin site cũ (www): `www…/admin`, `www…/login`, `www…/van-hanh` | `f9305e45-ae41-497d-b72a-fb095ad5a500`, aud `132420dfd3a001eb302b1545c9c347c40006c6354281c083869d58c9f919070a` |
| Ứng dụng Access | Beta site cũ: toàn bộ `beta.tunglamhoaphuc.com` | `1c0a226f-2d52-4793-973a-4eca8738e955` |
| Worker | `tlhp-admin-guard`, route `www.tunglamhoaphuc.com/api/*`, có Workers Logs | phiên bản `1f01627e-0920-450f-8cf3-05a9943e7639` |

Thêm người được vào admin: Zero Trust → Access → Policies → "Quản trị TLHP – email được phép" → thêm email (áp cho cả 2 ứng dụng).

## 2. Cách khóa

| Lớp | Phạm vi | Tác dụng |
|---|---|---|
| Cloudflare Access – ứng dụng "Admin site cũ" | `www.tunglamhoaphuc.com/admin`, `www.tunglamhoaphuc.com/login`, `www.tunglamhoaphuc.com/van-hanh` | Chỉ email được phép mới mở được giao diện quản trị và trang đăng nhập cũ (che luôn khối "Tài khoản mặc định" và nút "Đăng nhập nhanh") |
| Cloudflare Access – ứng dụng "Beta site cũ" | toàn bộ `beta.tunglamhoaphuc.com` | Khóa hẳn host beta |
| Worker `tlhp-admin-guard` | route `www.tunglamhoaphuc.com/api/*` | Cho qua các lệnh đọc mà site công khai cần. Mọi lệnh ghi (POST, PUT, PATCH, DELETE) và mọi endpoint có tác dụng phụ (`sync-wp`, `wp-post-create`, `wp-media`, `repair-links`, `upload`, `fetch-metadata`) phải kèm phiên đăng nhập Access hợp lệ (cookie `CF_Authorization`, kiểm chữ ký với khóa công khai của nhóm và mã `aud` của ứng dụng "Admin site cũ"). Thiếu thì trả 403 và ghi log |

Người được phép (02/11/2026): `database.tunglamhoaphuc@gmail.com`. Đăng nhập bằng mã một lần gửi qua email. Thêm người trong Zero Trust → Access → Policies.

Mã nguồn Worker: [workers/admin-guard/](../../workers/admin-guard/) (43 test: `npm test`).

## 3. Kết quả kiểm tra (02/11/2026)

Lệnh ghi được thử vào đường dẫn không tồn tại (`/api/admin/khong-ton-tai-guard-test`): nếu lọt tới máy chủ cũ thì chỉ nhận 404, không đụng dữ liệu thật.

| Kiểm tra | Kết quả |
|---|---|
| `www…/admin`, `www…/admin/posts`, `www…/login`, `beta…/`, `beta…/login` chưa đăng nhập | ✅ 302 sang trang đăng nhập Access |
| `www…/administrator` | ✅ site cũ chuyển sang `/login`, rồi bị Access chặn |
| Trang chủ (khối Lịch tu học PL 2570), bài Dòng Chảy, bài Tông Chỉ, trang Giới thiệu | ✅ hiện đủ; mọi lệnh `/api/admin/*` của trang trả 200 |
| `POST`, `DELETE` vào `/api/admin/*` không có phiên, hoặc với cookie giả | ✅ 403 từ Worker |
| `GET /api/admin/sync-wp…`, `GET /api/admin/upload…` không có phiên | ✅ 403 từ Worker |
| Mẹo đường dẫn `//api/admin`, `/api//admin` | ✅ 403 từ Worker |
| `/API/admin/…`, `/api/ADMIN/…` (không qua route của Worker) | ✅ máy chủ cũ trả 404, không chạm API |
| `/api%2Fadmin/…`, `/%61pi/admin/…` (không qua route của Worker) | ✅ máy chủ cũ trả trang lỗi 500, không chạm API |
| Chủ tài khoản đăng nhập Access, mở admin, sửa và lưu một bài | ✅ lưu được (chủ tài khoản xác nhận 02/11) |

Nếu sau này lưu bài báo lỗi "Kính mời quý vị đăng nhập trang quản trị trước khi thực hiện thao tác này": phiên Access chưa đi kèm lệnh gọi API. Gỡ tạm route của Worker (mục 4) để Ban Biên Tập làm việc, rồi xem log Worker (Workers → `tlhp-admin-guard` → Logs, dòng `blocked admin API call`, trường `hadToken`).

## 4. Quay lại như cũ

- Gỡ route `www.tunglamhoaphuc.com/api/*` của Worker `tlhp-admin-guard` (Workers → `tlhp-admin-guard` → Settings → Domains & Routes), hoặc xóa Worker.
- Tắt hoặc xóa 2 ứng dụng Access trong Zero Trust → Access → Applications.

## 5. Phần còn lại của T21 (trước khi chuyển `www` ở T22)

- Gắn `quantri.tunglamhoaphuc.com` vào project Vercel của site cũ, thêm bản ghi DNS `quantri` (proxied), đặt toàn bộ host sau Access.
- Bật Vercel Deployment Protection cho các địa chỉ `*.vercel.app`.
- Cần người có quyền vào project Vercel (chuẩn bị #5 trong plan.md).
- Khi chuyển `www` sang site mới (T22): gỡ route của `tlhp-admin-guard` trên `www`. Ở `quantri.` không cần Worker này vì toàn bộ host đã nằm sau Access.
