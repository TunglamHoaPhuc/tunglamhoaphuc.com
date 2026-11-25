# tunglamhoaphuc.com — hướng dẫn cho người và công cụ làm việc trong repo

Trang web chùa Tùng Lâm Hòa Phúc: trang công khai (Next.js App Router chạy bằng **vinext** trên Cloudflare Workers, giao diện Bexon + Bootstrap/SCSS) và **Admin CMS** tại `/quan-tri`.

## Cấu trúc thư mục

| Đường dẫn | Nội dung |
|---|---|
| `src/app/(home)`, `src/app/(site)` | Trang công khai |
| `src/app/quan-tri/` | Giao diện admin (`(khach)` chưa đăng nhập, `(khung)` có menu và phiên), CSS riêng `admin.css` (lớp `tq-*`) |
| `src/app/api/quan-tri/v1/[...path]/route.ts` | Cổng duy nhất của API admin; nối bindings Worker vào `dispatch` |
| `src/admin/` | Mã máy chủ của admin: `auth/` (mật khẩu, phiên, 2FA, đặt lại mật khẩu), `rbac/` (danh mục quyền, vai trò mẫu), `users/`, `media/`, `content/` (bài viết), `taxonomy/` (chuyên mục, menu, icon), `special/` (lịch, bảo tượng, trang chủ, lời Thầy), `ops/` (nhật ký, thùng rác, SEO, cấu hình, sao lưu), `audit/`, `mail/`, `http/` (bộ định tuyến, lỗi, phân trang) |
| `src/components/admin/` | Component giao diện admin |
| `src/libs/siteData.ts` | Trang công khai đọc cấu hình và menu do admin sửa (có dự phòng `src/config/site.ts`) |
| `src/db/schema.ts`, `migrations/` | Schema D1 và migration (0000 khởi tạo; 0001–0004 cho admin) |
| `scripts/` | `dev-db.ts` (D1 cục bộ), `import.ts` (nhập snapshot), `backfill-admin.ts`, … |
| `docs/admin-architecture.md` | Thiết kế admin đã duyệt; `docs/site-inventory.md` kiểm kê trang; `docs/van-hanh/` vận hành |
| `tests/unit`, `tests/e2e` | Vitest và Playwright |

## Biến môi trường và bí mật của admin

Chỉ tên biến, không bao giờ ghi giá trị vào repo. Cục bộ nằm trong `.dev.vars` (đã git-ignore).

| Biến | Việc |
|---|---|
| `ADMIN_JWT_SECRET` | Ký token truy cập (≥ 32 byte ngẫu nhiên) |
| `ADMIN_ENC_KEY` | Khóa AES-256 (base64 của 32 byte): mã hóa bí mật 2FA và mật khẩu SMTP |
| `ADMIN_BASE_URL` | Địa chỉ duy nhất mà admin trả lời, hiện là `https://quantri.tunglamhoaphuc.com`; ở tên miền khác admin trả 404 |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | Chỉ dùng khi tạo Super Admin đầu tiên (`--seed`); tài khoản đó bị buộc đổi mật khẩu ở lần đăng nhập đầu |

`cloudflare.config.ts` chỉ khai báo các biến trên khi chạy `vite dev` hoặc khi build với `TLHP_ADMIN=1`. **Admin chạy ở `https://quantri.tunglamhoaphuc.com` (Worker `tlhp-web`) từ 23/11/2026**; trang công khai `www` và apex thuộc Worker `tlhp-v3` (chỉ đọc D1/R2, không có admin), còn `v2.` trỏ `tlhp-web` (noindex, cửa lùi). Xem `docs/van-hanh/d1.md` mục 7 và `docs/van-hanh/chuyen-v3-lam-site-chinh.md`. **Mọi lần deploy `tlhp-web` phải giữ cả hai biến**, từ một worktree sạch, và **kiểm `www` còn thuộc `tlhp-v3` trước khi deploy**: `TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com npm run deploy:v2`. Thiếu chúng thì `/api/quan-tri` trả `503` ("thiếu: ADMIN_BASE_URL") và không đăng nhập được (đã xảy ra sau một lần deploy 22/11). Mật khẩu băm Argon2id tốn 236–605 ms CPU mỗi lần, nên admin cần gói Workers Paid, đang có hiệu lực; không đổi gói cước.

## Lệnh

