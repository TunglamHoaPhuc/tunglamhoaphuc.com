# Đọc dữ liệu thẳng từ B2 (T19)

> Cập nhật 14/11/2026. Liên quan: [tasks/todo.md](../../tasks/todo.md) T19, [tasks/plan.md](../../tasks/plan.md) chuẩn bị #4.

Site mới đọc 13 file JSON mà admin cũ đang ghi trên Backblaze B2, qua S3 API với một khóa **chỉ đọc**. Site không bao giờ ghi vào bucket. Phần mã đã có (`src/libs/content/sources/b2.ts`); `v2.` vẫn dùng bản chụp (`snapshot`) cho tới khi làm xong các bước dưới đây.

## 1. Việc của chủ site

1. Trong trang quản trị Backblaze: tìm bucket và thư mục chứa 13 file JSON (thư mục `database` cạnh `01-trang-chu`, `02-tong-chi-tu-hoc`…). Ghi lại:
   - tên bucket;
   - đường dẫn thư mục trong bucket (ví dụ `tunglamhoaphuc2/database`);
   - endpoint S3 của bucket (ví dụ `https://s3.us-east-005.backblazeb2.com`);
   - tên 13 file.
2. Tạo **Application Key** mới:
   - chỉ cho đúng bucket đó, quyền **Read Only**;
   - nếu được, giới hạn theo tiền tố là thư mục `database`.
3. Tự nhập hai giá trị của khóa làm secret của Worker `tlhp-web`, trong tài khoản Cloudflare của zone (`b91a395bd9b7ab86ef4cba41d1d828ae`). Lệnh `cf workers secrets update` cũng làm được việc này. Nhập giá trị khi lệnh hỏi, không gửi khóa qua chat:

   ```bash
   npx wrangler secret put B2_KEY_ID --name tlhp-web
   ```

   ```bash
   npx wrangler secret put B2_APPLICATION_KEY --name tlhp-web
   ```

## 2. Việc của đội kỹ thuật (khi đã có bước 1)

1. **So định dạng.** Các adapter (`src/libs/content/*.ts`) được viết theo dữ liệu API công khai của site cũ, không phải theo file gốc trên B2.
   - Lấy một file gốc (chủ site gửi, hoặc tải bằng khóa) đặt vào `data/snapshot/`, rồi chạy `npm run snapshot:check`.
   - Nếu tên file khác `posts`, `post-albums`, `schedule`, `gioi-thieu`, `tong-chi`, `vu-tru`, `bao-tuong` thì sửa tên trong `src/libs/content/sources/files.ts`.
2. **Khai báo trong `cloudflare.config.ts`**, mục `env` của Worker:

   ```ts
   CONTENT_SOURCE: bindings.text("b2"),
   B2_ENDPOINT: bindings.text("https://s3.us-east-005.backblazeb2.com"),
   B2_BUCKET: bindings.text("<tên bucket>"),
   B2_PREFIX: bindings.text("<thư mục, ví dụ tunglamhoaphuc2/database>"),
   B2_KEY_ID: bindings.secret(),
   B2_APPLICATION_KEY: bindings.secret(),
   ```

3. Deploy `v2.`, rồi kiểm:
   - Sửa một bài trong admin cũ: `v2.` hiện bản mới sau khoảng 1 phút (bộ đọc hỏi lại B2) cộng thời gian trang được làm mới (ISR, tối đa 5 phút).
   - Log Worker không có dòng `[b2]` báo lỗi.
   - Khóa không ghi được: thử một lệnh `PUT` ký bằng khóa đó, phải bị từ chối (403).
4. **Quay lại bản chụp:** bỏ dòng `CONTENT_SOURCE` (hoặc đặt `"snapshot"`), rồi deploy.

## 3. Cách nguồn B2 chạy

- **Ký yêu cầu:** dùng `aws4fetch`. Khóa chỉ nằm trong secret của Worker, không có trong mã gửi về trình duyệt (đã kiểm trên bản build: mã B2 chỉ nằm trong bundle của Worker).
- **Hỏi lại B2:** mỗi file được hỏi lại tối đa mỗi phút một lần, kèm `If-None-Match` (ETag).
  - File không đổi: B2 trả 304, không tải lại.
  - File đổi: tải bản mới. Chỉ file đổi mới được dịch lại thành nội dung.
- **Dùng chung bản lưu:** các Worker cùng một điểm Cloudflare dùng chung bản cuối qua Cache API, nên Worker mới khởi động không phải tải lại.
- **Khi gặp sự cố:** B2 lỗi, mạng lỗi, JSON hỏng, hoặc bản mới không còn mục nào. Khi đó giữ bản tốt gần nhất và ghi log `[b2] …` hoặc `[nội dung] …`. Nếu chưa từng có bản tốt (Worker mới, B2 đang lỗi) thì trang báo lỗi; các trang đã cache ở edge (T41e) vẫn phục vụ bản cũ.
- **Chi phí B2:** mỗi lần hỏi lại là một giao dịch loại B. B2 miễn phí 2.500 giao dịch loại B mỗi ngày; vượt thì 0,004 USD cho mỗi 10.000 giao dịch. Với 7 file và nhịp 1 phút, một điểm Cloudflare có lượt truy cập liên tục hỏi tối đa khoảng 10.000 lần mỗi ngày (khoảng 0,003 USD). Tải dữ liệu từ B2 sang Cloudflare không tính phí (Bandwidth Alliance).

## 3b. Cập nhật 22/11/2026

- Vẫn **chưa có khóa B2**: không có biến `B2_*` trong `.dev.vars` hay secret của Worker `tlhp-web`. Việc của chủ site ở mục 1 còn nguyên; đừng dò bucket công khai (đã thử 14/11, 404).
- Nay `v2.` và `www` đọc D1, nên nguồn `b2` chỉ còn hai việc: kiểm định dạng file gốc và làm đầu vào cho `npm run import -- --from=b2`. **Đừng chạy nhập từ B2 vào D1 thật** khi chưa có quyết định ở T42d: nhập ghi đè nội dung và xóa các dòng admin mới đã tạo (xem tasks/todo.md, T42d).
- Chỉ đọc: mã chỉ gửi `GET` (có test). Khóa B2 vẫn nên tạo ở quyền Read Only.
- Tên file: mã đọc 8 tên (`posts`, `post-albums`, `schedule`, `gioi-thieu`, `tong-chi`, `vu-tru`, `bao-tuong`, `danh-tang`). Chủ site liệt kê đủ 13 tên thật để đối chiếu.

## 4. Chưa làm (để khi có khóa)

- Trang `/van-hanh/lam-moi` có nút "Làm mới site" cho Ban Biên Tập, đặt sau Cloudflare Access; nút này phải xóa cả bản cache ở edge (T41e).
- Bộ đệm dữ liệu của vinext trên KV: gói Workers Free chỉ cho 1.000 lần ghi KV mỗi ngày. Cần quyết cùng Câu hỏi mở #8 (Workers Paid).
