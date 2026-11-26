# Chép ảnh còn thiếu vào R2 và dựng biến thể (25/11/2026)

> Liên quan: [tach-du-lieu.md](tach-du-lieu.md), [nguon-b2.md](nguon-b2.md), [hieu-nang.md](hieu-nang.md). Ảnh đi qua route `/anh-goc/<bucket>/<khóa>` (`src/libs/content/mediaRoute.ts`, `media.ts`): R2 trước, rồi biến thể, rồi bản gốc, và chỉ khi R2 thiếu mới lùi về B2 hoặc WordPress cũ.

## 1. Vì sao phải chép

Kiểm kê 25/11/2026 (đọc mã, đọc D1, crawl 832 địa chỉ trong sitemap của www) cho thấy một số ảnh trang www đang dùng **không có trong R2** nên được phục vụ nhờ đường lùi về B2 (`media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com`). Nếu B2 bị dọn, các ảnh này sẽ hỏng. Việc chép đưa chúng vào R2 để dọn được B2 về sau.

Ảnh thiếu là ảnh mà mã nhắc tới nhưng R2 chưa có khóa. Bản gốc của chúng nằm trên B2:

| Nhóm | Khóa R2 (bucket `tlhp-media`) | Số ảnh | Dùng ở |
|---|---|---|---|
| Triển lãm "Văn Hóa Soi Đường" | `media-tunglamhoaphuc/tunglamhoaphuc2/11-van-hoa-viet-nam/…` | 36 | `/van-hoa-viet-nam` |
| Ảnh thờ của Sư Tổ | `media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/…` | 37 | `/gioi-thieu/tieu-su-su-to` |

Tổng 73 ảnh, 12,25 MB, tất cả là WebP.

## 2. Cách đã làm

1. **Lập danh sách.** Lấy mọi đường dẫn `/anh-goc/…` viết rõ trong `src/components/van-hoa-viet-nam/data.ts` và `TieuSuSuToOdysseyView.tsx` (giải các hằng `S3_BASE`, `S3_VH`, `S3_SU_TO_BASE`), đối chiếu với danh sách khóa R2 đã liệt kê. 102 ảnh được nhắc, 29 đã có, 73 thiếu. Cả 73 đều trả 200 khi hỏi B2.
2. **Tải về thư mục tạm và kiểm.** Mỗi ảnh phải đúng dung lượng so với tiêu đề `content-length` của B2 và đúng chữ ký tệp WebP. 73/73 đạt.
3. **Chỉ thêm, không ghi đè.** Trước khi ghi, liệt kê lại hai tiền tố trong R2 để chắc khóa chưa tồn tại.
4. **Ghi vào R2** bằng `cf` CLI:

```bash
cf r2 objects put <khóa> --bucket-name tlhp-media --file <tệp> --content-type image/webp --profile tlhp
```

   Khóa viết với dấu `/` thật, không phải `%2F`. Ghi thử một ảnh trước và liệt kê lại để chắc khóa được lưu đúng đường dẫn rồi mới ghi 72 ảnh còn lại. Lệnh `put` của CLI không có cờ "chỉ ghi nếu chưa có", nên bước kiểm khóa trước khi ghi là bắt buộc.
5. **Kiểm sau khi ghi.** Liệt kê lại từ R2: đủ 73 khóa, đúng dung lượng, không khóa nào thiếu. Gọi qua `www/anh-goc/…` đều trả 200 `image/webp`.

## 3. Biến thể thu nhỏ

Ban đầu 73 ảnh chỉ có bản gốc. Khi trang xin một cỡ nhỏ (ví dụ `@640`), route không tìm thấy biến thể nên trả bản gốc với cache 1 giờ (ảnh gốc cache 30 ngày), mỗi ảnh khoảng 170 KB cho mọi thiết bị.

Đã dựng biến thể bằng `scripts/media-variants.mjs` (có ở nhánh `feat/anh-chi-cloudflare`, chưa có trên `main`):

```bash
# chạy khô trước (không ghi gì), rồi chạy thật; keys.txt là 73 khóa, mỗi dòng một khóa
node scripts/media-variants.mjs --dry-run --backend cf --keys-file keys.txt --manifest out/dry.jsonl --concurrency 6
node scripts/media-variants.mjs --backend cf --keys-file keys.txt --manifest out/chay-that.jsonl --concurrency 6
```

