# Kiểm chứng ảnh sau khi chuyển ảnh về /anh-goc (23/11/2026)

Quét chỉ đọc (GET/HEAD bằng curl, tối đa 6 luồng song song, có nghỉ ngắn) trên https://www.tunglamhoaphuc.com, bản V3 vừa triển khai (Worker version 33fe655d). Bắt đầu lúc khoảng 11:09 UTC ngày 23/11/2026. Không đăng nhập, không gửi biểu mẫu, không ghi vào Cloudflare, repo hay site.

## 1. Kết luận ngắn

| Chỉ tiêu | Mục tiêu | Kết quả đo |
|---|---|---|
| Trang đã quét | 829 URL sitemap + 6 trang thêm | **832 URL đã tải** (831 trả 200 HTML, 1 trả 404: `/tibetan-study/`). 829 URL sitemap đều 200. |
| URL ảnh khác nhau tìm thấy | - | **26.524** (26.440 của chính site, 84 của host ngoài) |
| Trang gọi ảnh từ host ngoài | 0 | **21 trang** (84 URL, 18 tên host); trong đó **20 trang hiển thị thật** (thẻ img), 1 trang chỉ nằm trong dữ liệu RSC. Toàn bộ là ảnh nhúng trong thân bài, trỏ tới báo/Facebook, **đã chết** (xem mục 3). |
| Ảnh gọi thẳng Backblaze B2 | 0 | **1 URL, 1 trang** (`/gioi-thieu/su-phu-tru-tri`, trường `sourceBook.coverImage`), chỉ có trong dữ liệu RSC, không có trong thẻ img (HTML hiển thị). Trước chuyển: 23 ảnh B2 trực tiếp mỗi trang trên một số trang. |
| Ảnh trỏ `admin.` hay `old.tunglamhoaphuc.com` | 0 | **0 ảnh.** (Có 33 trang chứa liên kết `<a>` tới tệp âm thanh mp3/m4a ở `admin.tunglamhoaphuc.com/wp-content/uploads/...`, không phải ảnh.) |
| Điều hướng 3xx của URL ảnh sang host ngoài | 0 | **0.** Không có một phản hồi 3xx nào trong 26.440 URL ảnh của site (đã đo, không theo chuyển hướng). |
| URL ảnh của site trả 200 | - | **25.548 / 26.440** (96,6%) |
| URL ảnh của site không phải 200 | - | **892**: 620 lỗi 400 (`/_next/image`), 272 lỗi 404 |

Phát hiện cần xử lý trước hết: **mọi URL `/_next/image?url=/anh-goc/...&w=640&q=75` đều trả 400 "The requested resource isn't a valid image."**. Đây là ảnh chính (ảnh nền đầu trang kèm thẻ preload `fetchPriority="high"`) của bài viết, nên ảnh đầu trang vỡ trên **689 trang** (xem mục 4.1).

## 2. Phương pháp và giới hạn đo

