# Biến thể ảnh trong R2 (23/11/2026)

Site giao ảnh gốc nguyên kích thước cho khung nhỏ. Cách chữa lâu dài (phương án khuyến nghị của `docs/toi-uu-anh-23-11-2026.md` ở repo V3): dựng sẵn bản AVIF và WebP theo từng chiều rộng chuẩn, để **cạnh bản gốc trong R2**, rồi phục vụ qua `/anh-goc/` có bộ đệm. Không phụ thuộc hạn mức 5.000 biến đổi mỗi tháng của `/cdn-cgi/image`, và ảnh nặng 0,3 đến 2,6 MB không còn rơi về bản gốc khi hết hạn mức.

Ba phần: **công cụ dựng** (`scripts/media-variants.mjs`), **route phục vụ** (`src/libs/content/mediaRoute.ts`, bản chép ở V3), **công tắc giao ảnh** (`IMAGE_DELIVERY` trong `src/libs/content/media.ts`, bản chép ở V3). Mặc định công tắc là `cgi`: hôm nay site giao ảnh y như trước.

## 1. Đặt tên khóa và bậc chiều rộng

```
<khóa gốc đầy đủ>@<rộng>.<avif|webp>        ví dụ  media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/a.webp@640.avif
<khóa gốc đầy đủ>@max.<avif|webp>           bản lớn nhất: rộng bằng ảnh gốc, tối đa 2560
```

- Giữ nguyên đuôi gốc trong khóa (`04.png` và `04.jpg` không đụng nhau).
- Bậc: **160, 360, 640, 960, 1280, 1920**, chỉ lấy các bậc **nhỏ hơn** chiều rộng gốc (sau khi xoay theo EXIF), cộng `max` = min(rộng gốc, 2560). Không phóng to.
- Mọi khóa biến thể đều có `@`. Công cụ **không bao giờ ghi một khóa không có `@`**, không ghi đè, không xóa; ảnh gốc có `@` trong khóa bị bỏ qua. Vì vậy mọi biến thể xóa được bằng một lệnh lọc theo `@` mà không đụng ảnh gốc.
- Danh sách bậc có ở hai nơi, một kiểm thử giữ chúng bằng nhau: `scripts/media-variants.mjs` (`LADDER`, `MAX_WIDTH`) và `media.ts` (`VARIANT_WIDTHS`, `VARIANT_MAX_WIDTH`, route dùng chung).

## 2. Ngưỡng chất lượng (cổng)

Mỗi (ảnh, bậc, định dạng) lấy mức chất lượng **đầu tiên** đạt cả hai:

- **SSIM-Y ≥ 0,96** (SSIM chuẩn Wang 2004, cửa sổ Gauss 11×11, trên độ sáng, so với chính ảnh gốc thu về cùng kích thước bằng Lanczos3; điểm ảnh trong suốt được đặt lên nền trắng),
- **p5 ≥ 0,85** (phân vị 5% thấp nhất của bản đồ SSIM cục bộ, bắt lỗi cục bộ ở chữ, mặt, hoa văn).

Thang (hồ sơ B, thận trọng): **AVIF** effort 4 bắt đầu q70 rồi 80, 90; **WebP** effort 5 `smartSubsample` bắt đầu q85 rồi 90, 95. Mức đầu đạt cổng nhưng **không nhỏ hơn quy tắc kích thước gốc** thì mới hạ xuống q60 (AVIF) hoặc q80 (WebP), không bao giờ thấp hơn.

**Quy tắc kích thước gốc:** biến thể chỉ được ghi khi nhỏ hơn bản gốc thu về cùng chiều rộng và mã hóa theo định dạng của gốc (JPEG q85 mozjpeg, PNG mức 9, WebP q85; với bậc bằng đúng chiều rộng gốc thì so với chính tệp gốc). Không đạt cổng hoặc không nhỏ hơn: **không ghi** biến thể định dạng đó ở bậc đó; route sẽ dự phòng (mục 3). Không tạo JPEG biến thể. GIF động và SVG bị bỏ qua.

