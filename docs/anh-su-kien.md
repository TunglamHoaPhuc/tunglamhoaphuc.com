# Ảnh đại diện sự kiện của Lịch tu học

> 18/11/2026. Sinh từ `data/snapshot/schedule.json` (admin cũ). Ảnh nào dùng cho nhiều sự kiện, hoặc là áp phích chủ đề tháng, cần Ban Biên Tập chọn ảnh riêng.

## Cách làm

1. Ban Biên Tập chọn ảnh cho từng sự kiện ở cột **Cần ảnh riêng**, ngang 16:9, tối thiểu 1280×720 px, định dạng WebP hoặc JPG, không chèn chữ lên ảnh (thẻ cắt khung 16:9, chữ ở mép dễ bị cắt).
2. Gán ảnh cho sự kiện trong admin cũ (trường ảnh của sự kiện trong Lịch tu học). Chưa có đọc trực tiếp từ B2 (T19), nên sau khi sửa phải lấy lại dữ liệu (`npm run snapshot:fetch`) và nhập lại vào D1 (`docs/van-hanh/d1.md` mục 6) rồi deploy.
3. Kiểm lại trên `v2.`.

## Danh sách

| Ngày | Sự kiện | Loại | Ảnh hiện tại | Loại ảnh | Dùng chung với | Cần ảnh riêng |
|---|---|---|---|---|---|---|
| 04.10.2026 | PHÁP HỘI NIỆM PHẬT | Khóa Lễ Truyền Thống | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |
| 03.10.2026 | PHÁP HỘI NIỆM PHẬT | Khóa Lễ Truyền Thống | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |
| 23.10.2026 | HUYẾT BỒN TRAI | Cộng Tu | `01-trang-chu/calendar_webp/phap-hoi-huyet-bon-trai-1791672108495.webp` | ảnh riêng | 1 sự kiện khác | Không |
| 24.10.2026 | HUYẾT BỒN TRAI | Cộng Tu | `01-trang-chu/calendar_webp/phap-hoi-huyet-bon-trai-1791672108495.webp` | ảnh riêng | 1 sự kiện khác | Không |
| 25.10.2026 | QUY Y TAM BẢO | Đại Lễ Sự Kiện | `01-trang-chu/dai-le-quy-y-tam-bao-1791689554247.webp` | ảnh riêng | — | Không |
| 25.10.2026 | THẮP NẾN CẦU SIÊU | Cộng Tu | `01-trang-chu/thap-nen-tri-an-1791700201778.webp` | ảnh riêng | — | Không |
| 28.10.2026 | NGŨ BÁCH DANH | Cộng Tu | `01-trang-chu/calendar_webp/thang-10-hanh-nguyen-quan-am.webp` | áp phích chủ đề tháng | — | **Có** |
| 07.11.2026 | PHÁP HỘI NIỆM PHẬT | Cộng Tu | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |
| 08.11.2026 | PHÁP HỘI NIỆM PHẬT | Cộng Tu | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |
| 09.11.2026 | LƯƠNG HOÀNG SÁM | Cộng Tu | `01-trang-chu/calendar_webp/thang-11-an-duc-to-thay.webp` | áp phích chủ đề tháng | 3 sự kiện khác | **Có** |
| 18.11.2026 | LƯƠNG HOÀNG SÁM | Cộng Tu | `01-trang-chu/calendar_webp/thang-11-an-duc-to-thay.webp` | áp phích chủ đề tháng | 3 sự kiện khác | **Có** |
| 19.11.2026 | LỄ TIÊN THƯỜNG | Đại Lễ Sự Kiện | `01-trang-chu/calendar_webp/thang-11-an-duc-to-thay.webp` | áp phích chủ đề tháng | 3 sự kiện khác | **Có** |
| 20.11.2026 | LÃO TỔ SƯ NGỘ CHÂN TỬ | Đại Lễ Sự Kiện | `01-trang-chu/calendar_webp/thang-11-an-duc-to-thay.webp` | áp phích chủ đề tháng | 3 sự kiện khác | **Có** |
| 05.12.2026 | PHÁP HỘI NIỆM PHẬT | Cộng Tu | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |
| 06.12.2026 | PHÁP HỘI NIỆM PHẬT | Cộng Tu | `01-trang-chu/Phap-hoi-niem-Phat.webp` | ảnh chung Pháp hội niệm Phật | 5 sự kiện khác | Không |

**5/15 sự kiện cần ảnh riêng** (áp phích chủ đề tháng, hoặc ảnh dùng chung với sự kiện khác tên). Các ngày của cùng một sự kiện lặp lại (Pháp hội niệm Phật, Huyết Bồn Trai) dùng chung một ảnh là hợp lý, nên không tính.
