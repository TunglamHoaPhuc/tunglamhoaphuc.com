# Sao lưu và khôi phục

Bản sao lưu là **một tệp `.json.gz`** chứa mọi bảng của cơ sở dữ liệu (D1), mỗi bảng gồm danh sách cột và các dòng. Tệp được tạo từng trang 500 dòng (bảng có dòng lớn như `revision`, `post` thì trang nhỏ hơn) nên Worker không phải giữ cả cơ sở dữ liệu trong bộ nhớ.

## Trong bản sao lưu có gì, không có gì

| Có | Không có |
|---|---|
| Mọi bảng nội dung, menu, cấu hình (`setting`), vai trò và quyền, tài khoản, thư viện media (chỉ dòng dữ liệu, **không** có tệp ảnh), `audit_log`, `revision` | Bảng `session`, `password_reset`, `auth_throttle`, `user_totp`, `registration` |
| Cột `password_hash` không có trong tệp | Mọi cột bí mật: mật khẩu băm, mã khôi phục 2FA, mã làm mới phiên |
| Cấu hình thư (`mail.smtp`) có máy chủ, cổng, tài khoản, người gửi | Mật khẩu thư (dạng mã hóa cũng bị bỏ) |

Hệ quả khi khôi phục: **tài khoản có đủ thông tin nhưng chưa có mật khẩu**, 2FA phải bật lại, mật khẩu thư phải nhập lại ở Cấu hình hệ thống. Ảnh gốc nằm ở R2 `tlhp-media` và B2, được sao lưu riêng (R2 không bị xóa khi khôi phục CSDL).

Bảng tìm kiếm toàn văn (bảng ảo `*_fts` và các bảng phụ của nó) không lưu vào tệp; chúng được dựng lại từ nội dung.

## Ba cách tạo bản sao lưu

1. **Tải về máy** (Quản trị → Sao lưu → "Tạo và tải về"). Cần nhập lại mật khẩu của chính mình; nhập sai năm lần thì phải chờ. Việc tải được ghi vào nhật ký (`backup.export`).
2. **Vào kho lưu trữ R2** (nút "Sao lưu vào kho lưu trữ ngay", hoặc `POST /api/quan-tri/v1/backup/run`). Tệp ghi vào bucket riêng `tlhp-backup` với tên `backup/YYYY-MM-DD-HHMM.json.gz` (giờ Việt Nam); chỉ giữ **30 bản mới nhất**, bản cũ hơn tự bị xóa.
3. **Tự động hằng ngày**: xem mục dưới.

Chỉ Super Admin có quyền `backup` trong các vai trò mặc định. Danh sách và tải một bản đã lưu: `GET /backup`, `POST /backup/<tên>.json.gz/download` (gửi `{password}` như lúc tải bản tạo ngay; sai mật khẩu hoặc bị khóa thì không tải được) (tên chỉ gồm chữ số và dấu gạch ngang, kết thúc `.json.gz`).

## Bật bucket sao lưu

Bucket `tlhp-backup` là riêng tư, không có route công khai nào đọc nó. Đã khai báo trong `cloudflare.config.ts` (chỉ khi bật quản trị, cùng điều kiện với `ADMIN_JWT_SECRET`):

```
BACKUP: bindings.r2({ name: "tlhp-backup" })
```

Tạo bucket một lần bằng công cụ `cf` (profile `tlhp`) hoặc trong bảng điều khiển Cloudflare, rồi triển khai lại. Khi chưa có bucket, trang Sao lưu báo "chưa gắn kho lưu trữ" và vẫn cho tải về máy.

## Chạy tự động (Cron)

Việc nối cron **chưa làm** trong mã. Hàm cần gọi đã có: `runBackup(ctx, null, env.BACKUP)` trong `src/admin/ops/backup.ts` (không có người dùng thì ghi nhật ký với tên "lịch tự động"). Cách nối khi cần:

1. Thêm Cron Trigger vào Worker, ví dụ mỗi ngày 20:00 UTC (3 giờ sáng Việt Nam): `0 20 * * *`.
2. Trong trình xử lý `scheduled`, dựng `AuthContext` (`db: env.DB`, `env`, `now`, `ip: ""`, `userAgent: "cron"`) rồi gọi `runBackup`. Bản sao lưu hằng ngày cũng là chỗ thích hợp để đặt việc đổi trạng thái bài hẹn giờ.
3. Cron của gói Workers chạy được cả trên gói miễn phí, nhưng bản sao lưu lớn có thể vượt giới hạn CPU của gói miễn phí; xem tình trạng gói trước khi bật.

## Khôi phục

Khôi phục **không có nút trong giao diện** (tránh ghi đè nhầm dữ liệu thật). Làm từ máy vận hành bằng script, vào một **tệp SQLite mới**:

```
npx tsx scripts/restore-backup.ts <tep-sao-luu.json.gz> <csdl-dich.sqlite>
```

Script áp dụng toàn bộ migration vào tệp đích nếu tệp còn trống, thay các dòng mà migration đã nạp sẵn (menu) bằng dòng trong bản sao lưu, nạp mọi bảng trong **một giao dịch** (lỗi giữa chừng thì không thay đổi gì), rồi kiểm tra khóa ngoại và in số dòng từng bảng. Script **từ chối** nếu tệp đích đã có tài khoản hoặc nhật ký.

Quy trình khôi phục thật lên D1:

1. Tạo tệp SQLite bằng script trên, kiểm tra số dòng khớp với báo cáo.
2. Tạo D1 mới (hoặc làm trống D1 hỏng), áp dụng migration, rồi nạp tệp SQLite (`wrangler d1 execute --file` từ bản `.dump`, hoặc import theo hướng dẫn trong `docs/van-hanh/d1.md`). Không chạy lệnh nào lên D1 thật khi chưa kiểm tra tệp cục bộ.
3. Tạo lại Super Admin đầu tiên bằng script seed (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`), hoặc dùng "Quên mật khẩu" (cần máy chủ thư đã cấu hình lại).
4. Nhập lại mật khẩu thư, bật lại 2FA, kiểm tra trang công khai.

Script có kiểm thử tự động: `tests/unit/admin/ops-backup.test.ts` xuất từ một CSDL thử, khôi phục vào CSDL mới và so số dòng từng bảng.