Cổng 0,96 và p5 0,85 vẫn **chờ chủ duyệt** (tấm so sánh 100% ở thư mục nháp của báo cáo, mục 2 của tài liệu V3).

## 3. Route phục vụ

`GET /anh-goc/<bucket>/<khóa>@<rộng>[.avif|.webp]`:

1. Bóc `@<rộng>`; **rộng không chuẩn làm tròn LÊN** bậc kế (`@500` là `@640`, quá 1920 là `max`), nên một ảnh chỉ có tối đa 7 địa chỉ, không ai tạo được khóa bộ đệm vô hạn.
2. Chọn định dạng: có đuôi thì tuân theo đuôi; không đuôi thì theo `Accept` (AVIF nếu có, rồi WebP), kèm `Vary: Accept`. `Accept` không có cả hai (`*/*`, trình duyệt cũ, `curl`) thì đi thẳng tới bản gốc.
3. Dự phòng, theo thứ tự: **cùng bậc, định dạng còn lại** (chỉ khi không có đuôi), rồi **từng bậc lớn hơn** (rồi `max`), rồi **bản gốc** trong R2, rồi B2 / WordPress như hiện nay (vẫn ghi một dòng JSON `media-fallback` mỗi lần phải rơi về đó). Không có gì: 404.
4. Đầu ra:

| Tình huống | `X-Image-Variant` | `Cache-Control` |
|---|---|---|
| đúng bậc, đúng định dạng | `hit` | `public, max-age=31536000, immutable` |
| bậc hoặc định dạng khác thay thế | `fallback` | `public, max-age=86400, stale-while-revalidate=604800` |
| không có biến thể nào, trả bản gốc | `miss` | `public, max-age=3600, stale-while-revalidate=86400` |
| khóa thường, không `@` (như trước) | không có | `public, max-age=2592000, stale-while-revalidate=604800` |

   Hai dòng giữa ngắn hơn có chủ ý: khi biến thể đúng được dựng sau đó, trình duyệt và biên đổi sang nó trong vòng một ngày hoặc một giờ thay vì giữ bản thay thế một năm.
5. **Bộ đệm `caches.default`**: kết quả 200 được ghi bằng `ctx.waitUntil(cache.put(...))` dưới khóa gồm ảnh, bậc chuẩn, đuôi và các định dạng được phép (`?f=avif+webp`, `?f=webp`, `?f=-`), nên AVIF và WebP của cùng một địa chỉ không lẫn nhau. Áp dụng cho cả ảnh gốc (trước đây `/anh-goc/*` luôn `BYPASS`). 404 không được ghi. Lỗi bộ đệm chỉ ghi một dòng `media-cache-error`, không làm hỏng yêu cầu.

## 4. Công tắc giao ảnh

`media.ts` có hằng `IMAGE_DELIVERY: "cgi" | "variants"` (mặc định **`"cgi"`**). Đây là chỗ duy nhất để đổi:

- `cgi`: `imageAt()` giữ địa chỉ `/cdn-cgi/image/width=640,quality=75,format=auto,onerror=redirect/anh-goc/…` như hôm nay.
- `variants`: `imageAt(src, width)` dựng `/anh-goc/<bucket>/<khóa>@<bậc>` (không đuôi, để `Accept` quyết định). Ảnh không có biến thể (GIF, SVG, có `?`), ảnh tĩnh của site (`/images`, `/brand`) và host lạ giữ nguyên. `imageSrcSet(src, widths, originalWidth?)` cho `srcset` thật theo bậc chuẩn (làm tròn lên, bỏ trùng); nếu biết chiều rộng gốc (`media.width`) thì danh sách dừng ở đó và `@max` đứng cho chiều rộng gốc (mô tả `<rộng gốc>w`). Không truyền `widths` thì dùng mọi bậc chuẩn. `albumImageAt` cũng dùng biến thể cho ảnh B2 (không tốn hạn mức).
- `IMAGE_WIDTH` có thêm `icon: 160` và `mid: 960` (các tên và giá trị cũ giữ nguyên).
- V3: `fitImage()` và `getOptimizedNextImageUrl()` (`src/utils/image.ts`) theo cùng công tắc, vì gọi `imageAt()` của bản chép `media.ts`.