- Tải 832 trang HTML (tải một lần, không chạy JavaScript). Trích mọi tham chiếu ảnh: `img src/srcset/data-src`, `source srcset`, `video poster`, `link rel=preload as=image` (href và imagesrcset), `link rel=icon`, `style="...url()"` và thẻ `<style>`, `og:image`/`twitter:image`, trường `image` trong JSON-LD, và mọi URL có đuôi ảnh hoặc tiền tố `/anh-goc/`, `/images/`, `/brand/`, `/cdn-cgi/image/`, `/_next/image` trong phần HTML còn lại và trong tải trọng RSC (ghép lại các đoạn `rsc.push("...")` rồi giải mã trước khi quét, vì một URL có thể bị cắt ngang giữa hai đoạn).
- CSS: 3 tệp CSS được các trang nạp (2 của site, 1 Google Fonts). Không có `url()` ảnh nào trong CSS, chỉ có phông chữ (6 tệp ttf của site, 23 của fonts.gstatic.com). Phông Google Fonts nạp trên cả 831 trang (không phải ảnh, ghi để biết).
- Trạng thái: GET từng URL ảnh của site với `--max-filesize 1` (curl ngắt sau byte đầu tiên, nên chỉ đọc mã trạng thái và tiêu đề, **không kiểm tra thân ảnh có hợp lệ hay không**). Không theo chuyển hướng. Tốc độ khoảng 10 yêu cầu mỗi giây.
- Bản chất "chỉ trong RSC": một URL chỉ có trong tải trọng RSC chưa chắc trình duyệt tải (tùy thành phần có hiển thị hay không). Bảng dưới tách riêng "hiển thị thật" (có trong thẻ HTML) và "chỉ RSC/văn bản".
- Không đo: ảnh do JavaScript tạo sau khi tải trang (lightbox, flipbook, carousel nạp muộn), ảnh trong tệp JS, trang cần đăng nhập, và trang không có trong sitemap ngoài 6 trang đã thêm. `/tibetan-study/` trả 404 (không tồn tại); mục khóa tiếng Tạng của site là `/tri-tue-phat-phap/hoc-tieng-tang` (có trong sitemap, 200).
- Tác dụng phụ cần biết: quét đã gọi **4.176 URL `/cdn-cgi/image/...` khác nhau** (4.174 lần `cf-cache-status: MISS`). Nếu các biến đổi này chưa được tính trong tháng, chúng có thể đã dùng tới 4.176 trong hạn mức 5.000 biến đổi khác nhau mỗi tháng của zone Free (xem `toi-uu-anh-23-11-2026.md`). Chưa đo mức đã dùng trong Dashboard, nên chưa rõ có bị tính thêm hay không.

## 3. Host của URL ảnh

### 3.1 Phân loại theo host

| Host | URL khác nhau | Ghi chú |
|---|---:|---|
| www.tunglamhoaphuc.com (chính site) | 26.440 | 21.357 `/anh-goc`, 4.176 `/cdn-cgi/image`, 620 `/_next/image`, 217 `/pdf`, 64 `/images`, 6 `/brand` |
| backblazeb2.com | 1 | chỉ RSC, 1 trang |
| admin. / old.tunglamhoaphuc.com | 0 | không có ảnh |
| Host khác (báo, Facebook) | 83 | bảng 3.2 |

### 3.2 Host ngoài: số trang và 3 trang ví dụ đầu tiên

| Host | URL | Số trang | Số trang hiển thị thật | Trạng thái đo | 3 trang ví dụ |
|---|---:|---:|---:|---|---|
| *.fbcdn.net (Facebook) | 17 | 10 | 10 | 15 URL trả 403 (liên kết ký hết hạn), 2 URL không kết nối được (exit 6, host không phân giải) | `/dong-chay-hoang-phap/bai-tho-cam-ta-cua-dai-duc-tru-tri-chua-hoa-phuc-nhan-mua-phat-dan`, `/dong-chay-hoang-phap/cac-hoat-dong-mung-xuan-di-lac-2019-tai-chua-hoa-phuc`, `/dong-chay-hoang-phap/chuong-trinh-hanh-huong-chiem-bai-phat-tich-an-do-nepal` |
| media.ex-cdn.com | 21 | 6 | 6 | không phân giải được tên miền (curl exit 6), 21/21 | `/dong-chay-hoang-phap/3224-2`, `/dong-chay-hoang-phap/kinh-akkosa-va-bai-hoc-duc-phat-day-ve-su-nhuc-ma`, `/dong-chay-hoang-phap/loi-khuyen-cua-duc-phat-duoc-dua-vao-de-thi-van-chuyen-lop-10-dai-hoc-su-pham-tp-hcm` |
| s2-cnv03.s3.us-east-005.backblazeb2.com | 1 | 1 | 0 | 200 (ảnh bìa sách còn sống) | `/gioi-thieu/su-phu-tru-tri` |
| img2.infonet.vn | 15 | 1 | 1 | hết thời gian chờ 25 giây (curl exit 28), 15/15 | `/dong-chay-hoang-phap/bao-dien-tu-infonet-dua-tin-ve-dem-hoi-hoa-dang-cau-truong-tho-tai-chua-hoa-phuc` |
| image.tienphong.vn | 6 | 1 | 1 | không phân giải được tên miền, 6/6 | `/dong-chay-hoang-phap/3634-2` |
| image2.tienphong.vn | 9 | 1 | 1 | không phân giải được tên miền, 9/9 | `/dong-chay-hoang-phap/3634-2` |
| giacngo.vn | 4 | 1 | 1 | 302 chuyển hướng (chưa theo, chưa biết đích còn ảnh hay không), 4/4 | `/dong-chay-hoang-phap/cu-ba-104-tuoi-o-binh-dinh-van-tinh-tan-tu-hoc-gno` |
| image.giaoducthoidai.vn | 11 | 1 | 1 | không phân giải được tên miền, 11/11 | `/dong-chay-hoang-phap/bao-giao-duc-va-thoi-dai-dua-tin-ve-dem-hoi-hoa-dang-dai-le-vu-lan-bao-hieu-tai-chua-hoa-phuc` |

