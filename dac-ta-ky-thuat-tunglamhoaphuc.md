# HỒ SƠ ĐẶC TẢ KỸ THUẬT – CỔNG THÔNG TIN ĐIỆN TỬ TÙNG LÂM HÒA PHÚC

> Đối tượng khảo sát: https://www.tunglamhoaphuc.com/ và https://www.tunglamhoaphuc.com/admin
> Ngày khảo sát: 02/11/2026 · Phương pháp: duyệt trực tiếp (desktop 1024px & mobile 375px), đọc DOM/CSS đã render, đọc JS bundle công khai, đo hiệu năng tải trang.
> Admin: khảo sát 02/11/2026 trong phiên do chủ site đăng nhập, chỉ đọc giao diện + API GET + JS bundle (xem Phần 1.2, 2.3, 3.1b).
> Bổ trợ: ghi chú phiên 31/10/2026 trong [tunglamhoaphuc-cloudflare-migration.md](tunglamhoaphuc-cloudflare-migration.md).
>
> Quy ước: **[QS]** = quan sát trực tiếp trên site · **[SL]** = suy luận từ mã nguồn/hành vi · **[ĐX]** = đề xuất cho bản dựng lại.

---

## ⚠️ CẢNH BÁO BẢO MẬT KHẨN CẤP (đọc trước)

Trang `/admin` chuyển hướng sang `/login`. Khảo sát trang này cho thấy cơ chế đăng nhập **không có bảo mật thực chất** [QS]:

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | Tài khoản & mật khẩu admin **in công khai trên trang đăng nhập** ("Tài khoản mặc định") | Giao diện `/login` |
| 2 | Có nút **"Đăng nhập nhanh 1 chạm"**: bấm là vào admin, không cần nhập gì | Giao diện `/login` |
| 3 | Kiểm tra mật khẩu **chạy ở trình duyệt**, mật khẩu nằm sẵn trong JS bundle công khai (`/_next/static/chunks/2nipgrfwln092.js`). Chấp nhận 3 tổ hợp, trong đó có `admin`/`admin` và **bất kỳ tên đăng nhập nào** đi kèm mật khẩu mặc định | Đọc bundle |
| 4 | "Phiên đăng nhập" chỉ là cookie `admin_auth=true` do JS tự ghi (không HttpOnly, không ký số). Ai cũng tự đặt được cookie này | Đọc bundle |

**Hệ quả:** bất kỳ ai cũng có thể vào trang quản trị, nơi có quyền **xóa vĩnh viễn bài viết, xóa/đổi tên file trên B2, ghi đè lịch và đồng bộ đè từ WordPress**. Chưa xác minh được các API `/api/admin/*` có kiểm tra quyền phía máy chủ hay không (tôi không thử truy cập trái phép). Tin tốt: khi quét JS của admin, tôi không thấy khóa B2 hay mật khẩu WordPress lộ ra phía trình duyệt.

**Việc cần làm ngay (trước cả kế hoạch chuyển Cloudflare):**
1. Gỡ khối "Tài khoản mặc định" và nút "Đăng nhập nhanh 1 chạm".
2. Đặt `/admin/*` và `/api/admin/*` sau **Cloudflare Access** (đã có trong kế hoạch, nên đưa lên làm đầu tiên – chỉ mất ~30 phút, không cần sửa code).
3. Kiểm tra API admin có tự xác thực phía server không; nếu không, thêm middleware xác thực.
4. ~~Kiểm tra JS admin có lộ khóa B2~~ → đã kiểm tra 02/11: không thấy khóa trong bundle ✅.
5. Xem lại log B2/WordPress để phát hiện thay đổi bất thường.
6. Bật **versioning / lifecycle giữ bản cũ** trên bucket B2 chứa file JSON dữ liệu, vì mọi lần "Lưu" đều ghi đè toàn bộ file.

---

## PHẦN 1: BẢN ĐỒ CẤU TRÚC HỆ THỐNG & ĐIỀU HƯỚNG

### 1.1. Phân hệ người dùng (Front-end)

#### Sơ đồ cây trang (Sitemap) [QS]

```
/ (Trang chủ – "Nơi để trở về")
├── Giới thiệu  (/gioi-thieu – mega-menu 6 thẻ)
│   ├── /gioi-thieu/lich-su-tung-lam-hoa-phuc     Lịch sử Bổn tự
│   ├── /gioi-thieu/dai-su-lien-dang              Bậc Tiền bối – Đại sư Liên Đăng
│   ├── /gioi-thieu/su-ong-hoang-phap             Đạo trưởng Tông phong – Sư Ông Hoằng Pháp
│   ├── /gioi-thieu/su-phu-tru-tri                Trụ trì Bổn tự – Sa môn Thích Tâm Hòa
│   ├── /gioi-thieu/tieu-su-su-to                 Sư Tổ Khai Sơn
│   └── /gioi-thieu/van-hoa-ung-xu                Thanh quy – Văn hóa ứng xử Thiền môn
├── Tông Chỉ Tu Học  (/tong-chi-tu-hoc – ~25 bài)
│   ├── [Tông phong truyền thừa]  tiep-buoc-thay-toi, doi-thay, mien-nam-chon-to
│   ├── [Nền tảng tu học]         bo-de-tam, tam-quy-ngu-gioi, thap-thien-nghiep, bo-tat-hanh-luc-do
│   ├── [Phương pháp hành trì]    niem-phat, tung-kinh, thien-tap, lay-phat, sam-hoi, nghe-phap, phung-su, bo-thi
│   ├── [Lộ trình tu học]         Người mới · Người trẻ · Người bận rộn · Người chuyên tu
│   └── [Nếp sống Thiền gia]
├── Dòng Chảy Hoằng Pháp  (/dong-chay-hoang-phap – ~475 bài)
│   ├── Bộ lọc: Tất cả · Cộng Tu · Khóa Lễ Truyền Thống · Đại Lễ Sự Kiện · Tịnh Độ Nhân Gian
│   ├── Sắp xếp: Mới nhất · Cũ nhất · A→Z · Z→A
│   └── /dong-chay-hoang-phap/{slug}  (tab neo: Tổng quan · Nội dung chính · Video · Album ảnh · Các kỳ trước · Sắp diễn ra · Tìm hiểu thêm)
├── Vũ Trụ Phật Giáo  (/vu-tru-phat-giao – bản đồ 2D, 12 khu vực)
│   ├── tam-bao · to-duong · dai-nam-quoc-mau · bao-tang · bao-thap-van-phat-xa-loi · giang-duong
│   ├── tu-an · tang-kinh-cac · trai-duong · san-di-da · cong-tam-quan · lang-xa-tam-linh
│   └── Trang khu vực: Giới thiệu · Bộ sưu tập bảo tượng · Câu chuyện liên quan · Không gian · Khu vực khác · Hỏi đáp AI
│       └── /vu-tru-phat-giao/giang-duong còn có "Pháp thoại nổi bật" + "Kho tàng pháp thoại" (video theo tập)
├── Bảo Tượng Phật Giáo  (/bao-tuong-phat-giao – 126 tôn tượng, 15 cụm)
│   ├── Nhóm: Chư Phật Hải Hội · Thanh Tịnh Đại Hải Chúng · Thanh Văn Thánh Chúng · …
│   └── /bao-tuong/{slug}_{mã tpXXXX}  (Cụm tượng · Bài viết · Nghệ thuật Phật giáo · Video · Bảo tượng liên quan)
├── Trí Tuệ Phật Pháp  (/tri-tue-phat-phap – ~158 mục: sách, pháp âm, video #phapthoai)
│   └── /tri-tue-phat-phap/hoc-tieng-tang  (Sara Book)
├── /login  (đăng nhập quản trị)
└── Trang 404 tùy biến ("Trang không tồn tại hoặc đã được chuyển dời")
```

Không có: `/sitemap.xml` (404), trang Liên hệ riêng, trang Tìm kiếm riêng, trang Đăng ký cộng tu riêng.

#### Luồng người dùng chính (User Flows)