**Chỉ đổi sang `variants` sau khi biến thể đã có trong R2** (mục 5). Nếu đổi sớm cũng không hỏng ảnh (route dự phòng tới bản gốc), nhưng mất lợi ích và mỗi lần chưa có biến thể tốn tới 14 lần đọc R2 (được bộ đệm một giờ giữ lại).

## 5. Chạy công cụ

Cần: `sharp` (đã có trong `devDependencies`), hồ sơ `cf` tên `tlhp` đăng nhập sẵn. Công cụ không bao giờ in khóa hay token.

```powershell
# Thử không ghi gì (đọc, thu nhỏ, nén, chấm SSIM, in số liệu), với bản sao cục bộ hoặc với R2 (chỉ đọc):
node scripts/media-variants.mjs --local-dir <thư mục ảnh gốc> --dry-run
node scripts/media-variants.mjs --dry-run --only media-tunglamhoaphuc/tunglamhoaphuc2/ --limit 20

# Giai đoạn đầu: đúng danh sách khóa các trang đo (một khóa mỗi dòng, hoặc mảng JSON), có manifest:
node scripts/media-variants.mjs --keys-file khoa-giai-doan-dau.txt --manifest out/dot-1.jsonl

# Dựng bù phần chưa có biến thể nào (ảnh mới, ảnh WordPress cũ):
node scripts/media-variants.mjs --missing --only wordpress/ --manifest out/wordpress.jsonl

# Kiểm tra mẫu: đọc lại 30 biến thể cùng ảnh gốc, tính lại SSIM, kiểm kích thước và kiểu nội dung:
node scripts/media-variants.mjs --verify --sample 30 --only media-tunglamhoaphuc/
```

| Tùy chọn | Việc |
|---|---|
| `--dry-run` | làm hết trừ ghi |
| `--only <tiền tố>` | chỉ khóa bắt đầu bằng tiền tố (nhắc lại hoặc ngăn bằng dấu phẩy); không có thì liệt kê cả bucket |
| `--keys-file <tệp>` | chỉ các khóa trong tệp |
| `--missing` | chỉ ảnh chưa có biến thể nào (không tải ảnh còn lại) |
| `--limit N` | tối đa N ảnh (theo thứ tự khóa) |
| `--concurrency N` | số ảnh đang xử lý, mặc định 12 (`cf`), 32 (S3), 4 (cục bộ) |
| `--workers N` | số luồng thu nhỏ, nén, chấm điểm; mặc định min(4, số lõi − 2); 0 là chạy trong luồng chính |
| `--manifest <tệp>` | mỗi dòng một JSON: `image` (khóa, W, H, byte, định dạng, etag), `variant` (khóa, khóa biến thể, W, H, bậc, định dạng, w, h, byte, q, ssim, p5, trạng thái: `written`, `would-write`, `exists`, `gate`, `bigger`, `error`), `skip`, `error`. Dùng để nạp `width`/`height` vào D1 |
| `--local-dir <thư mục>` `--out-dir <thư mục>` | đọc ảnh gốc từ thư mục, ghi biến thể ra `--out-dir` (mặc định `<thư mục>-variants`); không cần đám mây |
| `--backend cf\|s3` | mặc định `s3` nếu có `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` trong môi trường, nếu không thì `cf` |
| `--verify [--sample N]` | kiểm mẫu như trên; mã thoát 1 nếu có biến thể dưới cổng hoặc sai kích thước |

Hai cách vào R2:

- **`cf`** (mặc định): chạy `node_modules/cf/bin/cf r2 objects list|get|put` với `--profile tlhp`, khoảng 2 giây mỗi lệnh nên chạy 12 ảnh song song. `cf r2 objects put` **không đặt được siêu dữ liệu tùy chọn**, nên với cách này độ tươi của biến thể được xét theo giờ sửa cuối (biến thể không cũ hơn bản gốc thì bỏ qua) thay vì `src-etag`.
- **S3** của R2 (khuyên dùng cho đợt lớn, hơn 200.000 đối tượng): token riêng cho bucket `tlhp-media` do chủ tạo, `npm i --no-save @aws-sdk/client-s3` rồi đặt ba biến môi trường. Ghi thêm siêu dữ liệu `src`, `src-etag`, `w`, `h`, `q`, `ssim`, `gen`. Phần S3 chưa chạy thử với điểm cuối thật.