Tổng cộng 21 trang có ít nhất một ảnh ngoài. Các trang đều là bài viết ở `/dong-chay-hoang-phap/...` (ảnh trích từ báo hoặc Facebook dán vào thân bài), riêng `/gioi-thieu/su-phu-tru-tri` là ảnh B2 trong dữ liệu RSC. Lưu ý: đây là các ảnh chết đã biết của bài cũ; chúng không phải do đợt chuyển ảnh sinh ra. Nhóm Facebook hết hạn và báo mất tên miền thì không thể khôi phục từ phía site.

## 4. Trạng thái của 26.440 URL ảnh của site

### 4.1 Phân bố mã trạng thái theo loại đường dẫn

| Loại URL | 200 | 400 | 404 | Tổng |
|---|---:|---:|---:|---:|
| `/anh-goc/...` | 21.347 | 0 | 10 | 21.357 |
| `/cdn-cgi/image/width=...,onerror=redirect/anh-goc/...` | 4.176 | 0 | 0 | 4.176 |
| `/_next/image?url=%2Fanh-goc%2F...&w=640&q=75` | 0 | 620 | 0 | 620 |
| `/pdf/di-qua-kho-vui-q1/page-N.jpg` | 0 | 0 | 217 | 217 |
| `/images/...` | 19 | 0 | 45 | 64 |
| `/brand/...` | 6 | 0 | 0 | 6 |
| **Tổng** | **25.548** | **620** | **272** | **26.440** |

(Hai URL `/anh-goc` có tên tệp tiếng Việt mã hóa nên lần đầu không ghép được kết quả vào danh sách; đã kiểm lại riêng bằng GET, cả hai trả 200. Con số trong bảng đã tính cả hai.)

### 4.2 Danh sách lỗi theo nguyên nhân

#### Nhóm A. `/_next/image` trả 400: 620 URL, 689 trang (có trong thẻ HTML hiển thị)

- Mẫu URL: `/_next/image?url=%2Fanh-goc%2Fs2-cnv03%2Ftunglamhoaphuc2%2F03-dong-chay-hoang-phap%2F...jpg&w=640&q=75`. Cả 620 URL đều có `w=640&q=75`; phản hồi `400 text/plain` với thân "The requested resource isn't a valid image." (không có Cache-Control).
- Phân bố trang: `dong-chay-hoang-phap` 472, `tri-tue-phat-phap` 158, `tong-chi-tu-hoc` 26, `lich-tu-hoc` 18, `vu-tru-phat-giao` 14, `gioi-thieu` 1. Mỗi trang dùng URL này cho ảnh đầu bài (thẻ `<img ... loading="eager" fetchPriority="high" sizes="100vw">` và thẻ `<link rel="preload" as="image">` cùng URL), không có `srcset` hay ảnh dự phòng.
- Đã thử trực tiếp một URL với các độ rộng 384, 640, 750, 828, 1080, 1200: đều 400. Cùng đối tượng `/_next/image?url=%2Fimages%2Ficons%2Ficon-dong-chay-hoang-phap.webp&w=640&q=75` (ảnh tĩnh `/images`) trả 200. Cùng tệp nguồn `/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2026/01/1-2-668x376.jpg` tải trực tiếp trả 200, `image/jpeg`, byte đầu `ff d8 ff` (JPEG hợp lệ).
- Suy luận chưa kiểm chứng trong mã: bộ tối ưu `/_next/image` chỉ tối ưu được ảnh trong tài nguyên tĩnh (`/images`, `/brand`), còn khi nguồn là route động `/anh-goc` thì không lấy được và trả "không phải ảnh hợp lệ". Nguyên nhân cụ thể cần xem mã xử lý `/_next/image` của vinext. **Đây là ứng viên số một cho lỗi MỚI do đợt chuyển ảnh/đổi mã**, vì ảnh nguồn đã nằm ở `/anh-goc`; tôi không có số đo trước đợt chuyển để chứng minh.

