# Tùng Lâm Hòa Phúc — V3 (v3.tunglamhoaphuc.com)

Giao diện V3 của trang chùa, chạy trên Cloudflare Workers (Worker `tlhp-v3`), **chỉ đọc** dữ liệu của web www:

- Bài viết, Tông chỉ tu học, Giới thiệu, Lịch tu học, Vũ trụ Phật giáo: đọc thẳng D1 `tlhp-db` của www qua `src/lib/tlhp-content` (chép từ repo www, nhánh `main`) và `src/lib/v3-data.ts` (đổi về dạng bản ghi giao diện V3 vẫn dùng).
- Ảnh do admin tải lên: dùng chung kho R2 của www, gọi qua `https://www.tunglamhoaphuc.com/anh-goc/...`.
- Sửa nội dung ở trang quản trị của www (`/quan-tri`); v3 cập nhật trong khoảng một phút. V3 không có admin, không ghi vào D1.
- Còn đọc từ bản đóng gói trong `src/data` (www chưa có dữ liệu tương ứng): bảo tượng chi tiết, danh tăng, sách tham khảo, tra cứu bài vị.

## Lệnh

```powershell
npm install
npm run dev        # http://localhost:3011, đọc data/snapshot (không có trong git; chép từ repo www)
npm run build
npm run preview    # chạy bản build trong workerd cục bộ
npm run deploy     # build và deploy Worker tlhp-v3 (đọc D1); cần hồ sơ cf "tlhp": npx cf auth activate tlhp <thư mục>
```

Lịch sử git cũ của V3 không được đưa sang vì chứa mật khẩu CSDL và khóa B2; các khóa đó cần được đổi.
