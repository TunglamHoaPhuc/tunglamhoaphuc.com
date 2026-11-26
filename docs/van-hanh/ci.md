# Kho mã GitHub, CI và deploy tự động (T1b)

> Cập nhật 17/11/2026. Liên quan: [tasks/todo.md](../../tasks/todo.md) T1b, HT-02, Câu hỏi mở #7.
> **Chưa chạy thử:** kho GitHub chưa có, nên hai workflow dưới đây chưa từng chạy trên GitHub. Phần lệnh bên trong (lint, test, build, deploy, e2e) đã chạy được trên máy.

## 1. Đã có trong mã

| File | Việc |
|---|---|
| `.github/workflows/ci.yml` | Mỗi pull request và mỗi lần đẩy vào `main`: job `check` (lint, kiểm kiểu, test đơn vị, build) và job `e2e` (toàn bộ e2e, máy tính và điện thoại, trừ nhóm ảnh mẫu `visual`) |
| `.github/workflows/deploy-v2.yml` | Chạy tay (không còn tự chạy khi đẩy vào `main`): test đơn vị rồi `npm run deploy:v2` với `TLHP_ADMIN=1` và `ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com`. Worker `tlhp-web` chỉ còn phục vụ admin; `v2.` đã gỡ ngày 25/11/2026, www do Worker `tlhp-v3` phục vụ |
| `.github/actions/snapshot/action.yml` | Đặt `data/snapshot/*.json` vào chỗ (không nằm trong git, nhưng bản build gói chúng vào Worker): lấy từ cache theo tuần, không có thì `npm run snapshot:fetch -- --albums` |

Chỉ bước deploy của `deploy-v2.yml` được đọc hai secret Cloudflare; pull request từ nhánh khác không bao giờ thấy chúng.

## 2. Việc của chủ site (không làm thay được)

1. **Tạo kho GitHub riêng tư** bằng tài khoản của chùa (HT-02), thêm người của đội kỹ thuật. Đội kỹ thuật đẩy mã lên; zip Bexon, `reference/`, `.dev.vars*`, `data/snapshot/` đã nằm trong `.gitignore` (kiểm bằng `git ls-files`: không có file nào trong số đó).
2. **Tạo API token Cloudflare** chỉ cho đúng việc deploy, trong tài khoản sở hữu zone (`b91a395bd9b7ab86ef4cba41d1d828ae`): quyền sửa Workers Scripts của tài khoản và quyền Workers Routes của zone `tunglamhoaphuc.com`. Tài liệu Cloudflare về CI không liệt kê quyền cụ thể, nên danh sách này cần xác nhận ở lần deploy đầu; thiếu quyền thì lệnh báo đúng tên quyền thiếu. Đừng dùng khóa toàn quyền (Global API Key).
3. **Lưu hai secret** trong GitHub (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` (giá trị là id tài khoản ở trên).
4. **Bật bảo vệ nhánh `main`** (Settings → Branches → Add rule): bắt buộc pull request, bắt buộc hai job `Lint, types, unit tests, build` và `End-to-end tests (desktop and phone)` xanh trước khi gộp. Đây là cài đặt duy nhất khiến "test hỏng thì không gộp được" thành thật.

## 3. Việc của đội kỹ thuật sau khi có kho

1. Đẩy mã, mở pull request thử có một test cố ý hỏng: CI phải đỏ và nút gộp bị khóa. Sửa test: CI xanh. Gộp: `v2.` đổi phiên bản trong tối đa 10 phút (đối chiếu ID phiên bản bằng `npx cf workers deployments list --worker tlhp-web --profile tlhp`).
2. Nếu job `e2e` hơn 40 phút hoặc chập chờn trên máy chủ GitHub, giảm `--workers` hoặc chạy chỉ bộ `smoke seo` cho pull request và bộ đủ khi gộp.

## 4. Giới hạn đã biết

- **Snapshot lấy từ release `snapshot-data`** (24/11/2026): `www` đã chuyển sang site mới nên `snapshot:fetch` nhận 404. Action tải `snapshot.tar.gz` từ release đó bằng `GITHUB_TOKEN` rồi giải nén vào `data/snapshot/`. Repo đang công khai nên gói này ai cũng tải được (nội dung vốn đã công khai trên web). Cập nhật gói: `tar -czf snapshot.tar.gz *.json` trong `data/snapshot/` rồi `gh release upload snapshot-data snapshot.tar.gz --clobber`.
- Bản build của CI có thể mang dữ liệu mới hơn bản build trên máy vì snapshot được lấy lại mỗi tuần.
- Chạy cùng lúc nhiều lần deploy bị xếp hàng, không hủy giữa chừng (`cancel-in-progress: false`).