| Luồng | Các bước hiện tại [QS] | Nhận xét |
|---|---|---|
| **Lần đầu vào site** | Mở trang → popup "Kính mừng quý Phật tử & Đại chúng" (Ấn bản số hóa v1.0.0) → (tùy chọn) tích "Không hiển thị lại" → "Hoan hỷ tiếp tục" | Popup che toàn bộ nội dung lần đầu; lưu trạng thái vào `localStorage` |
| **Đọc tin/pháp sự** | Trang chủ "Tin mới nhất" hoặc menu → Dòng Chảy Hoằng Pháp → lọc danh mục / sắp xếp → mở bài → nhảy giữa các tab neo → xem album ảnh (lightbox "1/79") → "Tìm hiểu thêm" | Danh sách tải toàn bộ ~472 bài một lần, không phân trang |
| **Khám phá không gian chùa** | Trang chủ "Các khu vực nổi bật" → Bản đồ 2D → chọn khu vực → xem bảo tượng trong khu vực → mở chi tiết bảo tượng → "Bảo tượng liên quan" | Luồng tốt, liên kết chéo chặt |
| **Tra cứu / hỏi đáp** | Ô "Hỏi AI Hòa Phúc" (có trên trang chủ, trang khu vực, cuối mọi trang) → trợ lý AI trả lời | Là kênh tìm kiếm duy nhất; không có tìm kiếm từ khóa truyền thống |
| **Xem lịch tu học** | Trang chủ → khối "Lịch tu học Phật lịch 2570" (lưới tháng, ngày dương + âm, chú thích 3 loại sự kiện) | Chỉ có trên trang chủ, chưa có trang lịch riêng / xuất iCal |
| **Đăng ký cộng tu** | Nút "Đăng ký cộng tu" ở hero → chuyển tới `/dong-chay-hoang-phap` | **Không có form đăng ký**, nhãn nút gây hiểu nhầm |
| **Liên hệ** | Footer: danh sách số điện thoại (link `tel:`), giờ mở cửa, link mạng xã hội | Không có form liên hệ / bản đồ |
| **Quản trị viên đăng nhập** | `/admin` → chuyển `/login` → nhập hoặc bấm "Đăng nhập nhanh" → `/admin` | Xem Cảnh báo bảo mật |

#### Menu & điều hướng [QS]

- **Header cố định (sticky/fixed)** cao 64px, nền trong suốt + `backdrop-filter: blur(14px)`, viền dưới mảnh màu vàng.
- **Logo "Mộc Ấn"** (khiên đỏ viền vàng) đặt góc trái, **tràn xuống dưới header** (194×144px) tạo điểm nhấn.
- **Primary navigation** (chữ in hoa 11px, đậm, giãn chữ): Giới thiệu ▾ · Tông Chỉ Tu Học · Dòng Chảy Hoằng Pháp · Vũ Trụ Phật Giáo · Bảo Tượng Phật Giáo · Trí Tuệ Phật Pháp.
- **Mega-menu "Giới thiệu"**: 6 thẻ, mỗi thẻ gồm nhãn nhỏ (VD "Bậc Tiền Bối") + tiêu đề + mô tả ngắn + link "Tất cả mục giới thiệu".
- **Thanh neo nội trang (sub-nav)**: trang chủ (Nơi để trở về · Trợ lý Phật học · Tin mới nhất · Dấu ấn hoằng pháp · Lịch tu học · Khu vực & bảo tượng), trang khu vực và trang bài viết đều có thanh tab neo riêng.
- **Breadcrumb**: có ở trang chi tiết bài viết ("Trang chủ / Dòng Chảy Hoằng Pháp / …") kèm nút "Quay lại …"; trang bảo tượng dùng nút "Quay lại trang bảo tượng".
- **Mobile**: nút hamburger viền vàng bo góc ở góc phải; logo thu nhỏ vẫn tràn header.
- **Lỗi**: ở độ rộng 1024px menu ngang bị **tràn, cắt chữ** ("BẢO TƯỢNG PHẬT G…", mất "Trí Tuệ Phật Pháp"). Cần chuyển sang hamburger sớm hơn (≤1279px) hoặc thu gọn khoảng cách.

### 1.2. Phân hệ quản trị (Back-end / Admin)

#### Hiện trạng tổng quan [QS – khảo sát trong phiên đã đăng nhập, 02/11/2026, chỉ đọc]

| Thành phần | Hiện trạng |
|---|---|
| Đăng nhập | 1 tài khoản dùng chung, xác thực phía client (xem Cảnh báo) |
| Phân quyền | **Không có RBAC**: ai vào được là toàn quyền, kể cả xóa vĩnh viễn bài và file |
| Lưu trữ dữ liệu | Mỗi module đọc/ghi qua API `/api/admin/*`; dữ liệu lưu thành **file JSON trên Backblaze B2** (nút "Lưu thay đổi (Cloud S3)") |
| Nguồn nội dung | **Mô hình lai**: bài gốc soạn trên WordPress (`admin.tunglamhoaphuc.com`, mỗi dòng có mã "Gutenberg #ID"), admin Next.js kéo về ("Đồng bộ từ WordPress") rồi chỉnh tiếp tại chỗ (cờ `isLocalEdited`) |
| Nhập liệu khác | Nhập từ **Google Sheets** (xuất CSV) ở module Tông Chỉ; lấy metadata link (`fetch-metadata`) |
| Trợ lý AI | Dấu vết **Dify** trong bundle → nhiều khả năng chatbot "Hỏi AI Hòa Phúc" chạy trên Dify |
| Bí mật trong bundle | Đã quét 38 file JS của admin: **không thấy** khóa B2/S3, mật khẩu ứng dụng WordPress hay token Bearer ✅ (khóa nằm phía server) |

#### Khung giao diện admin [QS]

- **Sidebar trái thu gọn** (chỉ icon, có nút "Mở rộng thanh menu"), **breadcrumb** trên cùng ("Quản trị › Tên module").
- **Menu (10 mục + 1 link ra site):**

| # | Menu | Route | API chính |
|---|---|---|---|
| 1 | Tổng Quan Dashboard | `/admin` | `views-summary` |
| 2 | Tông Chỉ Tu Học | `/admin/tong-chi` | `tong-chi`, `sync-wp` |
| 3 | Dòng Chảy Hoằng Pháp | `/admin/posts` | `posts`, `sync-wp-posts`, `wp-post-create` |
| 4 | Lịch Tu Học & Sự Kiện | `/admin/lich-tu-hoc` | `schedule` |
| 5 | Giới Thiệu Tông Phong | `/admin/gioi-thieu` | `gioi-thieu`, `gioi-thieu/sync-wp` |
| 6 | Vũ Trụ Phật Giáo | `/admin/vu-tru-phat-giao` | `vu-tru`, `vu-tru/sync-wp` |
| 7 | Bảo Tượng Phật Giáo | `/admin/bao-tuong` | `bao-tuong` |
| 8 | Danh Tăng & Tổ Sư | `/admin/danh-tang` | `danh-tang` |
| 9 | Trí Tuệ Phật Pháp | `/admin/tri-tue-phat-phap` | `posts?category=tri-tue-phat-phap` |
| 10 | Kho Ảnh S3 Cloud | `/admin/kho-anh-s3` | `upload`, `wp-media`, `repair-links` |
| – | Xem Trang Chủ Website | `/` | – |

#### Chi tiết từng module [QS]

**1. Tổng Quan Dashboard**
- Banner "Hệ thống quản trị nội dung & đo lường lượt xem" + 2 nút: "Quản lý bài viết Hoằng Pháp", "Xem trang chủ web".
- Thẻ KPI lớn: **Tổng lượt xem toàn web 923.234** ("đo lường thời gian thực").
- 4 thẻ chuyên mục: Dòng Chảy 475 bài (1.4K lượt) · Tông Chỉ 25 bài (886.4K) · Trí Tuệ 158 bài (35.4K) · Bảo Tượng 126 tôn tượng (110), mỗi thẻ link vào module.
- **Bảng xếp hạng "Dấu Ấn Hoằng Pháp"**: top 20 bài theo lượt xem, lọc theo tab (Tất cả / Dòng Chảy / Tông Chỉ / Trí Tuệ / Bảo Tượng); mỗi dòng: hạng, ảnh, nhãn nhóm, thời điểm đăng (đang hiện thô dạng ISO `2026-08-23T09:10:00.000Z`), tiêu đề, lượt đọc, nút mở bài. Top này **quyết định trực tiếp** khối "Dấu ấn hoằng pháp" ở trang chủ.
- Nhận xét: tỷ lệ lượt xem lệch mạnh (Tông Chỉ 25 bài = 886K lượt, Dòng Chảy 475 bài = 1.4K) → nghi số liệu Tông Chỉ được nhập tay/khởi tạo, không phải đo thực.