#### Nhóm B. `/pdf/di-qua-kho-vui-q1/page-N.jpg` trả 404: 217 URL, 1 trang

- Chỉ xuất hiện trong dữ liệu RSC của `/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi` (danh sách trang sách/flipbook, `page-1.jpg` đến `page-217.jpg`), không có thẻ img trong HTML, nên chỉ ảnh hưởng nếu bộ đọc sách nạp các trang này bằng JavaScript (chưa đo bằng trình duyệt).
- Nguyên nhân thấy được: không có tệp hay route `/pdf/...` (phản hồi là trang 404 HTML của site, không phải ảnh). Không có trong số "54 lỗi /images" của lần kiểm trước.

#### Nhóm C. `/images/...` trả 404: 43 URL thật (và 2 URL do máy quét cắt ngang chỗ có dấu cách, không tính)

Bảng đủ 43 URL, tổng số trang tham chiếu ghi bên phải. Số lỗi cùng loại của lần kiểm trước: 54.

| URL | Số trang | Nguyên nhân thấy được |
|---|---:|---|
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/bat_dong_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/bo_trich_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/dai_luan_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/dai_tieu_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/dai_uy_duc_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/giang_tam_the_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/ma_dau_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/vo_nang_thang_kim_cuong.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/bo_dai_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/cu_bat_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/hang_long_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/khai_tam_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/khanh_hy_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/khoai_nhi_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/ky_tuong_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/phuc_ho_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/qua_giang_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/thac_thap_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/tham_thu_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/tieu_su_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/tinh_toa_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/toa_loc_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/tram_tu_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/truong_mi_la_han_go.jpg` | 2 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/icon-minh-hoa/GIEO THẺ QUAN ÂM LOGO.svg` | 1 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/lotus-pattern.png` | 1 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/tibetan-pattern.png` | 1 | tệp không có trong tài nguyên tĩnh (404) |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/băng đĩa hoằng pháp.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/các chú thích phật giáo.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/dụng cụ của sư tổ.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/hiện vật cổ - bát.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/hiện vật cổ - gạch.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/hiện vật cổ - lư hương 2.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/hiện vật cổ - ngói.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/không gian trưng bày theo chủ đề.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/kinh bằng tiếng cổ.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/nghệ thuật trà của các nước.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/pháp khí thiền gia.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/tranh thư pháp nghệ thuật 2.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/tranh thư pháp nghệ thuật.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/triển lãm sư tổ ngộ chân tử.JPG` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/tư tưởng chủ đạo triều đại nhà Lý.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |
| `/images/vu-tru-phat-giao/bao-tang/không gian bảo tàng/tượng pháp nghệ thuật.jpg` | 1 | tệp có dấu cách và tiếng Việt, thử cả NFC và NFD vẫn 404: không có tệp |

Các thư mục bị ảnh hưởng: `bao_tuong_phat_giao/ho_phap_than_vuong/...` và `.../thap_bat_la_han/...` (bảo tượng), `vu-tru-phat-giao/bao-tang/không gian bảo tàng/...` (bảo tàng), `icon-minh-hoa/GIEO THẺ QUAN ÂM LOGO.svg`, `lotus-pattern.png` (nền hoa văn ở trang chủ), `tibetan-pattern.png`.

#### Nhóm D. `/anh-goc/...` trả 404: 10 URL, 89 trang tham chiếu (44 trang hiển thị thật)

Cả 10 khóa đều **không có trong R2 và cũng không có ở B2 gốc** (GET thẳng B2 trả 404; thử bucket kia `media-tunglamhoaphuc` hay `s2-cnv03` qua site đều 404). Nên đây là khóa thiếu trong dữ liệu, không phải sai tiền tố bucket hay mã hóa.

| URL | Số trang | Trang ví dụ |
|---|---:|---|
| `/anh-goc/s2-cnv03/tunglamhoaphuc2/04-vu-tru-phat-giao/bao-tang/trien-lam/Phat-giao/CHUA-VIET-NAM-XUA/Chua-Mot-Cot-xua.webp` | 85 | `/`, `/bao-tuong-phat-giao` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_thien_danh_xung_cat_tuong_vuong_nhu_lai.webp` | 2 | `/bao-tuong/duc_phat_duoc_su_dang_y_vuong_cuu_kho_bach_tinh_tp0018`, `/bao-tuong/duc_phat_duoc_su_thay_thuoc_tp0019` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_vo_uu_toi_thang_cat_tuong_vuong_nhu_lai.webp` | 2 | `/bao-tuong/duc_phat_duoc_su_dang_y_vuong_cuu_kho_bach_tinh_tp0018`, `/bao-tuong/duc_phat_duoc_su_thay_thuoc_tp0019` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_bao_nguyet_tri_nghiem_quang_am_tu_tai_vuong_nhu_lai.webp` | 2 | `/bao-tuong/duc_phat_duoc_su_dang_y_vuong_cuu_kho_bach_tinh_tp0018`, `/bao-tuong/duc_phat_duoc_su_thay_thuoc_tp0019` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_kim_sac_bao_quang_dieu_hanh_thanh_tuu_nhu_lai.webp` | 2 | `/bao-tuong/duc_phat_duoc_su_dang_y_vuong_cuu_kho_bach_tinh_tp0018`, `/bao-tuong/duc_phat_duoc_su_thay_thuoc_tp0019` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/tong-chi-tu-hoc-_-tong-phong-truyen-thua_-bai-tho-mien-nam-chon-to_thumbnail_herobanner-1787470412489.webp` | 1 | `/vu-tru-phat-giao/tang-kinh-cac` |
| `/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2025/04/tieu-su-hoa-thuong-ngo-chan-tu-1.jpg` | 1 | `/gioi-thieu/tieu-su-su-to` |
| `/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2025/04/su-thanh-luong-8.jpg` | 1 | `/gioi-thieu/su-ong-hoang-phap` |
| `/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2025/04/tieu-su-hoa-thuong-ngo-chan-tu-3.jpg` | 1 | `/gioi-thieu/tieu-su-su-to` |
| `/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/giang-duong/giang-duong-hoa-phuc-canh-1.webp` | 1 | `/tong-chi-tu-hoc/bo-de-tam-coi-nguon-thien-phap` |

