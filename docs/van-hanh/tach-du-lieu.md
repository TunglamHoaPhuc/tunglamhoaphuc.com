# Tách dữ liệu v2 khỏi web cũ (T42a: kiểm kê)

> Đo ngày 17/11/2026. Liên quan: [tasks/todo.md](../../tasks/todo.md) T42a–T42e, [nguon-b2.md](nguon-b2.md) (T19).
> Phương án A của chủ dự án: tách theo từng bước, giữ nguyên kiến trúc `ContentRepository`.

## 1. Sơ đồ hiện tại

Sơ đồ rút từ graphify (graph làm mới 17/11: 1.836 nút, 4.809 cạnh) và đối chiếu với mã.

```
 NGUỒN CHỮ  (CONTENT_SOURCE)             LỚP NỘI DUNG                    TRANG
 ┌───────────────────────────────┐
 │ snapshot  data/snapshot/*.json │─┐
 │   7 file, chép từ www/api/admin│ │   sources/files.ts               ┌ trang chủ, Dòng Chảy
 ├───────────────────────────────┤ ├─► createFileLoaders ─► fromFiles ─►├ Lịch tu học, Giới thiệu
 │ b2   đọc thẳng bucket B2       │─┤        │                         ├ Tông Chỉ, Vũ Trụ, Bảo Tượng
 │   (T19: mã xong, chưa có khóa) │ │        ▼                         ├ Trí Tuệ Phật Pháp, Liên hệ
 ├───────────────────────────────┤ │  getContentRepository()          ├ Tìm kiếm, sitemap, SEO
 │ d1   (T39, chưa có)            │─┘  → ContentRepository (types.ts)  └ (tất cả qua MỘT cửa này)
 └───────────────────────────────┘

 ẢNH:  normalize.ts / posts.ts / schedule.ts ─► mediaUrl() ─► imageAt() ─► /cdn-cgi/image ─┐
                                                                                            ▼
        trình duyệt ◄── ảnh đã thu nhỏ ◄── /anh-goc/<bucket>/<key> ◄── B2 (2 bucket) · WordPress
```

- Mọi trang đọc dữ liệu qua `getContentRepository()`. Không trang nào tự đọc file JSON hay gọi API web cũ.
- Đổi nguồn chữ chỉ cần đổi `CONTENT_SOURCE`; không phải sửa trang.
- Mọi địa chỉ ảnh đi qua `mediaUrl()` ([media.ts](../../src/libs/content/media.ts)), nên đổi nơi chứa ảnh chỉ sửa một chỗ.

## 2. Nơi v2 còn dựa vào web cũ

| Chỗ | Dùng cho | Dựa vào |
|---|---|---|
| `npm run snapshot:fetch` | 7 file JSON trong `data/snapshot/` | `www.tunglamhoaphuc.com/api/admin/*` (Vercel) |
| Nguồn `b2` (T19) | JSON thời gian thực | bucket B2 mà admin cũ ghi (chưa có khóa) |
| Ảnh B2 | bài, album, lịch, Bảo Tượng | bucket `s2-cnv03` và `media-tunglamhoaphuc` |
| Ảnh WordPress | bài mới tải lên admin cũ, Tông Chỉ | `admin.tunglamhoaphuc.com` (máy chủ 209.42.27.235) |
| Ảnh câu kệ của lịch | 12 ảnh | `/images/lich-tu-hoc/quotes/…` trên site cũ (Vercel) |

## 3. Kho ảnh: số liệu đo

Quét mọi chuỗi URL trong 7 file snapshot, gom theo nơi file thật sự nằm, rồi gửi HEAD tới B2 (qua địa chỉ S3) và WordPress.

| Nơi chứa | Số file duy nhất | Tìm thấy | Dung lượng | Trung vị | p90 | Lớn nhất |
|---|---|---|---|---|---|---|
| B2 `s2-cnv03` | 20.379 | 20.358 | 2,94 GB | 92 KB | 210 KB | 2,5 MB |
| B2 `media-tunglamhoaphuc` | 133 | 133 | 0,06 GB | 227 KB | 1,3 MB | 4,5 MB |
| WordPress `admin.` | 912 | 393 | 0,65 GB | 549 KB | 5,4 MB | 9,3 MB |
| **Cộng phần của chùa** | **21.424** | **20.884** | **≈ 3,65 GB** | | | |
| Trang bên ngoài (fbcdn, tienphong, infonet…) | 157 | không đo | không chép được | | | |
| Ảnh trong `public/` của site cũ (câu kệ) | 12 | không đo | nhỏ | | | |