**Idempotent**: chạy lại thì bỏ qua biến thể đã có và không cũ hơn bản gốc; biến thể bị cổng hoặc quy tắc kích thước loại thì mỗi lần chạy lại tính lại (chỉ tốn CPU, không ghi gì). Nén AVIF và chấm SSIM tốn CPU: khoảng 15 đến 20 giây CPU cho một ảnh cỡ trung, nên 1.255 ảnh giai đoạn đầu cần vài chục phút với 4 luồng.

## 6. Quay lui

- **Nhanh nhất:** đổi `IMAGE_DELIVERY` về `"cgi"` ở `media.ts` (cả bản chép V3) rồi deploy: mọi `imageAt()`/`fitImage()` trở lại `/cdn-cgi/image/…`. Các địa chỉ `@<rộng>` đã phát vẫn chạy (route vẫn phục vụ), nên trang đã lưu đệm không vỡ.
- **Xóa hẳn biến thể:** xóa mọi khóa có `@<số hoặc max>.<avif|webp>` ở cuối, lọc đúng bằng mẫu đó (`cf r2 objects list` rồi `bulk-delete`, hoặc `aws s3 rm` có lọc). Không bao giờ xóa theo tiền tố mà không lọc `@`: ảnh gốc không có `@` nên không bị đụng, nhưng một tiền tố rộng vẫn xóa nhầm ảnh gốc. Cần chủ đồng ý trước khi xóa trên R2 thật.
- **Kiểm tra ảnh gốc không đổi** (tiêu chí hoàn tất của kế hoạch): đếm khóa và `etag` của các khóa **không** có `@` trước và sau khi dựng; hai danh sách phải khớp. Công cụ không có đường ghi nào vào khóa không có `@`.
- Sau khi bật `variants`, theo dõi bằng Workers Logs: dòng `media-fallback` (ảnh gốc thiếu trong R2) và đo tỉ lệ `X-Image-Variant: miss` (biến thể chưa dựng). Nếu có nhiều `miss`, chạy lại công cụ với `--missing`.

## 7. Chạy thử khô trên 227 ảnh mẫu (23/11/2026)

`--local-dir` trên 226 ảnh của mẫu thí nghiệm (192 JPEG, 18 WebP, 14 PNG, 2 GIF tĩnh; 90,7 MB) với `--dry-run`, 5 luồng, 746 giây (khoảng 16 giây CPU mỗi ảnh). Không có ảnh bị bỏ qua hay lỗi nén.

| | AVIF | WebP |
|---|---|---|
| tệp sẽ ghi | 1.053 | 1.127 |
| byte | 82,8 MB | 91,3 MB |
| chỉ các bậc 160 đến 1920 so với byte gốc | 0,55 | 0,60 |
| chỉ `@max` so với byte gốc | 0,36 | 0,41 |
| mọi biến thể so với byte gốc | 0,91 | 1,01 |
| SSIM-Y trung vị / thấp nhất | 0,986 / 0,961 | 0,982 / 0,961 |
| p5 trung vị / thấp nhất | 0,960 / 0,875 | 0,949 / 0,891 |
| chất lượng đã chọn | q60: 274, q70: 778, q80: 1 | q80: 368, q85: 757, q90: 2 |