Kết quả (chạy thật 399 giây, thoát mã 0, trùng với bản chạy khô):

| Mục | Số liệu |
|---|---|
| Ảnh xử lý | 73, không lỗi mã hóa, không ảnh nào bị cổng chất lượng từ chối |
| Biến thể ghi vào R2 | **717 tệp, 49,25 MB** (AVIF 361 tệp 24,18 MB; WebP 356 tệp 25,07 MB), gấp khoảng 4,2 lần dung lượng ảnh gốc (11,68 MB) |
| Bỏ vì không nhỏ hơn bản gốc ở cỡ đó | 9 tệp |
| Chất lượng (SSIM-Y so với bản gốc cùng cỡ) | trung vị 0,984, thấp nhất 0,960; p5 trung vị 0,952, thấp nhất 0,872 |
| Mức chất lượng được chọn | AVIF q60 (55 tệp), q70 (306); WebP q80 (199), q85 (157) |

Trung vị dung lượng theo cỡ (AVIF / WebP): `@160` 5,2 / 5,4 KB; `@360` 21,6 / 21,1 KB; `@640` 54,7 / 51,9 KB; `@960` 91,4 / 91,3 KB; `@1280` 122,7 / 137,1 KB; `@max` 131,3 / 141,6 KB. Ảnh gốc trung bình khoảng 170 KB, nên điện thoại nhận bản `@640` nhẹ hơn khoảng 3 lần.

Kiểm sau khi ghi:
- Liệt kê R2 theo hai tiền tố: 73/73 bản gốc còn nguyên đúng dung lượng và 717 biến thể của 73 ảnh, tổng 49,25 MB.
- Qua `www/anh-goc/…`: `@640` và `@max` trả `image/avif` với `Cache-Control: public, max-age=31536000, immutable` (trước đó chỉ cache 1 giờ). Một số cỡ không có biến thể ở định dạng đó (ví dụ `@1280` của một ảnh) sẽ rơi về định dạng khác với cache ngắn hơn; đó là hành vi thiết kế của route.

Quy tắc của script: chỉ ghi khóa có `@`, không ghi đè hay xóa bản gốc, bỏ qua biến thể đã có và còn mới, mỗi biến thể phải qua ngưỡng chất lượng (SSIM-Y ≥ 0,96 và p5 ≥ 0,85) và nhỏ hơn bản gốc thu về cùng cỡ.

## 4. Chưa làm và điều chưa kiểm chứng

- **Chưa chép được `s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2019/05/1..jpg`.** Tường lửa chặn khóa có `..`; không thử vượt. Ảnh này vẫn được phục vụ qua B2.
- **10 ảnh chết** (404 ở B2, WordPress và mọi nơi) không có nguồn để chép: `giang-duong-hoa-phuc-canh-1.webp`, `Chua-Mot-Cot-xua.webp`, 4 ảnh `duc_phat_duoc_su/*.webp`, `su-thanh-luong-8.jpg`, `tieu-su-hoa-thuong-ngo-chan-tu-1.jpg`, `-3.jpg` và một thumbnail `…bai-tho-mien-nam-chon-to_thumbnail_herobanner-….webp`.
- **Tên ảnh ghép động** (ví dụ flipbook `page_01..30`) chỉ được quét ở phần mã viết rõ tên. Chưa kiểm chứng các tên sinh bằng vòng lặp.
- **B2 chưa dọn được** khi còn hai loại trên. Nên theo dõi log Workers `media-fallback` 1–2 tuần rồi mới tính dọn B2 (và đừng quên các bài khác dùng ảnh theo tên mà bảng này chưa quét).
- **Hiệu quả thực tế** của biến thể (LCP, dữ liệu di động) chưa đo.

## 5. Hoàn tác

R2 không có hoàn tác. Các khóa vừa ghi là **khóa mới**, nên có thể xóa riêng từng khóa nếu cần (`cf r2 objects delete`), không ảnh hưởng ảnh khác. Bản gốc vẫn còn trên B2 để chép lại bằng đúng cách ở mục 2.

## 6. Việc cần để ý lần sau

- Ảnh mới thêm vào trang bằng địa chỉ B2 sẽ rơi về B2 cho đến khi chép vào R2. Chép trước, rồi mới thêm vào trang.
- Sau khi chép ảnh gốc, chạy `media-variants.mjs --keys-file <tệp> --dry-run` rồi chạy thật để có biến thể.