Ghi chú: `Chua-Mot-Cot-xua.webp` nằm trong thanh điều hướng/thẻ bảo tàng của 85 trang (có trong thẻ img, preload, nền inline và `og:image` ở một trang), nên đáng sửa trước nhất trong nhóm này. Bốn khóa ở `media-tunglamhoaphuc/.../duc_phat_duoc_su/` hiện trên 2 trang bảo tượng.

### 4.3 Chuyển hướng

Không có phản hồi 3xx nào trong 26.440 URL (đã đo, không theo chuyển hướng). Do đó không có `/anh-goc` nào chuyển sang host ngoài. Số chuyển hướng ra host ngoài: **0**.

### 4.4 Nội dung khác phát hiện

- 25.548 phản hồi 200: **0** trường hợp có `Content-Type` không phải `image/*`.
- 4 tệp đuôi `.webp` được trả với `Content-Type: image/jpeg` (`calendar_webp/thang-10-hanh-nguyen-quan-am.webp`, `calendar_webp/thang-11-an-duc-to-thay.webp`, `bao-thap/mandala-tang-1-quan-am-bo-tat.webp`, `08-tu-an-book/di-qua-kho-vui-cuoc-doi-bia-1.webp`). Trình duyệt vẫn hiển thị nhờ dò nội dung, chỉ ghi nhận sai kiểu.
- 59 URL `/anh-goc` hoặc `/cdn-cgi/image` có tên tệp tiếng Việt có dấu trả 200 nhưng với `Cache-Control: private, no-cache, no-store` (39 của `/anh-goc`, 20 của `/cdn-cgi/image` kèm `private, max-age=14400`), tức là không được lưu bộ đệm. 39 URL `/anh-goc` chỉ nằm trong RSC/văn bản; 20 URL `/cdn-cgi/image` có trong thẻ img hiển thị thật (ảnh tiếng Việt cũ trong thân bài). Ngược lại 21.307 `/anh-goc` còn lại có `public, max-age=2592000`.
- Không có URL `/anh-goc/...@<rộng>` nào trong các trang: tất cả `/anh-goc` là bản gốc (20.989 jpg, 225 webp, 62 jfif, 53 jpeg, 13 png, 4 gif). Nghĩa là các biến thể dựng sẵn mô tả trong `toi-uu-anh-23-11-2026.md` chưa được các trang dùng (hoặc phần mã V3 chưa bật cờ).