```powershell
npm run dev                         # trang + admin ở http://localhost:3001
npm run dev:db -- --init --seed     # (dừng npm run dev trước) áp migration vào D1 CỤC BỘ, tạo .dev.vars, tạo Super Admin đầu tiên
npm run dev:db                      # chỉ áp migration mới vào D1 cục bộ
npm run db:generate                 # sinh migration từ src/db/schema.ts (phần dữ liệu thêm tay vào tệp SQL)
npm run import -- --from=snapshot --db=<tệp.sqlite> --migrate   # nhập snapshot vào một tệp SQLite
npm run backfill:admin              # ghi nhận ảnh nằm trong nội dung bài vào media_usage (D1 cục bộ)
npm run typecheck && npm run lint && npm test
npm run test:e2e                    # Playwright
```

Tài khoản đăng nhập thử cục bộ nằm trong `.dev.vars` (`ADMIN_SEED_*`); sau khi đổi mật khẩu trên giao diện, cập nhật lại dòng đó nếu cần.

## Quy ước làm việc

- Admin chỉ thêm migration mới, không sửa `0000`. Migration chạy được trên dữ liệu thật: thử bằng cách nhập `data/snapshot` vào một tệp SQLite rồi áp migration.
- Mọi thao tác ghi của admin là một `db.batch` gồm thay đổi + dòng nhật ký (+ bản phiên bản nếu là nội dung); sửa đồng thời được chặn bằng cột `version`.
- Kiểm quyền ở máy chủ (`needs` của route, và quyền "của mình" kiểm trong handler); giao diện chỉ ẩn nút.
- Không bao giờ chạy migration, seed hay deploy lên D1/Worker thật mà chưa được chủ dự án đồng ý; không đổi gói cước Cloudflare.
- Chỉ stage tệp theo từng đường dẫn khi commit (cây làm việc có thể chứa việc dở của người khác).
- Nội dung chữ trong giao diện là tiếng Việt có dấu đầy đủ; không dùng cửa sổ bật, toast hay `window.confirm` (phản hồi là khối nằm trong luồng trang).

## Vận hành admin

Xem `docs/admin-architecture.md` (thiết kế), `docs/van-hanh/` (D1, ảnh, sao lưu, chuyển www). Các tài khoản, vai trò và quyền quản lý tại `/quan-tri/tai-khoan` và `/quan-tri/vai-tro`; nhật ký tại `/quan-tri/nhat-ky`; thùng rác tại `/quan-tri/thung-rac`.

## Trình soạn thảo bài viết (nhánh feat/admin-editor-optimization)

- `src/components/admin/content/RichEditor.tsx` + `editorExtensions.ts`: TipTap với phông (3 phông cố định), cỡ chữ, màu chữ, tô sáng, căn lề, thụt lề, giãn dòng, sub/sup, bảng (gộp/tách ô), ảnh có độ rộng và căn lề, liên kết nofollow, dán sạch từ Word/Docs (`cleanPastedHtml`), đếm từ, mục lục tiêu đề.
- Định dạng được lưu là `style` nội tuyến, và **chỉ** những thuộc tính trong `safeStyle` (`src/admin/content/html.ts`) được máy chủ giữ; thêm một kiểu định dạng mới phải thêm ở đó kèm test (`tests/unit/admin/content-style.test.ts`). Trang V3 là repo riêng, hiển thị các style này qua HTML đã lọc.
- `localDraft.ts`: bản nháp thân bài trên trình duyệt (3 giây sau khi ngừng gõ), không bao giờ tự gửi lên máy chủ.
- Danh sách bài có chọn nhiều và xuất bản/xóa hàng loạt; chạy từng bài qua endpoint đơn nên quyền và phiên bản kiểm từng bài.
- e2e: `tests/e2e/admin/editor-format.spec.ts`. Chạy trên bản build (`TLHP_ADMIN=1 TLHP_CONTENT_SOURCE=d1 ADMIN_BASE_URL=http://localhost:3021 npx vite build --config vite.e2e.config.ts`, rồi `vite preview --config vite.e2e.config.ts --port 3021`, `.dev.vars` cùng địa chỉ). Dev server không dùng được cho e2e admin.
- Checklist (TaskList/TaskItem) đã có; HTML lưu `ul[data-type=taskList] > li[data-type=taskItem][data-checked]`, trang công khai và V3 cần CSS riêng để vẽ ô tích. Thư viện Media đã tải lười, bộ chọn chỉ dựng khi mở.
- Giao diện admin thu nhỏ 7% bằng `--tq-zoom: 0.93` (admin.css; mọi `100vh` chia cho biến này). Thanh lọc `role="search"` là lưới chia đều; danh sách bài thêm `tq-toolbar--row` để nằm một hàng từ 1100px.
- Chưa làm: mục lục tự động trên trang công khai (mã trang công khai và V3 do phiên khác giữ).