- **Tổng khoảng 21,6 nghìn ảnh**, gấp hơn 3 lần con số "khoảng 6.000" ở kế hoạch cũ. Phần lớn (14.784 trong `post-albums.json`) là ảnh album.
- Tên miền `b1.congngheviet.com.vn` và `s2-cnv03.s3…` là hai địa chỉ của **cùng một bucket**; không có file nào trùng hai lần.
- Phần lớn ảnh album đã nhỏ (trung vị 92 KB). Ảnh nặng tập trung ở WordPress: 45 file trên 5 MB, toàn là ảnh gốc máy ảnh.
- Dung lượng **dưới hạn mức miễn phí 10 GB** của R2. Chưa tính bản thu nhỏ vì Image Transformations tạo ở edge, không lưu thêm.
- Chi phí R2 ước tính: lưu 3,65 GB trong 10 GB miễn phí; ghi khoảng 21 nghìn lần (hạn mức miễn phí 1 triệu lần mỗi tháng). Số liệu về giá lấy từ kế hoạch cũ, nên kiểm lại bảng giá hiện hành trước khi tạo bucket.

### Ảnh không tìm thấy (540 file)

- 21 file trên B2 và 519 file trên WordPress trả lỗi (404 hoặc hết thời gian chờ). Script chưa tách riêng hai loại này, nên 540 là **mức tối đa**; vài file có thể chỉ chậm.
- Với WordPress, nhiều file là ảnh "đường dẫn soạn sẵn nhưng chưa từng tải lên" mà `snapshot:check` đã báo (`unsaved-image`). Trang hiện như không có ảnh, không phải lỗi mới.
- Một số khóa B2 dạng `tunglamhoaphuc-com/wp-content/uploads/…` là bản sao ảnh WordPress trên B2; một số bản sao thiếu.

### Rủi ro khi chuyển `www`

- 495 ảnh trỏ vào `tunglamhoaphuc.com/wp-content/…`. Khi `www` chuyển sang web mới, đường dẫn này hỏng. `mediaUrl()` đã đổi chúng sang `admin.tunglamhoaphuc.com`, nhưng chỗ đó cũng sẽ tắt ở Checkpoint J. Vì vậy 393 ảnh WordPress còn sống phải chép sang R2.
- Ảnh trang bên ngoài (nhất là `fbcdn`) có địa chỉ hết hạn. Nên ghi nhận danh sách này để biên tập viên thay ảnh, hoặc chấp nhận hỏng.

## 4. Quy ước riêng của dữ liệu web cũ

Đọc từ [normalize.ts](../../src/libs/content/normalize.ts), [schema.ts](../../src/libs/content/schema.ts), [posts.ts](../../src/libs/content/posts.ts):

- **Ngày** có ba kiểu: `2026-10-17`, ISO có giờ (đọc theo múi giờ Việt Nam) và `04.10.2026`.
- **Nội dung bài** là Markdown nhẹ (`#`, `>`, `*`, `1.`, `---`, ảnh, liên kết). Bộ chuyển đổi tự viết, chỉ sinh vài thẻ HTML.
- **Ảnh emoji** bị bỏ khi dựng bài; **liên kết `tunglamhoaphuc.com/wp-content`** đổi sang `admin.`.
- **Schema dễ dãi (zod `.catch`)**: trường thiếu thì lấy giá trị rỗng; bản ghi thiếu `id`, `slug`, mục hay ngày thì báo và bỏ qua. Dữ liệu hỏng không làm sập trang nhưng cũng có thể bị lặng lẽ bỏ.
- **Album**: API danh sách của admin cũ để trống album của 447 bài (`galleryCount` > 0, `photoGallery` rỗng); chỉ API chi tiết từng bài mới có ảnh (ghi trong mục rủi ro của tasks/plan.md).
- Khi chuyển sang D1 (T23, T39) các quy ước này phải được chuyển thành dữ liệu sạch một lần, rồi bỏ khỏi đường chạy thường xuyên.

## 5. Hệ quả cho T42b–T42e

- **T42b**: chép khoảng 20.900 file, tổng ≈ 3,65 GB. Thời gian chạy chưa đo; script phải chạy lại được và có giới hạn tốc độ.
- **T42b**: ảnh WordPress cần xử lý riêng (45 file trên 5 MB; nên thu về ≤ 2560 px khi chép).
- **T42c**: khóa trong R2 giữ nguyên dạng `<bucket>/<key>`; bucket WordPress đặt tên riêng, ví dụ `wordpress/<đường dẫn>`.
- Cần quyết: ảnh trang bên ngoài (157 file) — để nguyên hay thay.
- Cần quyết: duyệt tạo bucket R2 (chi phí gần như bằng 0 với dung lượng này).