**2. Dòng Chảy Hoằng Pháp (`/admin/posts`)**: "Bảng quản trị" dạng **bảng tính sửa trực tiếp (inline-edit spreadsheet)**
- Thanh tiêu đề: huy hiệu "S3 sẵn sàng", "472 bài viết", chuẩn thiết kế "Tiêu đề ≤ 80 kt | Sub ≤ 60 kt".
- Công cụ: Mở trình quản lý tệp S3 · Thêm bài mới · Tải lại · **Đồng bộ toàn bộ bài mới từ WordPress** · Lưu toàn bộ (Ctrl+S).
- Tìm kiếm (tiêu đề, tác giả, nội dung) · Lọc chuyên mục: Cộng Tu Định Kỳ (189) · Khóa Lễ Truyền Thống (122) · Đại Lễ Sự Kiện (35) · Tịnh Độ Nhân Gian (126) · Sắp xếp: thứ tự kéo-thả / lượt xem cao nhất / thấp nhất.
- Cột: # (kéo thả) · Chuyên mục (select) · Ảnh bìa (căn tiêu điểm, chọn từ S3) · Tiêu đề (textarea, đếm ký tự x/80) · Tiêu đề phụ (x/60, viền đỏ khi vượt) · Tác giả & ngày · Lượt xem · Đa phương tiện (video, bài nổi bật, album ảnh có số đếm) · Trình soạn thảo (đoạn trích + "Gutenberg #ID" mở WordPress 1-click, nút sửa nhanh) · Thao tác (lưu riêng, xem trước modal, mở trang, **xóa vĩnh viễn**).
- Phân trang 20 dòng/trang.
- **Trình soạn thảo web nội bộ (modal)**: undo/redo, H1/H2, khối trích dẫn "Lời Thầy", đậm/nghiêng/gạch chân, đường phân đoạn, gắn chú thích, chèn ảnh từ kho S3, tải ảnh, xem trước; nội dung lưu dạng Markdown nhẹ (`###`, `**`).

**3. Tông Chỉ Tu Học (`/admin/tong-chi`)**: bảng tính tương tự, 25 bài, 5 nhóm (Tông phong truyền thừa 3 · Nền tảng tu học 5 · Phương pháp hành trì 8 · Lộ trình tu học 4 · Nếp sống Thiền gia 5). Mỗi bài có thêm: khối **video**, **bài nổi bật** liên kết, **bộ sưu tập ảnh**, **sách nguồn**, **từ khóa** (thẻ liên kết có ảnh). Có nút **"Quét & nhập dữ liệu tự động từ Google Sheets"**.

**4. Lịch Tu Học & Sự Kiện (`/admin/lich-tu-hoc`)**: 3 tab
- *Lịch tu học & sự kiện (15)*: lịch tháng dạng lưới (T2→CN, ngày dương + âm, PL 2570), chọn nhanh T1–T12, lọc Tất cả / Cộng tu / Đại lễ sự kiện, nút "+" thêm thời khóa ở từng ngày.
- Cột trái **"Chủ đề tháng"**: poster chủ đề (đổi qua S3) + câu trích dẫn thơ/văn xuôi (phần in đậm tự hiển thị font UTM Niagara vàng phát sáng ở trang chủ) + tác giả quote.
- *Kho ảnh Quote / Pháp ngữ (12)* · *Khóa lễ truyền thống (3)*.
- Nút "Lưu thay đổi (Cloud S3)" lưu cả cấu hình lịch một lần.

**5. Giới Thiệu Tông Phong (`/admin/gioi-thieu`)**: bảng 6 chủ đề, 3 nhóm (Lịch sử chùa & đại sự · Chư Tôn Đức & Tổ sư · Thanh quy & văn hóa). Thêm: video tư liệu, **mốc niên biểu** (timeline), bộ sưu tập ảnh, trích dẫn, đồng bộ từng bài từ WordPress. Phát hiện: 2 phụ đề đang vượt giới hạn (73/60, 108/60), hệ thống chỉ cảnh báo chứ không chặn.