## 5. Tiêu đề phản hồi (Cache-Control và Content-Type)

Đã ghi nhận tiêu đề cho toàn bộ 26.440 URL (không chỉ 30 mẫu). Tổng hợp của các URL trả 200:

| Loại | Số URL 200 | Cache-Control phổ biến | Content-Type | cf-cache-status |
|---|---:|---|---|---|
| `/anh-goc` | 21.346 (+1) | `public, max-age=2592000, stale-while-revalidate=604800` (21.307); `private, no-cache, no-store, max-age=0` (39) | image/jpeg 21.108, image/webp 221, image/png 13, image/gif 4 | BYPASS (mọi lần gọi vào Worker và R2) |
| `/cdn-cgi/image` | 4.175 (+1) | `public, max-age=2592000, stale-while-revalidate=604800` (4.155); `private, max-age=14400, must-revalidate` (20) | image/jpeg 4.166, image/png 6, image/gif 3 | MISS 4.174, HIT 1 |
| `/images` | 19 | `public, max-age=31536000, immutable` | webp 10, png 8, jpeg 1 | HIT 18, MISS 1 |
| `/brand` | 6 | `public, max-age=86400, stale-while-revalidate=604800` | png 3, webp 2, jpeg 1 | HIT 4, MISS 2 |

Mẫu 30 URL ngẫu nhiên (hạt giống 23112026, lấy trong các URL trả 200) đều có `Cache-Control: public, max-age=2592000, stale-while-revalidate=604800` (24 `/anh-goc`: 23 `image/jpeg` và 1 `image/webp`; 6 `/cdn-cgi/image`: `image/jpeg`), không mẫu nào thiếu Cache-Control hay sai kiểu nội dung. Lưu ý `/anh-goc` luôn `BYPASS` bộ đệm của Cloudflare (đúng với mô tả trong tài liệu tối ưu ảnh), nên mỗi lượt xem đều gọi Worker và đọc R2.

## 6. So với lần kiểm trước

| Chỉ số | Trước đợt chuyển | Sau (đo hôm nay) |
|---|---|---|
| Ảnh gọi thẳng B2 | 23 ảnh mỗi trang trên một số trang | **0 trong HTML hiển thị**, 1 URL trong RSC của 1 trang |
| `/images` trả 404 | 54 | **43** (còn 45 nếu tính cả 2 URL do máy quét cắt ngang) |
| Redirect `/anh-goc` ra host ngoài | chưa đo | 0 |
| Ảnh ngoài khác | chưa đo | 83 URL báo/Facebook, đã chết |

## 7. Đọc kết quả: còn gì phải sửa