- Thí nghiệm trước (hồ sơ B, không cổng, không bậc `max`) ước các bậc nhỏ hơn gốc là 0,57 (AVIF) và 0,87 (WebP) byte gốc: AVIF khớp (0,55); WebP nhỏ hơn vì lần này bắt đầu ở q85 chứ không phải q90.
- Cổng 0,96 gần như không bao giờ chặn ở độ sáng (0 biến thể bị loại vì cổng; chỉ 1 AVIF và 2 WebP phải lên mức cao hơn): SSIM của thí nghiệm trước tính thêm trên các kênh màu nên thấp hơn. Chỗ quyết định thực sự là **quy tắc kích thước gốc**: 130 biến thể không ghi vì không nhỏ hơn bản gốc thu nhỏ (75 AVIF và 9 WebP ở bậc 160, nơi tiêu đề tệp AVIF đã lớn hơn JPEG nhỏ xíu), và 274 AVIF phải hạ xuống q60.
- Giao đúng bậc (trung vị tỉ lệ byte biến thể so với ảnh gốc của chính nó): khung 360 px AVIF 0,09 và WebP 0,09; 640 px là 0,19 và 0,21; 960 px là 0,28 và 0,30; 1280 px là 0,36 và 0,41.
- Dung lượng thêm cho bucket: với mẫu này AVIF cộng WebP bằng khoảng 1,9 lần byte gốc (tính cả bậc `max`; ảnh WordPress cũ rộng 668 px chỉ có bậc `max` và vài bậc nhỏ).

## Biến thể ảnh tạo lúc tải lên (24/11/2026)

Ảnh tải lên từ admin (`cms/<id>/v<n>/…`) có biến thể ngay khi lưu, không tốn hạn mức `/cdn-cgi/image` và không tốn CPU Worker:

- **Trình duyệt dựng** (`makeVariants` trong `src/components/admin/media/imageTools.ts`): với ảnh JPEG/PNG/WebP, một bản WebP chất lượng 0,85 cho mỗi chiều rộng chuẩn nhỏ hơn chiều rộng ảnh (160, 360, 640, 960, 1280, 1920), thu nhỏ từng bước một nửa để không răng cưa, và `@max` ở đúng chiều rộng ảnh (tối đa 2560) khi nó nhỏ hơn tệp đã lưu (nếu không, trang giao chính tệp đó). GIF không có biến thể. Gửi kèm trong cùng yêu cầu multipart, các trường `v160` … `vmax`.
- **Máy chủ kiểm** (`src/admin/media/variants.ts`): chỉ giữ tệp thật sự là WebP (đọc từ byte), đúng kích thước mà bước đó nghĩa là (min(bước, chiều rộng ảnh), cùng tỷ lệ), tối đa 4 MB mỗi tệp; bản sai bị bỏ lặng lẽ, không làm hỏng việc tải lên. Ghi vào R2 ở `<khóa>@<bước>.webp`. Một bản ghi lỗi chỉ bị bỏ qua (trang rơi về bản lớn hơn hoặc tệp gốc).
- **Cùng vòng đời với ảnh**: thay ảnh, cắt lại, xóa bản cắt và xóa hẳn khỏi thùng rác đều xóa luôn biến thể của tệp cũ; nếu ghi D1 lỗi thì tệp và biến thể vừa ghi bị dọn. Bản cắt cũng được dựng biến thể.
- **Không có AVIF**: trình duyệt không tự mã hóa AVIF. Route `/anh-goc/` rơi từ AVIF sang WebP, nên ảnh admin giao WebP. Muốn có AVIF thì chạy `scripts/media-variants.mjs` với `--keys-file` cho các khóa `cms/` (dùng được cho ảnh cũ tải lên trước ngày này).
- `s2-cnv03/cms/` nay nằm trong `VARIANT_PREFIXES` (cả hai bản `media.ts`); không còn đường vòng `/cdn-cgi/image` cho ảnh admin. Ảnh `cms/` tải lên bằng bản admin cũ (trước khi deploy tính năng này) không có biến thể và rơi về tệp gốc; lúc tính năng ra, thư viện chưa có ảnh `cms/` nào.

**Đã deploy (26/11/2026):** tlhp-web `0effcefc`, V3 `fd0631c1`; tải thử ảnh 3000×2000 ra đủ 6 biến thể, `hit` trên www. `cloudflare.config.ts` chỉ còn domain `quantri.tunglamhoaphuc.com` (tránh kéo www khỏi `tlhp-v3`). Mọi lần deploy admin: `TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com npm run deploy:v2`.