**6. Vũ Trụ Phật Giáo (`/admin/vu-tru-phat-giao`)**: bảng 14 không gian (site công khai hiển thị 12), lọc theo **tự viện** (Tùng Lâm Hòa Phúc 14 · Quỳnh Nhai Cam Lộ Tự 0 → hệ thống đã thiết kế cho **đa tự viện**). Mỗi không gian: **Pin số + tọa độ % trên bản đồ 2D** (VD Pin #1 tại 58%, 52%), số tượng an vị, câu chuyện kiến trúc; 2 trình quản lý con: "Bảo tàng số 3 miền", "Pháp thoại Giảng đường".

**7. Bảo Tượng Phật Giáo (`/admin/bao-tuong`)**: "Quản lý bảo tượng toàn tự", 126 pho
- Chuyển chế độ **thẻ trực quan / bảng danh sách**.
- Lọc: Chúng hội (Chư Phật Hải Hội, Thanh Tịnh Đại Hải Chúng, Thanh Văn Thánh Chúng, Chư Lịch Đại Tổ Sư, Hộ Pháp Thần Vương, Chư Thánh Hộ Quốc, Đại Thí Chủ, Linh Vật Phật Giáo…) · Không gian (9) · Loại tượng (Tượng chính / Nghệ thuật Phật giáo NTPG) · Sắp xếp · Tìm theo mã TP0001/tên/vị trí.
- Thẻ: mã, lượt xem, nhãn loại, vị trí, tên, danh hiệu, số ảnh; thao tác **xoay ảnh 90°**, kéo căn tiêu điểm, đổi ảnh từ S3, sửa.
- **Modal sửa** 5 tab: 1. Cơ bản (tên, danh hiệu, chúng hội, vị trí, phân loại, tác giả lời dạy, lời dạy Sư Phụ, mô tả, URL ảnh) · 2. Bài viết chi tiết · 3. Video · 4. Album ảnh · 5. Bài viết liên quan.

**8. Danh Tăng & Tổ Sư (`/admin/danh-tang`)**: **module không có trên menu site công khai**. 91 vị; thẻ chân dung (ảnh thờ từ thư mục S3 `07-anh-tho-cao-tang`), niên đại, tông phái (Lâm Tế, Tào Động, Trúc Lâm Yên Tử…); lọc vùng miền (Bắc/Trung/Nam/Quốc tế) và hội chúng (Tăng/Ni); trường `coordinates {x,y}` → dự kiến hiển thị trên bản đồ/phả hệ.

**9. Trí Tuệ Phật Pháp (`/admin/tri-tue-phat-phap`)**: bảng 158 mục, 4 tiểu mục: Bài viết nghiên cứu (126) · Pháp âm giảng giải (15) · Video Phật pháp (15) · Ấn phẩm & kinh sách (2). Có trường ngày dạng date-picker, cài đặt nguồn sách/kinh điển, trạng thái "Đã đồng bộ với máy chủ".

**10. Kho Ảnh S3 Cloud (`/admin/kho-anh-s3`)**: "Kho ảnh S3 Cloud Backblaze B2 – Ổ Z: sẵn sàng"
- Lối tắt 10 thư mục (emoji + tên + đường dẫn), cửa sổ duyệt toàn màn hình: **cây thư mục** bên trái, lưới ảnh bên phải (tên file, dung lượng, ngày), breadcrumb thư mục, lọc thời gian, sắp xếp, tìm kiếm.
- Hai nguồn: "Ảnh mới tải lên WordPress" · "Duyệt thư mục S3 Cloud (Ổ Z:)".
- Thao tác: tạo thư mục, tải lên (`input[type=file] accept=image/*`, tự nén WebP), chọn ảnh vào bài, **đổi tên**, **xóa file khỏi S3**, "tự động quét và khớp lại link ảnh" (`repair-links`).

#### Phân quyền đề xuất (RBAC) [ĐX]

| Vai trò | Ai | Quyền |
|---|---|---|
| **Super Admin** | Ban IT / quản trị kỹ thuật | Toàn quyền, cấu hình hệ thống, quản lý tài khoản, xem nhật ký |
| **Ban Biên tập (Editor)** | Ban Văn hóa Tùng Lâm | Tạo/sửa/xuất bản mọi nội dung, quản lý media, lịch tu học |
| **Cộng tác viên (Contributor)** | Phật tử hỗ trợ | Tạo bản nháp, tải ảnh; cần Editor duyệt mới xuất bản |
| **Kiểm duyệt (Moderator)** | Ban lãnh chúng | Duyệt đăng ký cộng tu, xem/đánh dấu hội thoại AI, phản hồi |
| **Xem (Viewer)** | Chư Tôn Đức, Ban trị sự | Chỉ xem dashboard, báo cáo |

Xác thực khuyến nghị: Cloudflare Access (đăng nhập bằng email Google/OTP) + vai trò lưu trong D1.

#### Danh mục module quản trị cho bản dựng lại [ĐX]

Giữ nguyên 10 module hiện có (đã khá đầy đủ nghiệp vụ). Phần **in nghiêng** là bổ sung so với hiện trạng.

1. **Tổng quan (Dashboard)**: *lượt xem theo ngày/tuần/tháng (hiện chỉ có tổng cộng dồn)*, top bài, số bài theo chuyên mục, *sự kiện sắp tới, đăng ký cộng tu mới*.
2. **Nội dung (CMS)**
   - Bài Dòng Chảy Hoằng Pháp (có các khối: tổng quan, nội dung, video, album, kỳ trước, sắp diễn ra)
   - Bài Tông Chỉ Tu Học (theo nhóm)
   - Khu vực (Vũ Trụ Phật Giáo) & liên kết bảo tượng
   - Bảo tượng & Cụm tượng
   - Ấn phẩm / Pháp thoại / Video (Trí Tuệ Phật Pháp, Giảng đường)
   - Trang giới thiệu, tiểu sử chư Tôn Đức
   - Danh mục, thẻ (tag)
3. **Lịch tu học**: tạo sự kiện theo ngày dương/âm, loại sự kiện, sự kiện lặp (VD Sám hối mùng 1, 14, 15, 30 ÂL), pháp hội nhiều ngày.
4. **Thư viện media**: duyệt thư mục R2, upload kéo-thả, tự nén WebP + tạo các cỡ, tìm ảnh chưa dùng, alt text.
5. **Đăng ký cộng tu** (mới): danh sách, trạng thái, xuất Excel.
6. **Trợ lý AI**: quản lý nguồn tri thức, xem câu hỏi phổ biến, câu trả lời bị báo sai.
7. **Thông báo**: popup chào mừng, banner thông báo pháp sự.
8. **Cấu hình**: thông tin chùa, danh bạ liên hệ, giờ mở cửa, mạng xã hội, SEO mặc định, redirect 301, sao lưu.
9. **Tài khoản & nhật ký**: người dùng, vai trò, audit log (ai sửa gì, lúc nào).

---

## PHẦN 2: THIẾT KẾ GIAO DIỆN & BỐ CỤC

### 2.1. Khung lưới & bố cục

| Thông số | Giá trị [QS] |
|---|---|
| Công nghệ | Next.js (App Router, Turbopack) + Tailwind CSS v4 + bộ token shadcn/ui + icon lucide-react |
| Container | `max-width: 1280px`, `margin: auto`, lề `16px` (mobile) / `40px` (≥768px) |
| Lưới | Flex/CSS Grid của Tailwind, chủ yếu 3–4 cột thẻ trên desktop, 1 cột trên mobile |
| Khoảng cách section | `py-16` (64px) → `md:py-24` (96px); section xen kẽ nền `#2C1C11` và `#1A120B` |
| Bo góc | Token `--radius: 10px`; thẻ 14px; nút 12–14px; modal/khung login 24px; pill/badge bo tròn hoàn toàn |
| Đổ bóng | Thẻ: `0 20px 25px -5px rgb(0 0 0 / .1)`; nút vàng: `0 4px 15px rgba(242,193,78,.4)` (hiệu ứng phát sáng) |

**Khung trang chuẩn**

- **Header**: fixed, 64px, kính mờ; logo trái (tràn); menu giữa-phải; nút tiện ích (trợ lý AI / mở menu).
- **Hero trang chủ**: toàn màn hình (≈100vh), ảnh nền mờ tối, tiêu đề "NƠI ĐỂ TRỞ VỀ" (128px), dòng phụ "CHỐN THIÊNG BÌNH YÊN" giãn chữ, hàng 5 nút pill (Pháp thoại mới nhất · Kho ảnh tư liệu · Ấn phẩm Phật giáo · Đăng ký cộng tu · Tìm kiếm & tham vấn).
- **Hero trang chuyên mục**: biểu tượng tròn ☸, H1 vàng phát sáng, đoạn mô tả căn giữa.
- **Body**: các section trang chủ theo thứ tự: AI Search → Tin mới nhất → Dấu ấn hoằng pháp (top bài xem nhiều) → Lịch tu học (kèm bài thơ) → Khu vực & Bảo tượng.
- **Sidebar**: không dùng.
- **Khối AI chung**: "Trao đổi và tìm kiếm thông tin bằng trợ lý AI" lặp lại cuối mọi trang.
- **Footer**: tên chùa + địa chỉ (Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội) · 2 khối theo dõi mạng xã hội (Tùng Lâm Hòa Phúc, Quỳnh Nhai Cam Lộ Tự) · giờ mở cửa · bảng liên hệ (Trưởng ban lãnh chúng, Thư ký, Hỗ trợ thông tin) · copyright · khẩu hiệu "Nơi để trở về – Chốn thiêng bình yên 🪷". Không có form newsletter.

**Điểm ngắt đáp ứng** (mặc định Tailwind v4)

| Tên | Từ | Ghi chú |
|---|---|---|
| (mobile) | 0 | 1 cột, hamburger, logo thu nhỏ |
| `sm` | 640px | |
| `md` | 768px | Lề 40px, section padding lớn hơn |
| `lg` | 1024px | Hiện menu ngang – **đang bị tràn ở đúng mốc này** |
| `xl` | 1280px | Bằng container tối đa |
| `2xl` | 1536px | |

### 2.2. Thư viện thành phần (Component Library)

#### Nút bấm [QS]

| Loại | Quy cách | Trạng thái |
|---|---|---|
| **Primary (vàng đặc)** | Nền `#F2C14E`, chữ `#1A120B`, 12px đậm in hoa, giãn chữ 0.6px, `py-3`, bo 12px, bóng phát sáng vàng | Hover: nền `#FFDE59` · Disabled: opacity 50% · Loading: đổi nhãn "Đang xác thực…" |
| **Secondary (viền vàng, nền nâu)** | Nền `#6B4B2A`, chữ `#F2C14E`, viền 1px `#F2C14E`, 14px, `12px 32px`, bo 14px (VD "Tìm hiểu thêm") | Hover: sáng nền |
| **Pill hero (ghost)** | Nền đen 45% trong suốt, viền vàng mờ, icon trái + chữ in hoa 12px, bo tròn | Hover: viền/chữ sáng hơn |
| **Tab/Filter text** | Chữ 12px, không nền; active: chữ `#F2C14E` + gạch chân vàng | |
| **Dropdown chọn (select)** | Nền nâu 80%, viền vàng 40%, bo 10px, `6px 12px`, chữ vàng, chevron | Mở: danh sách tùy chọn |
| **Icon button tròn** | Nền `#F2C14E`, icon tối (VD mũi tên carousel), bo tròn | |
| **Danger** | Chưa có nút Danger riêng; thông báo lỗi dùng nền đỏ 15% + viền đỏ 30% + chữ `red-400` | [ĐX] thêm nút Danger cho admin (Xóa) |

#### Form & nhập liệu [QS]

- Text input (login, ô hỏi AI): nền nâu sẫm, viền vàng mờ, bo 12px, icon trái (mail, khóa), placeholder màu kem nhạt; nhãn 12px đậm màu vàng.
- Dropdown tùy biến (bộ lọc danh mục, sắp xếp).
- Checkbox ("Không hiển thị lại thông báo này") trong popup.
- Validation: chỉ có thuộc tính `required` của HTML + hộp lỗi chung "Tài khoản hoặc mật khẩu không chính xác".
- Chưa có: date-picker, toggle, textarea, upload ở phía người dùng.

#### Thẻ, danh sách & khối hiển thị [QS]

- **Thẻ bài viết (Card)**: ảnh phủ trên, phần dưới nền `#2C1C11`, viền vàng 25%, bo 14px; icon tròn huy hiệu giữa mép ảnh; nhãn nguồn nghiêng; tiêu đề in hoa vàng.
- **Thẻ "Dấu ấn hoằng pháp"**: ảnh dọc, nhãn phụ (VD "Cội nguồn tâm linh"), tiêu đề, mô tả 11px, ngày đăng + lượt xem (54.2K).
- **Thẻ bảo tượng**: ảnh tượng, Cụm tượng, Khu vực, nút "Khám phá".
- **Carousel/slider**: Tin mới nhất, Khu vực nổi bật, Bảo tượng nổi bật (nút mũi tên tròn vàng).
- **Lịch tháng**: lưới 7 cột (T2→CN), mỗi ô có ngày dương + ngày âm + nhãn sự kiện màu theo loại; chú thích 3 loại.
- **Modal**: popup chào mừng (nền tối 98%, khung viền vàng, nội dung cuộn, footer có checkbox + nút Primary); lightbox album ảnh ("1/79").
- **Mega-menu**: lưới thẻ 3×2.
- **Tabs neo (sticky sub-nav)**: trang bài viết, trang khu vực.
- **Badge/Tag**: pill nhỏ "Tự viện", nhãn loại sự kiện trong lịch.
- **Breadcrumb**: chữ nhỏ phân cách "/".
- **Trạng thái rỗng/lỗi**: trang 404 tùy biến; "Bài viết không còn tồn tại" có nút quay lại; "Đang tải dữ liệu…".
- Chưa có: Accordion (FAQ), Table phía người dùng, Toast.

### 2.3. Giao diện trang quản trị [QS]

- **Bố cục**: sidebar icon 56px cố định trái + vùng nội dung full-width; breadcrumb trên cùng; mỗi module mở đầu bằng **thẻ tiêu đề** (icon vuông viền vàng, tên module font UTM Niagara, huy hiệu đếm số bản ghi, dòng mô tả, cụm nút icon bên phải).
- **Màu & font**: dùng chung bảng màu và font với site công khai (nền `#1A120B`/`#2C1C11`, vàng `#F2C14E`), thống nhất thương hiệu tốt.
- **Mẫu màn hình chính – Bảng tính sửa trực tiếp**: thanh lọc (select chuyên mục có số đếm + select sắp xếp + ô tìm kiếm có icon), bảng có cột kéo-thả thứ tự, ô nhập ngay trong bảng có **bộ đếm ký tự** (`35/80`) và thanh tiến độ mảnh dưới ô, **viền đỏ khi vượt giới hạn**, cụm icon tròn "đa phương tiện" có badge số đếm, cụm nút thao tác (lưu = vàng, xem = viền, xóa = đỏ).
- **Mẫu thẻ lưới**: Bảo tượng, Danh tăng (ảnh dọc tỷ lệ 3:4, nhãn mã góc trên, lượt xem, thao tác ảnh nổi trên ảnh).
- **Modal**: khung viền vàng phát sáng, tiêu đề Niagara, tab đánh số "1. Cơ bản · 2. … ", chân modal có "Hủy bỏ" (viền) + "Lưu thay đổi" (vàng đặc). Trình soạn thảo và kho ảnh mở dạng modal lớn có nút toàn màn hình.
- **Phân trang**: Trang đầu / Trang trước / số trang / Trang sau / Trang cuối / ô "Đi đến trang".
- **Phím tắt**: Ctrl+S lưu toàn bộ, Ctrl+B/I/U, Ctrl+Z/Y trong trình soạn thảo.
- **Nút Danger** đã có trong admin (icon thùng rác nền đỏ sẫm), nhưng **không thấy bước xác nhận/khôi phục** được mô tả (tooltip "Xóa bài viết này vĩnh viễn").
- **Hạn chế UX**: bảng rất rộng (10 cột, phải cuộn ngang ở màn 1366px), không dùng được trên điện thoại; tooltip là nguồn hướng dẫn chính; ngày giờ hiển thị thô dạng ISO.

---

## PHẦN 3: HỆ THỐNG DỮ LIỆU & LOGIC XỬ LÝ

### 3.1. Thực thể dữ liệu chính [SL từ cấu trúc nội dung + ĐX cho D1]

Quy ước kiểu: `id` = integer PK; `text`; `int`; `bool`; `datetime` (ISO, UTC); `json`; `→ X` = khóa ngoại.

**Post** – bài Dòng Chảy Hoằng Pháp (~475)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, slug | id, text unique | slug tiếng Việt không dấu |
| title, excerpt | text | |
| category_id | → Category | Cộng Tu / Khóa Lễ Truyền Thống / Đại Lễ Sự Kiện / Tịnh Độ Nhân Gian |
| cover_media_id | → Media | |
| overview, body | text (HTML/Markdown) | khối "Tổng quan", "Nội dung chính" |
| video_urls | json | YouTube |
| album_id | → Album | "Bộ sưu tập ảnh tư liệu" |
| series_id | → Series (null) | "Các kỳ trước" (VD Cộng tu kỳ 10) |
| event_date_solar, event_date_lunar | datetime, text | VD 24/05/2026 – 08/04/Bính Ngọ |
| author_label | text | "Ban Văn Hóa Tùng Lâm" |
| status | enum draft/review/published/archived | |
| published_at, created_at, updated_at | datetime | |
| view_count | int | đồng bộ từ bảng PageView |
| seo_title, seo_description, og_image_id | text, text, → Media | |
| legacy_wp_id, legacy_url | int, text | phục vụ redirect 301 |

**Category**: id, slug, name, section (`dong-chay` / `tong-chi` / `tri-tue`), order, color_token.

**TeachingArticle** – Tông Chỉ Tu Học (~25): id, slug, group (Tông phong truyền thừa / Nền tảng tu học / Phương pháp hành trì / Lộ trình tu học / Nếp sống Thiền gia), kicker (VD "Lục tự cứu cánh"), title, summary, body, cover_media_id, order, status, published_at, view_count.

**Area** – khu vực (12): id, slug, name, subtitle (VD "Đại Hùng Bảo Điện"), intro, story, map_x, map_y (vị trí trên bản đồ 2D), cover_media_id, gallery_album_id, order.

**StatueCluster** – cụm tượng (15): id, slug, name (VD "Hoa Nghiêm Tam Thánh", "Chư Phật Hải Hội"), group (Chư Phật Hải Hội / Thanh Tịnh Đại Hải Chúng / Thanh Văn Thánh Chúng…), area_id → Area, description.

**Statue** – bảo tượng (126): id, code (`TP0001`), slug, name, epithet (VD "Vô Thượng Năng Nhân"), cluster_id → StatueCluster, area_id → Area, story (bài viết, tác giả "Vô Trí – Tâm Hòa"), art_images (→ Album), video_url, is_featured (bool), order. Bảng nối **StatueRelation** (statue_id, related_statue_id).

**Publication** – Trí Tuệ Phật Pháp (~158): id, slug, type (book / dharma_audio / video / course), title, author, code (VD `#phapthoai 001`), cover_media_id, description, file_url / youtube_id, series_id, published_at.

**Series**: id, title, type (pháp thoại nhiều tập, khóa cộng tu theo kỳ); **SeriesItem**: series_id, item_type, item_id, episode_no.

**CalendarEvent** – lịch tu học: id, title (VD "Lương Hoàng Sám"), kind (cong_tu / khoa_le_truyen_thong / dai_le_su_kien), label (VD "Pháp hội – ngày 2/10"), start_date, end_date (datetime), lunar_date (text), recurrence_rule (text, VD "lunar:1,15 monthly"), linked_post_id → Post, note.

**Page** – trang tĩnh/giới thiệu: id, slug, kicker, title, subtitle, body (json blocks: mốc lịch sử, ảnh tư liệu), order.

**Media**: id, r2_key, folder, filename, mime, width, height, size_bytes, alt, caption, uploaded_by → User, created_at. **Album** (id, title) + **AlbumItem** (album_id, media_id, order, caption).

**PageView**: id, entity_type, entity_id, date (date), count (int) – ghi gộp theo ngày.

**AiConversation** (nếu lưu): id, session_id, question, answer, sources (json), feedback (up/down), created_at.

**Registration** [ĐX – cho chức năng "Đăng ký cộng tu"]: id, event_id → CalendarEvent, full_name, dharma_name, phone, email, participants (int), note, status (new/confirmed/cancelled), created_at.

**Notice**: id, title, body, version (VD "v1.0.0"), active (bool), show_once (bool).

**User** (admin): id, email unique, name, role (super_admin/editor/contributor/moderator/viewer), active (bool), last_login_at. **AuditLog**: id, user_id, action, entity_type, entity_id, diff (json), created_at.

**Setting**: key, value (json) – thông tin chùa, danh bạ, giờ mở cửa, mạng xã hội, SEO mặc định.

**Redirect**: from_path, to_path, code (301).

### 3.1b. Cấu trúc dữ liệu thực tế đang dùng [QS – đọc từ API GET của admin]

Mỗi API trả về một "tài liệu JSON lớn" (toàn bộ danh sách trong 1 lần gọi); mã ID dạng chuỗi (`post-1060`, `evt-1791697379651`). Đây là nguồn chuẩn để viết script chuyển sang D1 (Giai đoạn 2).

| API (GET) | Gốc JSON | Số bản ghi | Trường của mỗi bản ghi |
|---|---|---|---|
| `/api/admin/posts` | `{success,total,posts[]}` | **632** (gồm Dòng Chảy 472 + Trí Tuệ 158 + …) | `id, wpPostId, slug, title, subtitle, mainCategory, subCategory, categoryName, author, publishedDate, status, viewsCount, thumbnailUrl, bannerUrl, thumbnailPosition, bannerPosition, summary, content, keywords[], wpModified, galleryCount, photoGallery[{imageUrl,title,isInline}], previousEditions, upcomingEvents, wpAuthorId, wpImageUrl, wpLink, source, sourceBook` |
| `/api/admin/tong-chi` | `{success,data[]}` | 25 | `id, slug, title, subtitle, category, categoryName, bannerImage, bannerPosition, excerpt, content, author, authorLink, publishedAt, updatedAt, status, viewsCount, wpPostId, isLocalEdited, videoBlock{title,subtitle,description,videoUrl}, featuredArticle{label,title,author,bgImage,bgPosition,linkUrl}, photoGallery[{title,imageUrl,khuVuc,noiDung,imagePosition}], sourceBook[{bookTitle,author,coverImage,description,linkUrl}], keywords[{keyword,title,subtitle,description,imageUrl,imagePosition,linkUrl}]` |
| `/api/admin/gioi-thieu` | `{success,total,topics[]}` | 6 | `id, slug, title, subtitle, tag, groupCategory, groupCategoryName, heroBanner(+Position), portraitImage(+Position), overviewSummary, quoteTitle, quoteContent[], quoteAuthor, milestones[{year,title,description}], content, mainContentHtml, galleryImages[{url,caption}], status, orderIndex, wpPostId, wpModified, sourceBook` |
| `/api/admin/vu-tru` | `{success,count,areas[]}` | 14 | `id, pinNumber, slug, name, subtitle, temple, templeName, imgUrl, mapPos{x,y}, description, fullContent, statues[{name,imgUrl,quote,group,cluster,type}], stories[], wpPostId` |
| `/api/admin/bao-tuong` | `{success,total,statues[]}` | 126 | `id, code, slug, name, title, titleName, subtitle, assembly, assemblyId, assemblyName, group, characterGroup, clusterName, clusterMembers[], categoryType, type, hasSinglePage, areaId, areaSlug, areaName, location, imgUrl, avatarUrl, imgRotation, imgPosition, quote, quoteAuthor, description, summary, notes, fullHistoryHtml, articleContent, article{title,author,bannerUrl,url}, artVariations[{id,title,location,meaning,imgUrl}], viewsCount` |
| `/api/admin/danh-tang` | `{success,total,data[]}` | 91 | `id, name, lifespan, region, hoi_chung, sect, era, sub_era, avatarUrl, phapNgu, bio, coordinates{x,y}` |
| `/api/admin/schedule` | `{success,data{…}}` | – | `customEvents[15]{id, slug, solarDateStr "dd.mm.yyyy", title, subtitle, category, timeSlot1Label, timeSlot1Time, timeSlot2Label, timeSlot2Time, location, description, notes, imgUrl, imgPositionY, videoUrl, isMultiDay, endDateStr, continueChanting}` · `featuredPrograms[3]{id,title,subtitle,schedule,summary,time,duration,location,imgUrl}` · `monthThemes{0..11}` (poster + quote theo tháng) · `quoteGallery[12]{id,url,title}` |
| `/api/admin/views-summary` | `{success,stats,topRanked[]}` | top 20 | `stats{totalViews,totalPosts,totalTongChi,totalStatues,viewsHoangPhap,viewsTongChi,viewsTriTue,viewsBaoTuong}` · `topRanked[{id,title,category,type,viewsCount,publishedDate,targetUrl,imageUrl,author}]` |
| `/api/admin/upload?path=` | `{folders[],files[]}` | – | duyệt thư mục B2 |

**Endpoint ghi/nghiệp vụ khác** (đọc từ bundle, tôi **không gọi**): `POST/PUT/PATCH/DELETE` trên `posts`, `posts/{id}`, `posts?id=`, `tong-chi/{id}`, `gioi-thieu`, `vu-tru`, `bao-tuong`, `danh-tang`, `schedule`; `upload` (tải lên) và `upload?key=` (xóa/đổi tên file); `sync-wp`, `sync-wp-posts`, `gioi-thieu/sync-wp`, `vu-tru/sync-wp` (kéo từ WordPress); `wp-post-create` (tạo bài trên WordPress); `wp-media` (ảnh WP mới); `repair-links` (sửa link ảnh hàng loạt); `fetch-metadata?url=` (lấy tiêu đề/ảnh từ URL). Công khai: `/api/home/news-carousel`, `/api/public/dharma-featured`.

**Nhận xét mô hình dữ liệu hiện tại**

- Lượt xem lưu **ngay trong bản ghi** (`viewsCount`), ghi lại toàn bộ file JSON mỗi lượt đọc → dễ mất số liệu khi 2 lượt ghi trùng nhau, không có lịch sử theo ngày.
- **Dữ liệu lặp**: tên khu vực/chúng hội/cụm tượng lưu lặp ở cả `bao-tuong` và `vu-tru.statues[]` (không dùng khóa ngoại) → dễ lệch nhau (đây có thể là nguyên nhân lệch số 12 vs 14 khu vực).
- Ngày tháng không thống nhất: `publishedDate "2026-10-17"`, `publishedAt` ISO, `solarDateStr "04.10.2026"`.
- Nội dung trộn 3 định dạng: Markdown nhẹ (`content`), HTML (`mainContentHtml`, `fullHistoryHtml`), và link WordPress.
- Ảnh tham chiếu bằng URL tuyệt đối tới 3 host (`media-tunglamhoaphuc…b2`, `s2-cnv03…b2`, `admin.tunglamhoaphuc.com/wp-content`) → khi chuyển R2 cần viết lại toàn bộ URL (đã có công cụ `repair-links` làm mẫu).

**Ánh xạ sang mô hình D1 đề xuất (mục 3.1)**: `posts` → Post (+Category theo `mainCategory/subCategory`, Album từ `photoGallery`); `tong-chi` → TeachingArticle (+ bảng con VideoBlock, Keyword, SourceBook); `gioi-thieu` → Page (+ Milestone); `vu-tru` → Area (+ AreaStatue nối sang Statue thay vì lưu lặp); `bao-tuong` → Statue + StatueCluster + ArtVariation; `danh-tang` → **Monk** (thực thể mới: name, lifespan, region, sangha, sect, era, sub_era, avatar_media_id, dharma_quote, bio, coord_x, coord_y); `schedule` → CalendarEvent + MonthTheme + FeaturedProgram + QuoteImage; `viewsCount` → bảng PageView theo ngày.

### 3.2. Điểm thu thập dữ liệu & quy tắc kiểm tra

| Điểm thu thập | Hiện trạng [QS] | Quy tắc đề xuất [ĐX] |
|---|---|---|
| Ô "Hỏi AI Hòa Phúc" | Text input, gửi câu hỏi | Bắt buộc, 3–500 ký tự, chặn spam (Turnstile + giới hạn 10 câu/phút/IP); lỗi: "Kính mời quý vị nhập câu hỏi" |
| Bộ lọc danh mục / sắp xếp | Lọc phía client trên toàn bộ danh sách | Chuyển sang query `?category=&sort=&page=` xử lý phía server, giữ trạng thái trên URL |
| Popup chào mừng | Checkbox lưu `localStorage` | Giữ nguyên, gắn theo `version` thông báo |
| Đăng nhập admin | `required` HTML + kiểm tra phía client | Thay bằng Cloudflare Access; nếu tự làm: email hợp lệ, mật khẩu ≥12 ký tự, khóa sau 5 lần sai, phiên HttpOnly có ký số |
| **Form đăng ký cộng tu** (chưa có) | Nút trỏ sang trang danh sách | Họ tên (bắt buộc, 2–80 ký tự) · Pháp danh (tùy chọn) · SĐT (bắt buộc, `^0\d{9}$`) · Email (tùy chọn, định dạng chuẩn) · Khóa tu (bắt buộc, chỉ sự kiện còn mở) · Số người (1–20) · Ghi chú (≤500) · Turnstile |
| Form liên hệ / góp ý (chưa có) | – | Họ tên, SĐT/Email (ít nhất 1), nội dung 10–2000 ký tự |
| Upload ảnh (admin) | Nén WebP | Chỉ jpg/png/webp/gif, ≤10 MB, tự resize cạnh dài ≤2560px, bắt buộc alt text khi xuất bản |

**Thông điệp phản hồi (Toast) – giọng văn nhà chùa** [ĐX]

- Thành công: "Đăng ký thành công. Ban tổ chức sẽ liên hệ quý Phật tử trong thời gian sớm nhất. Nam Mô A Di Đà Phật 🙏"
- Lỗi trường: "Kính mời quý vị nhập số điện thoại hợp lệ (10 chữ số)."
- Lỗi hệ thống: "Hệ thống đang bận, kính mong quý vị hoan hỷ thử lại sau ít phút."
- Admin: "Đã lưu bài viết" · "Đã xuất bản" · "Không thể xóa: ảnh đang được dùng ở 3 bài viết".

---

## PHẦN 4: HỆ THỐNG NHẬN DIỆN THƯƠNG HIỆU

### 4.1. Logo & biểu tượng

| Thành phần | Hiện trạng [QS] |
|---|---|
| **Logo chính – "Mộc Ấn"** | Khiên chữ nhật bo góc nền đỏ son, viền vàng kim nhiều lớp; bên trong mái chùa cong + monogram "HP" + chữ "TÙNG LÂM HÒA PHÚC". File `09-icon-minh-hoa/logo-moc-an.webp` (400×297) |
| **Logo phụ – dạng tròn** | `logo-tung-lam-hoa-phuc-tron.webp` (được preload trên mọi trang) |
| **Biểu tượng rút gọn** | Ký tự Pháp luân ☸ trong khung tròn/vuông viền vàng (dùng ở trang login, hero chuyên mục) |
| **Favicon** | **Không khai báo** thẻ `<link rel="icon">` – trình duyệt dùng mặc định |

**Quy cách đề xuất** [ĐX]

- Khoảng trống an toàn: tối thiểu bằng **chiều cao chữ "H" trong monogram** (~1/6 chiều cao logo) ở cả 4 phía.
- Kích thước tối thiểu: logo Mộc Ấn ≥ 48px cao (web), dưới mức đó dùng bản ☸ / tròn.
- Vị trí: Header – góc trái, được phép tràn xuống dưới header (đặc trưng hiện tại); Footer – logo tròn căn giữa phía trên tên chùa.
- Favicon: xuất từ bản rút gọn ☸ hoặc monogram HP: `favicon.ico` 32px, `icon.svg`, `apple-touch-icon` 180px, `icon-512.png` (manifest).
- Chống chỉ định: không đổi màu đỏ son/vàng kim; không kéo giãn, xoay; không đặt trên ảnh nhiều chi tiết mà không có lớp phủ tối; không thêm bóng đổ màu khác; không tách monogram khỏi khiên khi dùng làm logo chính.

**Iconography**

- Hệ UI: **lucide-react** – nét outline 1.5–2px, kích thước 16px (nút, input), 20px (menu), 24px (điều hướng).
- Hệ minh họa: icon vẽ tay dạng tròn 512×512 WebP/PNG (`/images/icons/icon-tin-moi-nhat.webp`, `icon-tong-chi-tu-hoc.webp`, `icon-dau-an-hoang-phap.webp`, `icon-khoa-le-truyen-thong.png` – file này 2000×2000, quá lớn) hiển thị 32–64px làm huy hiệu section.
- Ký tự trang trí: ☸, ❖, ➔, 🪷.

### 4.2. Bảng màu chuẩn [QS – trích từ CSS đã render]

**Primary – Vàng kim (Gold)**

| Token đề xuất | HEX | RGB | HSL | Dùng cho |
|---|---|---|---|---|
| `gold-500` (chủ đạo) | `#F2C14E` | 242,193,78 | 42°,86%,63% | Tiêu đề H1/H2, nút Primary, viền nhấn, icon |
| `gold-400` (hover/phát sáng) | `#FFDE59` | 255,222,89 | 48°,100%,67% | Hover nút, tiêu đề popup, viền sáng |
| `gold-200` (kem vàng) | `#FFE5A3` | 255,229,163 | 43°,100%,82% | Tiêu đề phụ, text nhấn trên nền tối |
| `amber-500` (hổ phách) | `#E5A93C` | 229,169,60 | 39°,76%,57% | Nhãn phụ (kicker), tên nguồn |

**Secondary / Accent – Nâu trầm & đỏ son**

| Token | HEX | RGB | HSL | Dùng cho |
|---|---|---|---|---|
| `bronze-600` | `#6B4B2A` | 107,75,42 | 30°,44%,29% | Nền nút Secondary |
| `brown-800` | `#2A1D14` | 42,29,20 | 25°,35%,12% | Nền input, nút phụ admin |
| `cinnabar` (đỏ son – từ logo) | ≈`#8B1E1E` *(ước lượng từ ảnh logo)* | ≈139,30,30 | ≈0°,64%,33% | Chỉ dùng trong logo/điểm nhấn lễ hội; [ĐX] bổ sung chính thức vào token |

**Neutral – Nền, văn bản, đường viền**

| Token | HEX | RGB | HSL | Dùng cho |
|---|---|---|---|---|
| `bg-base` | `#2C1C11` | 44,28,17 | 24°,44%,12% | Nền body, nền thẻ (`--background`) |
| `bg-deep` | `#1A120B` | 26,18,11 | 28°,41%,7% | Nền section xen kẽ, chữ trên nút vàng |
| `bg-deeper` | `#24160E` / `#1C120B` | | | Lớp phủ, nền dropdown |
| `text-primary` | `#E3D2C1` | 227,210,193 | 30°,38%,82% | Văn bản thân bài (`--foreground`) |
| `text-secondary` | `#D3C0AD` | 211,192,173 | 30°,30%,75% | Icon, văn bản phụ |
| `text-muted` | `#C9B896` | 201,184,150 | 40°,32%,69% | Mô tả thẻ, chú thích |
| `text-subtle` | `#A69383` | 166,147,131 | 27°,16%,58% | Metadata, ngày tháng |
| `border-gold` | `#F2C14E` @ 15–60% | | | Viền thẻ (25%), viền input (40%), divider (20%) |
| `overlay` | `#000` @ 45–60% | | | Lớp phủ ảnh, nền pill hero |

**System / Feedback** (hiện chỉ có Error; còn lại đề xuất, chỉnh tông ấm cho hợp nền nâu)

| Trạng thái | HEX | Tương phản trên `#1A120B` | Ghi chú |
|---|---|---|---|
| Error | `#F87171` (red-400) chữ / `#EF4444` viền | 6.69 / 4.92 | [QS] đang dùng trong form login |
| Success | `#22C55E` | 8.12 | [ĐX] |
| Warning | `#F59E0B` | 8.61 | [ĐX] – lưu ý gần giống màu vàng thương hiệu, nên kèm icon |
| Info | `#3B82F6` → đề xuất `#60A5FA` | 5.03 | [ĐX] |

**Đánh giá tương phản WCAG 2.1** (văn bản thường cần ≥4.5:1 cho AA, ≥7:1 cho AAA)

| Cặp màu | Tỷ lệ | Mức |
|---|---|---|
| `#E3D2C1` trên `#2C1C11` | 11.13 | AAA ✅ |
| `#F2C14E` trên `#2C1C11` | 9.77 | AAA ✅ |
| `#FFE5A3` trên `#1A120B` | 14.96 | AAA ✅ |
| `#E5A93C` trên `#2C1C11` | 7.86 | AAA ✅ |
| `#C9B896` trên `#2C1C11` | 8.41 | AAA ✅ |
| `#A69383` trên `#2C1C11` | 5.56 | AA ✅ |
| `#1A120B` trên nút `#F2C14E` | 11.02 | AAA ✅ |
| `#F2C14E` trên nút `#6B4B2A` | 4.70 | AA (sát ngưỡng) ⚠️ |

Kết luận: bảng màu gốc đạt chuẩn tốt. Rủi ro nằm ở **các biến thể trong suốt** (VD `#C9B896` 70%, chữ kem 80%) và **chữ đặt trực tiếp lên ảnh** (hero, thẻ ảnh) – cần lớp phủ tối tối thiểu 50% dưới vùng chữ. Lưu ý thêm: bộ token shadcn trong `:root` (`--primary: #171717`, `--secondary: #f5f5f5`…) vẫn là giá trị mặc định, **không khớp thương hiệu** – nên thay bằng các token ở trên.

### 4.3. Typography [QS]

| Vai trò | Font | Nguồn |
|---|---|---|
| **Display / Tiêu đề** | **UTM Niagara** (serif cổ điển, thân hẹp, cao) | `/fonts/UTMNiagara.ttf` |
| **Tagline trang trọng** | **UTM ClassizismAntiqua** | `/fonts/UTMClassizismAntiqua.ttf` |
| **Nội dung & UI** | **UTM Avo** (sans-serif, Regular/Bold/Italic/BoldItalic) | `/fonts/UTMAvo*.ttf` |
| Đã tải nhưng gần như không dùng | Montserrat, Playfair Display, Noto Serif (Google Fonts, **nạp 2 lần**) | → nên gỡ |
| Fallback lỗi | `<body>` chưa đặt font → rơi về **Times New Roman** cho phần tử không khai báo | → đặt `font-family` cho `body` |

Lưu ý bản quyền: bộ font UTM là font thương mại Việt hóa – cần kiểm tra giấy phép web. Font tải dạng **TTF** (nặng) – nên chuyển sang **WOFF2** + `font-display: swap` + subset tiếng Việt.

**Thang cỡ chữ (desktop)**

| Cấp | Font | Size / Line-height | Weight | Letter-spacing | Màu |
|---|---|---|---|---|---|
| Display (hero) | UTM Niagara | 128 / 128px | 400 | 0 | `#F2C14E` |
| H1 trang chuyên mục | UTM Niagara | 72 / 72px | 400 | 1.8px | `#F2C14E` + phát sáng |
| H2 section | UTM Niagara | 72 / 72px (mobile ~36px) | 400 | 1.8px | `#F2C14E` |
| H2 popup | UTM Niagara | 48 / 60px | 400 | 2.4px | `#FFDE59` |
| H3 nổi bật | UTM Niagara | 36 / 45px | 400 | 0 | `#F2C14E` |
| H3 khối tiêu đề sans | UTM Avo | 20 / 28px | 500 | 0.5px | `#FFE5A3` |
| H4 tiêu đề trên ảnh | UTM Niagara | 18 / 28px | 400 | 0 | kem 90% |
| Card title | UTM Avo | 15 / 20.6px | 700 | 0 | `#F2C14E` |
| Tagline | UTM ClassizismAntiqua | 24 / 30px | 400 | rất rộng (từng ký tự) | `#E3D2C1` |
| Overline (phụ đề section) | UTM Avo | 14 / 20px | 400 | 3.08px (0.22em) | kem 80% |
| Body 1 | UTM Avo | 16 / 24px | 400 | 0 | `#E3D2C1` |
| Body 2 | UTM Avo | 14 / 22.75px (1.625) | 400 | 0 | `#E3D2C1` |
| Caption / meta | UTM Avo | 11 / 16.5–17.9px | 400–500 | 0 | `#C9B896` / `#E5A93C` |
| Button | UTM Avo | 12 / 16px, IN HOA | 700 | 0.6px | theo loại nút |
| Nav item | UTM Avo | 11 / 16.5px, IN HOA | 700 | 1.1px | `#E3D2C1` |

[ĐX] Bổ sung thang mobile dùng `clamp()`: Display `clamp(56px, 12vw, 128px)`, H2 `clamp(36px, 6vw, 72px)`; tăng Body 2 lên 15–16px cho bài dài (người đọc lớn tuổi chiếm tỷ lệ đáng kể).

---

## PHẦN 5: ĐÁNH GIÁ CHUNG

### 5.1. Phong cách thiết kế

**Truyền thống – Tâm linh cao cấp (Luxury Spiritual / Dark Heritage)**, hiện thực bằng kỹ thuật hiện đại:

- Nền tối nâu gỗ trầm, vàng kim phát sáng (glow), viền mảnh như khung tranh sơn mài – gợi không gian chính điện thắp nến.
- Kết hợp **glassmorphism** nhẹ (header kính mờ, lớp phủ trong suốt) và chuyển động mượt (slider, hover).
- Typography serif thân hẹp in hoa tạo cảm giác hoành phi, câu đối.
- Nhiều thơ, câu kệ chen giữa giao diện (khối lịch có bài thơ "Hoằng Pháp – Kiến An mãi nhớ Thầy").
- Tính nhất quán cao giữa site công khai và trang quản trị.

### 5.2. Giọng văn (Tone of Voice)

**Tôn nghiêm – ấm áp – kính ngữ nhà Phật.** Xưng hô "quý Phật tử", "quý vị", "Chư Tôn Đức"; dùng từ "hoan hỷ", "kính mời", "kính bạch", "Nam Mô…"; ngay cả trang lỗi cũng giữ kính ngữ ("Kính mời quý vị hoan hỷ trở về…"). Nội dung pha trộn học thuật (Phật học, tiểu sử) và văn chương (thơ của Vô Trí – Tâm Hòa). Giữ nguyên giọng này cho mọi thông báo hệ thống, toast, email xác nhận.

### 5.3. Đánh giá trải nghiệm (UX Review)

**Điểm mạnh**

- Bản sắc thị giác mạnh, khác biệt so với các website chùa thông thường.
- Kiến trúc nội dung giàu, liên kết chéo tốt (Khu vực ↔ Bảo tượng ↔ Bài viết).
- Trợ lý AI có mặt ở mọi trang – điểm mới.
- Lịch tu học kép dương/âm lịch rất phù hợp đối tượng.
- Trang 404 và trạng thái lỗi được thiết kế cẩn thận.

**Vấn đề cần xử lý** (theo thứ tự ưu tiên)

| Mức | Vấn đề | Bằng chứng | Khắc phục |
|---|---|---|---|
| 🔴 | **Admin không được bảo vệ** | Xem Cảnh báo đầu tài liệu | Cloudflare Access + xác thực phía server |
| 🔴 | **Trang danh sách quá nặng** | `/dong-chay-hoang-phap`: HTML 3 MB (giải nén), **472 thẻ / 946 ảnh** trong 1 trang, chỉ một nửa ảnh lazy-load | Phân trang/cuộn vô hạn 12–24 bài, lọc phía server |
| 🔴 | **Ảnh không qua CDN, không resize** | Ảnh tải thẳng từ B2 (Mỹ) và WordPress (`.jfif` 2048px làm thumbnail) | R2 + Image Transformations, `srcset` theo cỡ hiển thị |
| 🟠 | **SEO yếu** | Hầu hết trang chung 1 `<title>` và 1 meta description; không có Open Graph, JSON-LD, `sitemap.xml`, favicon | `generateMetadata` theo từng trang, OG image, sitemap động, schema `Article`/`Event`/`Place` |
| 🟠 | **Nội dung tải phía client** | Một số trang chi tiết HTML ban đầu chỉ có "Đang tải dữ liệu…" (VD `/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh`, `/tri-tue-phat-phap/hoc-tieng-tang`) | Render phía server (RSC/ISR) |
| 🟠 | **Soft 404 / sai nội dung** | `/dong-chay-hoang-phap/le-hang-thuan-tai-tung-lam-hoa-phuc` (link từ trang chủ) trả mã 200 nhưng HTML hiển thị "Bài viết không còn tồn tại"; `/gioi-thieu/su-phu-tru-tri` có title "Sa môn Thích Tâm Hòa" nhưng nội dung là Đại sư Liên Đăng | Sửa dữ liệu/route; trả 404 thật khi không có bài |
| 🟠 | **"Đăng ký cộng tu" không có form** | Nút trỏ về trang danh sách | Xây form đăng ký + quản lý trong admin |
| 🟡 | Menu tràn ở 1024px | Ảnh chụp desktop | Hamburger đến 1279px |
| 🟡 | Font nặng & thừa | 4 file TTF + Google Fonts 3 họ nạp 2 lần không dùng; YouTube iframe API nạp sẵn trên trang chủ | WOFF2, gỡ font thừa, nạp YouTube khi người dùng bấm (facade) |
| 🟡 | Popup chào mừng chặn nội dung lần đầu | Ảnh chụp | Thu gọn thành banner, hoặc chỉ hiện ở trang chủ |
| 🟡 | Ngày đăng đồng loạt | 5 bài "Dấu ấn hoằng pháp" cùng ngày 23/08/2026 (nhiều khả năng là ngày import) | Khôi phục ngày gốc khi chuyển dữ liệu |

**Tốc độ tải (ước lượng)**: trang chủ ở mức khá trên cáp quang nhờ HTML nén (~160 KB), nhưng LCP bị kéo dài bởi ảnh hero gốc 1920px từ B2 Mỹ và font TTF; trên 4G tại Việt Nam dự kiến LCP 3–5 giây. Trang danh sách Dòng Chảy Hoằng Pháp là điểm nghẽn lớn nhất (hàng trăm request ảnh). Sau khi chuyển sang R2 + CDN + phân trang, mục tiêu LCP < 2,5 giây là khả thi.

**Tính dễ dùng**: điều hướng rõ ràng cho người quen web; với người lớn tuổi nên tăng cỡ chữ thân bài, tăng vùng chạm của nút (≥44px), và thêm ô tìm kiếm từ khóa truyền thống bên cạnh AI.

**Khả năng mở rộng (Scalability)**: kiến trúc nội dung (chuyên mục – khu vực – bảo tượng – series) phù hợp mở rộng. Rào cản hiện tại là dữ liệu phân tán ở 3 nơi (13 file JSON trong bucket, WordPress, B2) và không có RBAC. Kiến trúc đích trong kế hoạch Cloudflare (Workers + D1 + R2 + Access) giải quyết đúng các điểm này; mô hình dữ liệu ở Phần 3 có thể dùng làm schema D1 cho Giai đoạn 2.

---

## PHỤ LỤC: Những gì chưa khảo sát được

- ~~Giao diện bên trong `/admin`~~: đã khảo sát ngày 02/11 trong phiên do chủ site tự đăng nhập, **chỉ đọc** (chỉ mở xem, không lưu/xóa/tải lên/đồng bộ).
- Việc API `/api/admin/*` có tự kiểm tra quyền phía server hay không (cần đọc mã nguồn hoặc thử trên staging).
- Hành vi các nút ghi (đồng bộ WordPress, Google Sheets, sửa link ảnh hàng loạt, xóa): chỉ biết qua tên nút/endpoint, chưa chạy thử.
- Cấu hình trợ lý AI (mới biết có dấu hiệu dùng Dify).
- Cấu hình trợ lý AI (mô hình, nguồn tri thức).