Tách thành lỗi MỚI do đợt chuyển/đổi mã (nghi ngờ) và lỗi đã biết, không do đợt chuyển.

| Ưu tiên | Nhóm | Số URL | Số trang | Loại | Việc cần làm |
|---|---|---:|---:|---|---|
| 1 | `/_next/image` trả 400 cho nguồn `/anh-goc` | 620 | 689 | **Lỗi mới nghi do đợt chuyển** (chưa có số đo trước để chứng minh) | Xem mã `/_next/image` của vinext: hoặc cho nó đọc nguồn `/anh-goc` (route động), hoặc đổi các thẻ `Image` ảnh đầu bài sang `imageAt()`/URL `/anh-goc` hay `/cdn-cgi/image` trực tiếp. Đây là ảnh chính đầu bài và là ảnh LCP, nên cần sửa trước. |
| 2 | `/anh-goc` 404 `Chua-Mot-Cot-xua.webp` | 1 | 85 | Khóa thiếu ở R2 và B2 (không phải do chuyển) | Đưa ảnh vào R2 hoặc đổi tham chiếu trong dữ liệu thẻ Bảo tàng. |
| 3 | `/anh-goc` 404 khác | 9 | vài trang riêng lẻ (xem 4.2 nhóm D) | Khóa thiếu ở R2 và B2 | Bổ sung tệp hoặc sửa dữ liệu bài (các ảnh `tieu-su-hoa-thuong-ngo-chan-tu-1/-3.jpg`, `su-thanh-luong-8.jpg`, 4 ảnh Dược Sư, `giang-duong-hoa-phuc-canh-1.webp`, ảnh herobanner tổng chi tự học). |
| 4 | `/images` 404 | 43 | 7 trang | Đã biết (54 trước đó), chưa xử lý xong | Thêm tệp thiếu vào `public/images` hoặc chuyển các đường dẫn bảo tượng/bảo tàng sang `/anh-goc`. |
| 5 | `/pdf/di-qua-kho-vui-q1/page-N.jpg` 404 | 217 | 1 | Chưa rõ có mới hay không (không thuộc 54 lỗi /images) | Kiểm tra bộ đọc sách trên `/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi` có thật sự nạp các trang này; nếu có, thiếu cả 217 trang. |
| 6 | Ảnh ngoài chết (báo, Facebook) | 83 | 20 | Đã biết, không phục hồi được | Cân nhắc gỡ khỏi thân bài hoặc thay bằng ảnh lưu trong R2 nếu tìm được bản gốc. |
| 7 | B2 trực tiếp trong RSC | 1 | 1 | Còn sót sau chuyển | Đổi `sourceBook.coverImage` của `/gioi-thieu/su-phu-tru-tri` sang `/anh-goc/s2-cnv03/tunglamhoaphuc2/08-tu-an-book/...` (bản đó trả 200). |
| 8 | Tiêu đề và bộ đệm | - | - | Nhỏ | 59 ảnh tên tiếng Việt (39 `/anh-goc`, 20 `/cdn-cgi/image`) không có bộ đệm công khai; 4 webp trả `image/jpeg`; biến thể `@w` chưa được dùng. |

Tổng hợp: nếu bỏ nhóm "ảnh ngoài chết" (83 URL) và "lỗi 404 thiếu khóa" (mọi nhóm đã biết), **lỗi mới đáng lo duy nhất là nhóm 1 (`/_next/image` 400)**. Cần lưu ý về giới hạn: tôi không có số liệu của đợt kiểm trước theo từng URL, nên phân loại "mới" và "đã biết" của nhóm 1 và nhóm 5 là suy luận từ cấu trúc (nguồn là `/anh-goc`, đường dẫn `/pdf` không thuộc `/images`), chưa phải số đối chiếu.

Số "~158 ảnh chết bên thứ ba hoặc 404 đã biết" của lần trước không tái dựng được từ bản quét này (quét này đếm 83 ảnh ngoài + 10 + 43 + 217 theo URL khác nhau); không đối chiếu từng mục.