## 6. T42b: ảnh đã chép sang R2 (17/11/2026)

- **Bucket:** `tlhp-media`, tài khoản Cloudflare của zone (`b91a395bd9b7ab86ef4cba41d1d828ae`), vùng APAC, **riêng tư, không có tên miền công khai**. Chỉ Worker đọc, qua binding (việc của T42c).
- **Quy ước khóa** (T42c phải đọc đúng như vậy):

| Nguồn | Khóa trong R2 | Ví dụ |
|---|---|---|
| B2 (hai bucket) | `<bucket>/<key>`, giữ nguyên | `s2-cnv03/uploads/abc.jpg` |
| WordPress `admin.` (cả link `tunglamhoaphuc.com/wp-content/…`) | `wordpress/<đường dẫn sau /wp-content/uploads/>` | `wordpress/2026/07/x.jpg` |
| Ảnh `public/` của site cũ (câu kệ) | `site/<đường dẫn>` | `site/images/lich-tu-hoc/quotes/thang-01-quy-y-tam-bao.png` |

  Với B2, `/anh-goc/<bucket>/<key>` chính là khóa R2. Với WordPress, `mediaUrl()` hiện cho ra `admin.tunglamhoaphuc.com/wp-content/uploads/<đường dẫn>`; T42c đổi sang khóa `wordpress/<đường dẫn>`. Ảnh câu kệ là đường dẫn tương đối `/images/lich-tu-hoc/quotes/…`, khóa là `site` cộng đường dẫn đó.
- **Số liệu thật:** danh sách 21.470 khóa (B2 `s2-cnv03` 20.380, `media-tunglamhoaphuc` 133, WordPress 945, câu kệ 12). **20.912 ảnh đã nằm trong R2, 2,95 GB.** Không thiếu khóa nào ngoài danh sách lỗi, không có khóa thừa.
- **558 ảnh lỗi** (danh sách trong `data/snapshot/media-copy/bao-cao-loi.json`, không đưa vào kho): 557 là 404 thật (5 B2, 552 WordPress; WordPress phần lớn là ảnh "chưa từng tải lên"), 1 là khóa `s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2019/05/1..jpg` có `..` trong tên nên Cloudflare từ chối đường dẫn (trang đã không dùng được ảnh này; T42c nên coi `..` là khóa không hợp lệ như `b2Source()` đang làm).
- **Gỡ EXIF và thu nhỏ:** 5.950 ảnh được mã hóa lại (có EXIF, XMP hoặc xoay theo EXIF, hoặc dài hơn 2560 px); phần còn lại giữ nguyên byte. Mẫu ngẫu nhiên 50 ảnh đọc lại từ R2: 0 ảnh còn EXIF/XMP/IPTC, 0 ảnh dài hơn 2560 px. Tải về 3,63 GB, ghi vào R2 2,95 GB.
- **Thời gian:** lần đầu 67 phút (14 luồng, 3.667 ảnh lỗi ghi nhất thời do API), lần bù 20 phút (8 luồng), lần kiểm 1 phút. Lần chạy thứ ba không chép lại ảnh nào (chỉ thử lại 558 ảnh lỗi, vẫn 404).
- **Cách chạy lại:**

```bash
npm run media:copy -- --dry-run          # chỉ đếm danh sách
npm run media:copy -- --limit=50         # mẫu: 50 ảnh mỗi nhóm
npm run media:copy                       # chép phần còn thiếu (bỏ qua khóa đã có)
npm run media:copy -- --verify           # đối chiếu số khóa, tổng dung lượng, mẫu EXIF
```

  Cần `cf auth` với profile `tlhp` và `CLOUDFLARE_ACCOUNT_ID` như trên (mặc định trong script). Báo cáo ghi ở `data/snapshot/media-copy/` (đã nằm trong `.gitignore`). Khi dữ liệu snapshot thêm ảnh mới thì chạy lại là đủ. Ảnh đã chép không bị ghi đè khi nguồn đổi; muốn thay phải xóa khóa trong R2 trước.
- **Chưa làm:** T42c (route `/anh-goc/` đọc R2, binding) và deploy. Ảnh của 157 trang bên ngoài không chép.
