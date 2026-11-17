# HỒ SƠ NHẬN DIỆN THƯƠNG HIỆU & DESIGN TOKENS – TÙNG LÂM HÒA PHÚC

> Phiên bản 1.1.0 · 17/11/2026 (bản 1.0.0: 02/11/2026; thay đổi ở mục 0) · Áp dụng cho website tái cấu trúc (Next.js trên Cloudflare)
> Khung bố cục tham chiếu: [Bexon React Home-02](https://bexon-react.vercel.app/home-02) (đo trực tiếp CSS đã render ở 1440px)
> Nguồn yêu cầu: [Bảng khảo sát Khao_Sat_Yeu_Cau](https://docs.google.com/spreadsheets/d/1rV0opZnf00H4B0ROK-BeBxWYAV5isukZcHWaBZDUK7w/edit) (các câu Q1, Q2, Q4, Q5, Q6, Q10–Q15)
> Màu logo: lấy mẫu điểm ảnh từ file `logo-moc-an.webp` và `logo-tung-lam-hoa-phuc-tron.webp` đang dùng trên site.

**Bộ file trong thư mục `design-system/`**

| File | Dùng để |
|---|---|
| [tokens.css](tokens.css) | Biến CSS toàn cục `--tlhp-*` (HEX + kênh RGB + kênh HSL), 3 chủ đề, nền tảng body, khung đọc kinh, cầu nối shadcn/ui |
| [tailwind.config.js](tailwind.config.js) | `theme.extend` đầy đủ: colors, fontFamily, fontSize, borderRadius, boxShadow, spacing, motion, z-index. Đã biên dịch thử với Tailwind 3.4.17 và 4.1.11 |
| [brand-tokens.json](brand-tokens.json) | Toàn bộ token dạng JSON để import vào React/Next.js, email HTML, ảnh OG (Satori), kèm bảng kiểm tra tương phản |
| BRAND-GUIDELINES.md | Tài liệu này |

---

## 0. Cập nhật 17/11/2026 (bản 1.1.0): nền tối kiểu web cũ là mặc định

Chủ dự án duyệt ngày 17/11/2026 sau khi xem trên `v2.`: cả site dùng nền tối, vàng kim như web cũ (`www`). Mục này **thay** những chỗ trái với nó ở các mục dưới; phần còn lại của tài liệu giữ nguyên hiệu lực.

| Hạng mục | Bản 1.0.0 | Từ 17/11/2026 |
|---|---|---|
| Chủ đề mặc định | Ngà (`:root`) | Tối: `<html data-theme="dark">`. Ngà và Giấy dó chỉ còn là lựa chọn trong chế độ đọc bài |
| Nền | Ngà `#FAFAF5`, kem `#F4ECDD` | Đen mun `#1A120B`; nền xen kẽ và thẻ là gỗ lim `#2C1C11` |
| Chữ | Đá `#35302B`, tiêu đề gỗ lim | Thân bài `#E3D2C1`; chữ phụ `#C9B896`; ngày tháng `#A69383` |
| Tiêu đề lớn | Noto Serif, không phát sáng | UTM Niagara in hoa, vàng kim `#F2C14E`, quầng sáng 24px (bỏ điều cấm "glow vàng" ở mục 1.2) |
| Dòng dẫn trên tiêu đề | Chip có khung | In hoa, giãn 0.22em, màu amber `#E5A93C`, không khung; phía trên có icon vàng |
| Nút chính | Nền mộc, chữ ngà | Dải vàng `#F2C14E → #E5A93C`, chữ nâu đen; nút phụ là viên thuốc nâu `#4A3728 → #3D2B1F` viền vàng |
| Thẻ | Phẳng, viền 1px, bo 12px | Dải `#2C1C11 → #1E140C`, viền vàng 22% (hover 55%), bo 14px, huy hiệu tròn giữa ảnh và chữ |
| Header, footer | Kính mờ sáng; footer đen mun | Header `rgba(26,15,8,.95 → .84)` mờ nền 14px, menu in hoa 14px; footer dải `#3D2B1F → #2A1D14` |
| Tỷ lệ màu trên trang | 60% ngà/kem · 25% chữ nâu-đá | 60% nâu đen · 25% chữ ngà ấm · 10% vàng kim · ≤ 5% chu sa (trên nền tối dùng `#D97A66`) |

Giữ nguyên từ bản 1.0.0: ba màu neo và bảng màu gốc (mục 3.1, 3.2), Noto Serif cho tiêu đề phụ và kinh văn, Be Vietnam Pro cho nội dung, không chữ dưới 14px và đoạn văn ≥ 16px (web cũ dùng 10–13px, không lấy theo), tương phản AA, vùng chạm ≥ 44px, mọi quy tắc về chuyển động.

Nơi khai báo: giá trị chủ đề tối trong [tokens.css](tokens.css) (`[data-theme="dark"]`), phần lấy theo web cũ trong `src/app/assets/sass/utilities/_tlhp-night.scss`, sửa bố cục trong `_tlhp-layout.scss`. Bảng đối chiếu từng tiểu tiết với web cũ: `tasks/dong-bo-giao-dien.md` mục 2. Cột "Đêm thiền" ở mục 3.3 là giá trị gốc của token; `_tlhp-night.scss` ghi đè chữ, tiêu đề, bề mặt và chữ phụ bằng các giá trị trong bảng trên.

---

## 1. Định vị thị giác & tinh thần Phật giáo

### 1.1. Tinh thần cốt lõi

**"Nơi để trở về – Chốn thiêng bình yên."** Website là một khoảng sân chùa trên mạng: Phật tử bước vào, thấy yên, đọc được dễ dàng, tìm được điều cần tìm, rồi ra về nhẹ nhàng. Không có gì chen ngang, không có gì giục giã.

Hệ thống giao thoa hai nguồn:

| Chốn thiền môn truyền thống mang lại | Bố cục Bexon Home-02 mang lại |
|---|---|
| Bảng màu lấy từ chất liệu thật: giấy dó, gỗ lim, sơn son, đồng, vải cà sa | Nền sáng, khoảng trống rộng (section cao 120px), container 1320px |
| Chữ có chân (serif) cho tiêu đề và kinh văn, gợi hoành phi, câu đối | Các khối section tối bo góc 12–16px đặt lùi vào trong lề, như những gian nhà |
| Đối xứng, trục giữa cho nội dung thiêng (tiêu đề hero, câu kệ) | Nút dạng viên thuốc (pill) với ô biểu tượng tròn, chip kicker nhỏ trên tiêu đề |
| Kính ngữ nhà Phật trong mọi câu chữ | Thẻ nội dung phẳng, không đổ bóng, phân cách bằng viền mảnh |

### 1.2. Visual Voice: Trầm ấm · Khiêm nhường · Tĩnh tại

| Nguyên tắc | Nghĩa là | Biểu hiện cụ thể |
|---|---|---|
| **Khoảng lặng** | Khoảng trống là một phần của nội dung | Section 64→120px; tối đa 1 lời kêu gọi chính mỗi màn hình; đoạn văn ≤ 720px |
| **Chất liệu thật** | Màu đến từ vật liệu chùa, không từ màu điện tử | Không dùng xanh neon, tím, gradient cầu vồng; quầng sáng vàng chỉ ở tiêu đề lớn và viền thẻ khi hover (từ 17/11, xem mục 0) |
| **Nhịp chậm** | Chuyển động chỉ để dẫn mắt, không để gây chú ý | Giữ bộ hiệu ứng của Bexon (hiện dần khi cuộn, cuộn mượt + parallax, chữ tách từng ký tự, dải chữ chạy, slider tự chạy, nút về đầu trang) theo quyết định ngày 02/11/2026. Mọi hiệu ứng tắt hẳn khi hệ điều hành bật "giảm chuyển động"; slider tự chạy ≥ 7 giây/khung, có nút tạm dừng, dừng khi di chuột hoặc focus; không âm thanh tự phát |
| **Khiêm nhường** | Nội dung Phật pháp đứng trước, giao diện lùi sau | Thẻ phẳng, viền 1px; đỏ chu sa chỉ dành cho dấu ấn, đại lễ (≤ 5% bề mặt) |
| **Dễ đọc cho người cao tuổi** | Ai cũng đọc được trên điện thoại | Thân bài 17–18px, dòng cao 1.7; tương phản thân bài ≥ 7:1; vùng chạm ≥ 48×48px |

**Tỷ lệ phân bổ màu trên một trang** (chủ đề Ngà; chủ đề tối mặc định xem mục 0): 60% nền ngà/kem · 25% chữ nâu-đá · 10% mộc + hoại sắc · ≤ 5% chu sa + đồng.

### 1.3. Từ Bexon Home-02 sang Tùng Lâm Hòa Phúc

Các giá trị bên trái đo trực tiếp trên trang mẫu (Bootstrap 5, font Mona Sans):

| Thành phần Bexon (đo được) | Chuyển thành TLHP |
|---|---|
| Nền trang `#ECF0F0`, section xen kẽ `#D8E5E5` | Ngà giấy dó `#FAFAF5`, kem ấm `#F4ECDD` |
| Section tối `#0C1E21`, bo 12px, lùi lề 15px | Đen mun `#1A120B` (lớp `.tlhp-dark`), bo 16px, lùi lề 8→16px |
| Màu chính teal `#1E8A8A` | Mộc nâu trầm `#835414` |
| Tiêu đề `#0C1E21`, thân bài `#364E52` | Gỗ lim `#2C1C11`, đá `#35302B` |
| Một họ chữ Mona Sans | Noto Serif (tiêu đề) + Be Vietnam Pro (nội dung) |
| H1 80px/83px, weight 500, tracking −2.88px | Display 44→80px, line-height 1.15, weight 600, tracking −0.01em (tiếng Việt cần dòng cao hơn cho dấu chồng như "Ẫ", "Ộ") |
| H2 48/54px · H3 32/40px · H4 24/32px | Giữ cỡ, nới line-height 1.25 · 1.3 · 1.4 |
| Body 16/24px | 17→18px, line-height 1.7 |
| Chip sub-title 14px/700, in hoa, tracking 1.4px, bo 4px, đệm 7×10px | Overline 14px/600, in hoa, tracking 0.08em, bo 4px, đệm 7×10px |
| Nút pill bo 50px, cao 48px, đệm 5/5/5/25px, ô icon tròn 38–42px | Giữ nguyên dạng; nền mộc, ô icon nền hoại sắc |
| Thẻ blog nền trắng, bo 12px, đệm nội dung 35×30px, không bóng | Nền trắng ngọc, bo 12px, viền 1px, đệm 24→32px, không bóng |
| Thẻ quy trình bo 10px; thẻ cảm nhận đệm 60×50px | Input/thẻ nhỏ bo 10px; thẻ lớn đệm 32→56px |
| Header tuyệt đối cách đỉnh 30px, cao 80px, kính mờ `rgba(255,255,255,.1)` blur 10px, bo 14px; thêm một header trắng dính riêng | Giữ cơ chế 2 header của Bexon (header nổi trên hero + header dính trượt xuống khi cuộn); bản đang ẩn đặt `inert` để trình đọc màn hình không đọc hai lần |
| Footer tối 4 cột (`col-xl-3`), dòng chữ khổng lồ chạy ngang | Footer tối 4 cột; dải chữ chạy đổi thành "Nơi để trở về – Chốn thiêng bình yên" (đứng yên khi giảm chuyển động) |
| Hiệu ứng wow `fadeInUp`, chữ hiện từng ký tự, nút tiến trình cuộn nổi góc phải | Giữ nguyên cả ba (quyết định 02/11/2026); chữ tách giữ `aria-label` nguyên câu và không cắt dấu tiếng Việt; nút về đầu trang có nhãn "Về đầu trang", vùng chạm ≥ 48px; tất cả tắt khi giảm chuyển động |
| Section padding 120px, container 1320px + lề 12px | 64→120px, container 1320px + lề 16/24/32px |

---

## 2. Quy chuẩn logo & dấu ấn nhận diện

> Bản SVG chính thức đang chờ Ban Truyền Thông (Q2: "Đang xử lý"). Quy chuẩn dưới đây viết theo file WebP hiện có; cần đo lại kích thước tối thiểu khi có SVG.

### 2.1. Cấu trúc hệ thống logo

| Phiên bản | Mô tả | Dùng ở | File hiện có |
|---|---|---|---|
| **Logo chính – Mộc Ấn** | Khiên chữ nhật bo góc nền chu sa `#942313`, khung đồng nhiều lớp (`#B48B53` → `#CCA36A`); bên trong: mái chùa cong + monogram HP + hoa sen + chữ "TÙNG LÂM HÒA PHÚC" | Header trang chủ, trang giới thiệu, ấn phẩm, phông sự kiện | `09-icon-minh-hoa/logo-moc-an.webp` (400×297) |
| **Logo ngang** (cần dựng) | Khiên (bỏ chữ trong khiên) + chữ "Tùng Lâm Hòa Phúc" Noto Serif 600 bên phải, dòng phụ "Nơi để trở về" cỡ caption | Header mọi trang, email, chữ ký | Chưa có – dựng từ SVG |
| **Ấn tròn (monogram)** | Vòng tròn: mái chùa + HP thư pháp + hoa sen + mây + chữ; bản đơn sắc mực `#232122` | Footer, watermark ảnh, con dấu tài liệu, avatar mạng xã hội | `09-icon-minh-hoa/logo-tung-lam-hoa-phuc-tron.webp` (1024×1024) |
| **Dấu HP (favicon)** | Chỉ giữ mái chùa + HP trên nền chu sa, bỏ hoa sen và chữ | Favicon, icon ứng dụng, góc thẻ | Chưa có – site cũ chưa khai báo favicon |

### 2.2. Vùng an toàn (clear space)

- Gọi **H** là chiều cao biểu tượng (chiều cao khiên hoặc đường kính ấn tròn). **X = H / 4.**
- Khoảng trống tối thiểu **X ở cả 4 phía**; không chữ, ảnh, mép màn hình hay viền nào lấn vào.
- Logo ngang: khoảng cách khiên → chữ = **X/2**; chiều cao chữ hoa của "Tùng Lâm Hòa Phúc" = **0.32H**.
- Riêng header: logo được phép tràn xuống dưới mép header (đặc trưng site cũ) nhưng vẫn giữ X với menu.

```
        ┌──────────── X ────────────┐
        │   ┌───────────────────┐   │
        X   │      LOGO (H)     │   X      X = H/4
        │   └───────────────────┘   │
        └──────────── X ────────────┘
```

### 2.3. Kích thước tối thiểu

| Phiên bản | Desktop | Mobile | In ấn | Ghi chú |
|---|---|---|---|---|
| Mộc Ấn đầy đủ | 72px cao | 56px cao | 20mm | Dưới mức này chữ trong khiên không còn đọc được → dùng logo ngang |
| Logo ngang | 48px cao | 40px cao | 12mm | Mặc định trên header (token `--tlhp-logo-h`) |
| Ấn tròn | 32px | 32px | 8mm | |
| Dấu HP (favicon) | 16px | 16px | – | Xuất `favicon.ico` 16/32, `icon.svg`, `apple-icon.png` 180, `icon-192.png`, `icon-512.png` |

### 2.4. Phối màu trên các loại nền

| Nền | Phiên bản dùng | Không dùng |
|---|---|---|
| **Sáng** (ngà `#FAFAF5`, kem `#F4ECDD`, trắng ngọc) | Mộc Ấn màu đầy đủ; Ấn tròn bản mực `#232122` hoặc gỗ lim `#2C1C11` | Ấn tròn bản đồng (tương phản thấp, 2.97:1) |
| **Tối** (nâu sẫm `#2C1C11`, đen mun `#1A120B`) | Mộc Ấn màu đầy đủ (khung đồng tạo biên); Ấn tròn đảo màu ngà `#FAFAF5` hoặc đồng `#CCA36A` (7.94:1) | Ấn tròn bản mực đen |
| **Ảnh thực tế** | Ấn tròn bản ngà/trắng; đặt ở vùng ảnh ít chi tiết, hoặc thêm lớp phủ `scrim` 55% sau vùng logo | Mộc Ấn đỏ trên ảnh tông đỏ/cam (đèn lồng, cà sa, hoa) |

**Watermark ảnh tư liệu khóa tu:** Ấn tròn bản trắng, độ mờ 60%, góc dưới phải, rộng 8% cạnh dài ảnh (tối thiểu 48px), cách mép 3% cạnh ngắn. Đóng dấu khi xuất ảnh (lúc upload), không chồng bằng CSS.

### 2.5. Điều cấm kỵ

1. Không bóp méo, kéo giãn, nghiêng hoặc xoay logo.
2. Không đổi màu khiên ngoài chu sa `#942313` và khung ngoài dải đồng; không tô gradient mới.
3. Không thêm đổ bóng, glow, viền phát sáng, vát nổi 3D (site cũ đang dùng glow vàng – cần bỏ).
4. Không tách monogram HP ra khỏi khiên khi dùng làm logo chính.
5. Không đặt logo lên nền kém tương phản hoặc ảnh rối không có lớp phủ.
6. Không sắp xếp lại bố cục khiên – chữ, không đổi phông chữ của tên chùa.
7. Không cắt xén, không đặt logo vào khung hình khác (tròn, sao, khung ảnh).
8. Không dùng logo làm họa tiết lặp nền hoặc làm hiệu ứng chuyển động.

---

## 3. Hệ thống bảng màu

### 3.1. Ba màu neo đã chốt

Bảng khảo sát Q1 (trạng thái "Đã chốt"): **Nâu trầm đất `#835414`** · **Vàng hoại sắc `#D4A373`** · **Nền ngà `#FAFAF5`**. Hai màu bổ sung lấy từ logo: **Chu sa `#942313`** (nền khiên) và **Đồng `#B48B53`** (khung). Mọi dải màu dưới đây được dựng quanh 5 màu này.

### 3.2. Bảng màu gốc (HEX · RGB · HSL)

**Màu chủ đạo 1 – Mộc – nâu trầm thiền môn (vỏ cây → gỗ lim)** · lớp Tailwind `moc-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `moc-50` | `#FAF5EE` | 250, 245, 238 | 35, 54.5%, 95.7% |  |
| `moc-100` | `#F2E6D5` | 242, 230, 213 | 35.2, 52.7%, 89.2% |  |
| `moc-200` | `#E3CBA8` | 227, 203, 168 | 35.6, 51.3%, 77.5% |  |
| `moc-300` | `#CFA874` | 207, 168, 116 | 34.3, 48.7%, 63.3% |  |
| `moc-400` | `#B48446` | 180, 132, 70 | 33.8, 44%, 49% |  |
| `moc-500` | `#9A6A2A` | 154, 106, 42 | 34.3, 57.1%, 38.4% |  |
| `moc-600` | `#835414` | 131, 84, 20 | 34.6, 73.5%, 29.6% | Neo đã chốt (bảng khảo sát Q1 – "Nâu trầm đất") |
| `moc-700` | `#6B4413` | 107, 68, 19 | 33.4, 69.8%, 24.7% |  |
| `moc-800` | `#523417` | 82, 52, 23 | 29.5, 56.2%, 20.6% |  |
| `moc-900` | `#2C1C11` | 44, 28, 17 | 24.4, 44.3%, 12% | Gỗ lim (nền tối site cũ) |
| `moc-950` | `#1A120B` | 26, 18, 11 | 28, 40.5%, 7.3% | Đen mun |

**Màu chủ đạo 2 – Hoại sắc – vàng đất cà sa / hổ phách** · lớp Tailwind `hoaisac-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `hoaisac-50` | `#FDF8F1` | 253, 248, 241 | 35, 75%, 96.9% |  |
| `hoaisac-100` | `#F8ECDA` | 248, 236, 218 | 36, 68.2%, 91.4% |  |
| `hoaisac-200` | `#EFD8B9` | 239, 216, 185 | 34.4, 62.8%, 83.1% |  |
| `hoaisac-300` | `#E3BE93` | 227, 190, 147 | 32.3, 58.8%, 73.3% |  |
| `hoaisac-400` | `#D4A373` | 212, 163, 115 | 29.7, 53%, 64.1% | Neo đã chốt (bảng khảo sát Q1 – "Vàng hoại sắc") |
| `hoaisac-500` | `#C08752` | 192, 135, 82 | 28.9, 46.6%, 53.7% |  |
| `hoaisac-600` | `#A26C3B` | 162, 108, 59 | 28.5, 46.6%, 43.3% |  |
| `hoaisac-700` | `#7A4E28` | 122, 78, 40 | 27.8, 50.6%, 31.8% |  |
| `hoaisac-800` | `#5C3B20` | 92, 59, 32 | 27, 48.4%, 24.3% |  |
| `hoaisac-900` | `#402A18` | 64, 42, 24 | 27, 45.5%, 17.3% |  |

**Phụ trợ & điểm nhấn – Chu sa – đỏ sơn son (lấy mẫu từ logo Mộc Ấn)** · lớp Tailwind `chusa-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `chusa-50` | `#FBEEEB` | 251, 238, 235 | 11.3, 66.7%, 95.3% |  |
| `chusa-100` | `#F5D6CF` | 245, 214, 207 | 11.1, 65.5%, 88.6% |  |
| `chusa-200` | `#E9AA9D` | 233, 170, 157 | 10.3, 63.3%, 76.5% |  |
| `chusa-300` | `#D97A66` | 217, 122, 102 | 10.4, 60.2%, 62.5% |  |
| `chusa-400` | `#C2503A` | 194, 80, 58 | 9.7, 54%, 49.4% |  |
| `chusa-500` | `#A83420` | 168, 52, 32 | 8.8, 68%, 39.2% |  |
| `chusa-600` | `#942313` | 148, 35, 19 | 7.4, 77.2%, 32.7% | Màu nền khiên logo Mộc Ấn (đo trực tiếp trên file logo) |
| `chusa-700` | `#7A1C10` | 122, 28, 16 | 6.8, 76.8%, 27.1% |  |
| `chusa-800` | `#5E160D` | 94, 22, 13 | 6.7, 75.7%, 21% |  |
| `chusa-900` | `#3F0F09` | 63, 15, 9 | 6.7, 75%, 14.1% |  |

**Phụ trợ & điểm nhấn – Đồng – ánh kim cho đường viền trang trọng (từ khung logo)** · lớp Tailwind `dong-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `dong-100` | `#F3E6CC` | 243, 230, 204 | 40, 61.9%, 87.6% |  |
| `dong-200` | `#E6CFA0` | 230, 207, 160 | 40.3, 58.3%, 76.5% |  |
| `dong-300` | `#D8B77E` | 216, 183, 126 | 38, 53.6%, 67.1% |  |
| `dong-400` | `#CCA36A` | 204, 163, 106 | 34.9, 49%, 60.8% | Viền vàng sáng khung logo |
| `dong-500` | `#B48B53` | 180, 139, 83 | 34.6, 39.3%, 51.6% | Viền vàng trầm khung logo |
| `dong-600` | `#946F3F` | 148, 111, 63 | 33.9, 40.3%, 41.4% |  |
| `dong-700` | `#73552F` | 115, 85, 47 | 33.5, 42%, 31.8% |  |

**Trung tính – Đá – xám đá tự nhiên (ấm)** · lớp Tailwind `da-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `da-50` | `#F7F6F2` | 247, 246, 242 | 48, 23.8%, 95.9% |  |
| `da-100` | `#EDEAE3` | 237, 234, 227 | 42, 21.7%, 91% |  |
| `da-200` | `#DDD8CD` | 221, 216, 205 | 41.2, 19%, 83.5% |  |
| `da-300` | `#C4BDAF` | 196, 189, 175 | 40, 15.1%, 72.7% |  |
| `da-400` | `#A39B8B` | 163, 155, 139 | 40, 11.5%, 59.2% |  |
| `da-500` | `#7F776A` | 127, 119, 106 | 37.1, 9%, 45.7% |  |
| `da-600` | `#635C51` | 99, 92, 81 | 36.7, 10%, 35.3% |  |
| `da-700` | `#4B453D` | 75, 69, 61 | 34.3, 10.3%, 26.7% |  |
| `da-800` | `#35302B` | 53, 48, 43 | 30, 10.4%, 18.8% |  |
| `da-900` | `#232122` | 35, 33, 34 | 330, 2.9%, 13.3% | Màu mực logo tròn |

**Nền – Nền – giấy & ngọc** · lớp Tailwind `nen-*`

| Token | HEX | RGB | HSL | Ghi chú |
|---|---|---|---|---|
| `nen-ngoc` | `#FFFEFA` | 255, 254, 250 | 48, 100%, 99% | Trắng ngọc – bề mặt thẻ |
| `nen-nga` | `#FAFAF5` | 250, 250, 245 | 60, 33.3%, 97.1% | Ngà giấy dó – nền trang (neo đã chốt Q1) |
| `nen-kem` | `#F4ECDD` | 244, 236, 221 | 39.1, 51.1%, 91.2% | Kem ấm – section xen kẽ |
| `nen-do` | `#EFE6D3` | 239, 230, 211 | 40.7, 46.7%, 88.2% | Giấy dó cổ – chế độ đọc kinh |

### 3.3. Màu vai trò theo chủ đề

Lập trình viên dùng **màu vai trò** (`bg-background`, `text-foreground`, `bg-primary`…), không dùng thẳng màu gốc, để giao diện tự đổi theo chủ đề:

- **Đêm thiền** (mặc định của cả site từ 17/11/2026: `<html data-theme="dark">`; lớp `.tlhp-dark` cho một section tối đứng riêng)
- **Ngà** (giá trị gốc ở `:root`; chọn được trong chế độ đọc bài, `data-theme="light"` trên khung đọc)
- **Giấy dó** (`data-theme="sepia"`, chế độ đọc kinh – Q14)

| Vai trò | Lớp Tailwind | Biến CSS | Ngà | Giấy dó | Đêm thiền | Dùng cho |
|---|---|---|---|---|---|---|
| bg | `bg-background` | `--tlhp-bg` | `#FAFAF5` | `#EFE6D3` | `#1A120B` | Nền trang |
| bg-alt | `bg-background-alt` | `--tlhp-bg-alt` | `#F4ECDD` | `#E8DCC4` | `#2C1C11` | Nền section xen kẽ |
| surface | `bg-surface` | `--tlhp-surface` | `#FFFEFA` | `#F6EFE2` | `#241810` | Bề mặt thẻ, input |
| fg | `text-foreground` | `--tlhp-fg` | `#35302B` | `#2C1C11` | `#F2E6D5` | Chữ thân bài |
| heading | `text-heading` | `--tlhp-heading` | `#2C1C11` | `#1A120B` | `#EFD8B9` | Chữ tiêu đề |
| muted | `text-muted` | `--tlhp-muted` | `#635C51` | `#4B453D` | `#C4BDAF` | Chữ phụ, metadata, placeholder |
| primary | `bg-primary` | `--tlhp-primary` | `#835414` | `#6B4413` | `#D4A373` | Nền nút chính |
| primary-hover | `hover:bg-primary-hover` | `--tlhp-primary-hover` | `#6B4413` | `#523417` | `#E3BE93` | Nền nút chính khi hover/active |
| primary-fg | `text-primary-foreground` | `--tlhp-primary-fg` | `#FAFAF5` | `#FAFAF5` | `#1A120B` | Chữ trên nút chính |
| accent | `bg-accent` | `--tlhp-accent` | `#D4A373` | `#D4A373` | `#D4A373` | Vàng hoại sắc: điểm nhấn, đường kẻ, nút trên nền tối |
| accent-fg | `text-accent-foreground` | `--tlhp-accent-fg` | `#1A120B` | `#1A120B` | `#1A120B` | Chữ trên nền accent |
| accent-text | `text-accent-text` | `--tlhp-accent-text` | `#7A4E28` | `#5C3B20` | `#E3BE93` | Chữ kicker/overline màu hoại sắc |
| accent-soft | `bg-accent-soft` | `--tlhp-accent-soft` | `#FDF8F1` | `#F8ECDA` | `#2E2116` | Nền chip kicker |
| ceremonial | `bg-ceremonial` | `--tlhp-ceremonial` | `#942313` | `#942313` | `#942313` | Chu sa: sự kiện đại lễ, dấu ấn |
| ceremonial-fg | `text-ceremonial-foreground` | `--tlhp-ceremonial-fg` | `#FAFAF5` | `#FAFAF5` | `#FAFAF5` | Chữ trên nền chu sa |
| link | `text-link` | `--tlhp-link` | `#6B4413` | `#6B4413` | `#E3BE93` | Liên kết |
| link-hover | `hover:text-link-hover` | `--tlhp-link-hover` | `#942313` | `#7A1C10` | `#F8ECDA` | Liên kết khi hover |
| border | `border-border` | `--tlhp-border` | `#DDD8CD` | `#D6C8AE` | `#3D2C1F` | Viền mảnh trang trí (thẻ, divider) |
| border-strong | `border-border-strong` | `--tlhp-border-strong` | `#7F776A` | `#635C51` | `#7F776A` | Viền thành phần tương tác (input) ≥ 3:1 |
| ornament | `border-ornament` | `--tlhp-ornament` | `#B48B53` | `#946F3F` | `#CCA36A` | Viền đồng ánh kim (khung trang trọng) |
| ring | `ring-ring · shadow-focus` | `--tlhp-ring` | `#835414` | `#6B4413` | `#E3BE93` | Vòng focus bàn phím |
| scrim | `bg-scrim/60` | `--tlhp-scrim` | `#1A120B` | `#1A120B` | `#000000` | Lớp phủ ảnh dưới chữ (dùng kèm độ mờ 55–70%) |

### 3.4. Màu trạng thái hệ thống (chỉ hiển thị in-line)

Đã hạ độ bão hòa để không chói trên nền giấy. Luôn kèm **biểu tượng + chữ**, không truyền đạt trạng thái chỉ bằng màu (lỗi đỏ trầm và chu sa khá gần nhau).

| Trạng thái | Lớp Tailwind | Chữ `fg` | Nền `bg` | Viền `border` | Viền đậm `solid` | Chữ (tối) | Nền (tối) |
|---|---|---|---|---|---|---|---|
| Thành công – xanh rêu | `text-success` · `bg-success-bg` · `border-success-border` | `#3F5A24` | `#EEF2E3` | `#A9BC86` | `#5B7A35` | `#B5CC8E` | `#1E2616` |
| Lưu ý – vàng nghệ | `text-warning` · `bg-warning-bg` · `border-warning-border` | `#7A4F00` | `#FBF1D8` | `#DDB65A` | `#9A6A06` | `#F0C866` | `#2B2010` |
| Lỗi – đỏ trầm | `text-error` · `bg-error-bg` · `border-error-border` | `#8E2A22` | `#F9EAE6` | `#DC9E92` | `#A63A2E` | `#F2A193` | `#2E1410` |
| Thông tin – lam tĩnh | `text-info` · `bg-info-bg` · `border-info-border` | `#2D5872` | `#E8F0F4` | `#9DBBCC` | `#3F7392` | `#9CC3DA` | `#142530` |

### 3.5. Kiểm tra tương phản WCAG 2.1

Đã tính bằng công thức độ chói tương đối của WCAG cho **117 cặp màu** trên cả 3 chủ đề: **66 đạt AAA (≥ 7:1)**, **21 đạt AA (≥ 4.5:1)**, **30 cặp thành phần giao diện đạt ≥ 3:1**, **0 cặp trượt**. Danh sách đầy đủ nằm trong `brand-tokens.json → accessibility.contrastAudit`.

Các cặp chính (chủ đề Ngà):

| Cặp màu (chữ / nền) | Mã | Tỷ lệ | Mức |
|---|---|---|---|
| Thân bài (fg) / bg | `#35302B` / `#FAFAF5` | 12.47:1 | AAA ✅ |
| Tiêu đề (heading) / bg | `#2C1C11` / `#FAFAF5` | 15.65:1 | AAA ✅ |
| Chữ phụ (muted) / bg | `#635C51` / `#FAFAF5` | 6.31:1 | AA ✅ |
| Liên kết (link) / bg | `#6B4413` / `#FAFAF5` | 8.15:1 | AAA ✅ |
| Kicker (accent-text) / bg | `#7A4E28` / `#FAFAF5` | 6.80:1 | AA ✅ |
| Viền input (border-strong) / bg | `#7F776A` / `#FAFAF5` | 4.22:1 | UI ✅ |
| Focus ring / bg | `#835414` / `#FAFAF5` | 6.18:1 | UI ✅ |
| Kicker / nền chip (accent-soft) | `#7A4E28` / `#FDF8F1` | 6.74:1 | AA ✅ |
| Nút chính: primary-fg / primary | `#FAFAF5` / `#835414` | 6.18:1 | AA ✅ |
| Nút chính hover: primary-fg / primary-hover | `#FAFAF5` / `#6B4413` | 8.15:1 | AAA ✅ |
| Nút nhấn: accent-fg / accent | `#1A120B` / `#D4A373` | 8.18:1 | AAA ✅ |
| Nút đại lễ: ceremonial-fg / ceremonial | `#FAFAF5` / `#942313` | 7.99:1 | AAA ✅ |
| Liên kết hover / bg | `#942313` / `#FAFAF5` | 7.99:1 | AAA ✅ |
| success: fg / nền trạng thái | `#3F5A24` / `#EEF2E3` | 6.83:1 | AA ✅ |
| success: viền solid / nền trạng thái | `#5B7A35` / `#EEF2E3` | 4.31:1 | UI ✅ |
| warning: fg / nền trạng thái | `#7A4F00` / `#FBF1D8` | 6.34:1 | AA ✅ |
| warning: viền solid / nền trạng thái | `#9A6A06` / `#FBF1D8` | 4.21:1 | UI ✅ |
| error: fg / nền trạng thái | `#8E2A22` / `#F9EAE6` | 7.16:1 | AAA ✅ |
| error: viền solid / nền trạng thái | `#A63A2E` / `#F9EAE6` | 5.49:1 | UI ✅ |
| info: fg / nền trạng thái | `#2D5872` / `#E8F0F4` | 6.62:1 | AA ✅ |
| info: viền solid / nền trạng thái | `#3F7392` / `#E8F0F4` | 4.46:1 | UI ✅ |
| *Đêm thiền:* Thân bài (fg) / bg | `#F2E6D5` / `#1A120B` | 15.02:1 | AAA ✅ |
| *Đêm thiền:* Tiêu đề (heading) / bg | `#EFD8B9` / `#1A120B` | 13.38:1 | AAA ✅ |
| *Đêm thiền:* Chữ phụ (muted) / bg | `#C4BDAF` / `#1A120B` | 9.91:1 | AAA ✅ |
| *Đêm thiền:* Liên kết (link) / bg | `#E3BE93` / `#1A120B` | 10.62:1 | AAA ✅ |
| *Đêm thiền:* Kicker (accent-text) / bg | `#E3BE93` / `#1A120B` | 10.62:1 | AAA ✅ |
| *Đêm thiền:* Viền input (border-strong) / bg | `#7F776A` / `#1A120B` | 4.18:1 | UI ✅ |
| *Đêm thiền:* Focus ring / bg | `#E3BE93` / `#1A120B` | 10.62:1 | UI ✅ |
| *Đêm thiền:* Liên kết hover / bg | `#F8ECDA` / `#1A120B` | 15.86:1 | AAA ✅ |
| *Chỉ trang trí:* Hoại sắc-400 / ngà (chỉ trang trí, cấm làm chữ) | `#D4A373` / `#FAFAF5` | 2.16:1 | ⚠️ không dùng cho chữ |
| *Chỉ trang trí:* Đồng-500 / ngà (đường viền trang trí) | `#B48B53` / `#FAFAF5` | 2.97:1 | ⚠️ không dùng cho chữ |
| *Chỉ trang trí:* border (da-200) / ngà (viền thẻ trang trí) | `#DDD8CD` / `#FAFAF5` | 1.36:1 | ⚠️ không dùng cho chữ |

**Quy tắc rút ra**

- Thân bài và tiêu đề luôn đạt AAA trên mọi nền (ngà, kem, trắng ngọc, giấy dó, đen mun).
- **Vàng hoại sắc `#D4A373` không dùng làm chữ trên nền sáng** (2.16:1). Chỉ dùng làm nền nút có chữ tối (8.18:1), đường kẻ trang trí, hoặc chữ trên nền tối. Chữ màu hoại sắc trên nền sáng dùng `hoaisac-700 #7A4E28`.
- **Đồng `#B48B53` trên nền sáng chỉ để trang trí** (2.97:1). Viền mang thông tin (input, checkbox) dùng `border-strong` (đá-500, 4.22:1).
- Chữ đặt trên ảnh: luôn có lớp phủ `scrim` tối thiểu 55% dưới vùng chữ, hoặc đặt chữ trong khối nền đặc.
- Không hạ độ mờ chữ (opacity) dưới 100% cho thân bài. Muốn chữ nhạt hơn thì dùng `text-muted`, không dùng `text-foreground/60`.

---

## 4. Hệ thống kiểu chữ

### 4.1. Phông chữ

| Vai trò | Phông | Lý do chọn |
|---|---|---|
| **Tiêu đề mục, tiêu đề trang, khẩu hiệu hero** | **UTM Niagara** (400, in hoa) | Chữ tiêu đề của web cũ, chủ dự án chọn ngày 13/11/2026; tự host một file woff2 10 KB (`src/app/assets/fonts/tlhp/`), bảng tên của font ghi "Free for everyone"; cỡ 44 → 72px, hero 64 → 128px |
| **Tiêu đề phụ, tiêu đề bài, kinh văn, câu kệ** | **Noto Serif** (400, 500, 600, 700, nghiêng 400) | Có chân, trang trọng, nét thanh; Google thiết kế cho đủ dấu tiếng Việt chồng tầng; có trong danh sách Q5 đã chốt; miễn phí (OFL) |
| **Nội dung, giao diện, nút, form** | **Be Vietnam Pro** (400, 500, 600, 700, nghiêng 400) | Do người Việt thiết kế riêng cho tiếng Việt, dấu rõ và thoáng ở cỡ nhỏ, chiều cao chữ thường lớn dễ đọc cho người cao tuổi; dự phòng Inter |
| Mã số | Font mono hệ thống | Mã đăng ký, mã bảo tượng `TP0001` |

Đã loại: **Cinzel** (không có bộ ký tự tiếng Việt – đã kiểm tra trên Google Fonts, chỉ có latin/latin-ext), **Playfair Display** (tương phản nét quá mạnh, dấu nhỏ dễ mất ở cỡ dưới 20px), **UTM Avo** và **UTM Classizism Antiqua** của site cũ (đang tải TTF nặng; Be Vietnam Pro và Noto Serif thay vai). Riêng UTM Niagara được dùng lại từ 13/11/2026, xem bảng trên.

Nạp bằng `next/font/google` với `subsets: ['latin', 'vietnamese']` (subset `vietnamese` chỉ chứa ký tự có dấu, phải kèm `latin`), `display: 'swap'`, tự host trên Cloudflare.

### 4.2. Bảng phân cấp cỡ chữ

Cỡ chữ co giãn mượt từ màn hình 375px (giá trị nhỏ) đến 1320px (giá trị lớn) bằng `clamp()`.

| Cấp | Lớp Tailwind | Phông | Cỡ mobile → desktop | Line-height | Weight | Tracking | Dùng cho |
|---|---|---|---|---|---|---|---|
| display | `text-display` | Noto Serif | 44 → 80px | 1.15 | 600 | -0.01em | Hero trang chủ ("Nơi để trở về"), tên đại lễ |
| h1 | `text-h1` | Noto Serif | 36 → 60px | 1.2 | 600 | -0.005em | Tiêu đề trang, tên khóa tu lớn |
| h2 | `text-h2` | Noto Serif | 30 → 48px | 1.25 | 600 | 0 | Tiêu đề phân mục, "Lịch tu học" |
| h3 | `text-h3` | Noto Serif | 24 → 32px | 1.3 | 600 | 0 | Tiêu đề bài viết, khối nổi bật |
| h4 | `text-h4` | Noto Serif | 20 → 24px | 1.4 | 600 | 0 | Tiêu đề thẻ khóa tu / bài viết |
| title | `text-title` | Be Vietnam Pro | 18 → 20px | 1.45 | 600 | 0 | Tiêu đề cột footer, nhãn khối, tiêu đề nhỏ giao diện |
| scripture | `text-scripture` | Noto Serif | 19 → 21px | 1.85 | 400 | 0.005em | Kinh văn, câu kệ, lời Thầy dạy |
| body-lg | `text-body-lg` | Be Vietnam Pro | 18 → 20px | 1.8 | 400 | 0 | Bài pháp thoại, nội dung dài |
| body | `text-body` | Be Vietnam Pro | 17 → 18px | 1.7 | 400 | 0 | Nội dung mặc định |
| body-sm | `text-body-sm` | Be Vietnam Pro | 16px | 1.6 | 400 | 0 | Mô tả thẻ, chữ phụ giao diện (mức nhỏ nhất cho đoạn văn) |
| caption | `text-caption` | Be Vietnam Pro | 14px | 1.5 | 500 | 0.01em | Ngày đăng, lượt xem, chú thích ảnh (không dùng cho đoạn văn) |
| overline | `text-overline` | Be Vietnam Pro | 14px | 1 | 600 | 0.08em, IN HOA | Kicker/chip trên tiêu đề section (kiểu sub-title Bexon) |
| button | `text-button` | Be Vietnam Pro | 16px | 1.25 | 600 | 0.01em | Chữ nút, viết hoa đầu câu (không in hoa toàn bộ) |
| nav | `text-nav` | Be Vietnam Pro | 16px | 1.5 | 500 | 0 | Mục menu chính |
| label | `text-label` | Be Vietnam Pro | 16px | 1.4 | 600 | 0 | Nhãn trường biểu mẫu (luôn hiển thị) |

### 4.3. Quy tắc chữ tiếng Việt

1. **Line-height tiêu đề ≥ 1.15**, thân bài ≥ 1.6 để dấu chồng (Ẫ, Ỗ, Ữ) không chạm dòng trên.
2. **Không in hoa toàn bộ** cho đoạn dài, nút bấm và menu. Chỉ overline/chip (14px) được in hoa.
3. **Không chữ dưới 14px**; đoạn văn tối thiểu 16px (Q5).
4. Tracking âm chỉ cho display/h1 (≤ −0.01em); không ép chữ hẹp.
5. Kinh văn, câu kệ: Noto Serif cỡ `scripture`, căn giữa khi là kệ ngắn, căn trái khi là đoạn dài; không căn đều hai bên (justify) vì tiếng Việt dễ tạo lỗ trắng.
6. Đặt `lang="vi"` trên `<html>` để trình đọc màn hình đọc đúng.

---

## 5. Đặc tả thành phần giao diện

### 5.1. Nút bấm (CTA)

| Thuộc tính | Quy cách |
|---|---|
| Hình dạng | Pill (bo `9999px`) theo Bexon; chip/tag dùng bo `4px` |
| Kích thước | `sm` 40px (chỉ trong bảng admin) · `md` 48px (mặc định) · `lg` 56px (hero) |
| Chữ | `text-button` 16px/600, viết hoa đầu câu ("Đăng ký khóa tu", không "ĐĂNG KÝ KHÓA TU") |
| Biến thể | **Primary** nền mộc, chữ ngà, ô icon tròn nền hoại sắc bên phải · **Secondary** viền `border-strong`, nền trong · **Ceremonial** nền chu sa – tối đa 1 nút/màn hình, cho đại lễ · **Ghost** dạng liên kết |
| Hover | Đổi nền sang `primary-hover` trong 150ms; giữ hiệu ứng Bexon: nhãn cuộn lên thay bằng bản sao, mũi tên trong ô icon xoay về nằm ngang |
| Focus | Vòng kép `shadow-focus` (luôn thấy trên mọi nền) |
| Disabled / Loading | Độ mờ 50% · giữ nguyên độ rộng, nhãn "Đang gửi…", `aria-busy="true"` |
| Cấm | Bóng phát sáng màu (glow), gradient, nhấp nháy, rung |

```tsx
<a href="/dang-ky" className="group inline-flex min-h-touch items-center gap-3 rounded-pill bg-primary py-[5px] pl-7 pr-[5px] text-button text-primary-foreground transition-colors duration-fast ease-calm hover:bg-primary-hover focus-visible:shadow-focus focus-visible:outline-none">
  Đăng ký khóa tu
  <span aria-hidden className="grid size-[38px] place-items-center rounded-pill bg-accent text-accent-foreground transition-transform duration-base ease-out group-hover:translate-x-0.5">→</span>
</a>
```

### 5.2. Thẻ khóa tu / bài viết

| Thuộc tính | Quy cách |
|---|---|
| Khung | Nền `surface`, viền 1px `border`, bo 12px, không đổ bóng (hover: `shadow-sm`) |
| Ảnh | Trên cùng; **16:9** cho khóa tu, sự kiện, video · **4:3** cho bài viết, album · **3:4** cho chân dung chư Tôn đức, bảo tượng. Ảnh hover phóng 1.03 trong 300ms |
| Nhãn ngày | Khối nhỏ góc trên trái ảnh (kiểu `blog-date` Bexon): ngày dương to (serif) + tháng; dòng meta ghi thêm ngày âm |
| Đệm | `p-card` (24→32px) |
| Thứ tự nội dung | Chip chuyên mục → tiêu đề `h4` (tối đa 3 dòng) → mô tả `body-sm` (tối đa 3 dòng) → meta `caption`: ngày dương · ngày âm · lượt xem → liên kết "Xem chi tiết" |
| Trạng thái khóa tu (Q9) | Chip in-line trong thẻ: "Đang mở đăng ký" (success) · "Đã đủ số lượng" (warning) · "Đã kết thúc" (muted) |
| Lưới | 1 cột (mobile) → 2 (md) → 3 (xl); khoảng cách `gap-grid` 16→30px |

```tsx
<article className="group overflow-hidden rounded-lg border border-border bg-surface transition-shadow duration-base hover:shadow-sm">
  <div className="relative aspect-event overflow-hidden">
    <img src={cover} alt={alt} className="size-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.03]" />
  </div>
  <div className="p-card">
    <span className="inline-block rounded-xs bg-accent-soft px-2.5 py-[7px] text-overline text-accent-text">Khóa tu</span>
    <h3 className="mt-4 line-clamp-3 font-serif text-h4 text-heading">{title}</h3>
    <p className="mt-3 line-clamp-3 text-body-sm text-muted">{excerpt}</p>
    <p className="mt-4 text-caption text-muted">{solarDate} · {lunarDate} Âm lịch</p>
  </div>
</article>
```

### 5.3. Thanh điều hướng (Header)

| Thuộc tính | Quy cách |
|---|---|
| Dải thông báo (Q12) | Dải tĩnh 48px **nằm trong luồng trang** phía trên header, nền `accent-soft`, chữ `body-sm`, có nút "Đóng" thủ công; không trượt, không nổi, không tự bật lại trong cùng phiên |
| Chiều cao | 80px desktop · 64px mobile (`h-header`) |
| Hành vi dính | `sticky top-0`; trên hero: nền trong suốt; cuộn quá 80px: nền `background/92` + `backdrop-blur-[10px]` + `shadow-md`, chuyển trong 250ms |
| Bố cục | Logo trái (48/40px) · menu giữa · cụm hành động phải: nút tròn 48px "Gọi điện" (`tel:`), "Chỉ đường" (Google Maps), CTA pill "Đăng ký khóa tu" |
| Menu mẹ (Q6) | Giới thiệu ▾ · Tin tức – Pháp thoại ▾ · Lịch tu học · Liên hệ ("Đăng ký khóa tu" là nút ở header, từ 17/11 không lặp lại trong menu) |
| Logo ở header | Từ 1280px, Mộc Ấn 140×104 treo dưới thanh header như web cũ; dưới 1280px là ấn nhỏ 40–48px trong thanh |
| Menu con | Mở khi **bấm** (hoặc di chuột có độ trễ 150ms), là bảng liên kết gắn dưới mục mẹ; đóng bằng Esc/bấm ra ngoài; điều hướng được bằng bàn phím (`aria-expanded`) |
| Điểm ngắt | Menu ngang từ `xl` (1280px). Dưới 1280px: nút "Menu" mở **bảng điều hướng đẩy nội dung xuống** (accordion trong luồng trang), không dùng ngăn kéo phủ lớp |
| Chữ menu | `text-nav` 16px/500, khoảng cách mục 32px; mục đang xem gạch chân 2px màu `accent` |

### 5.4. Chân trang (Footer)

Nền `.tlhp-dark` (đen mun), bo 16px, lùi lề `mx-section-inset` như footer Bexon; đệm trên 96px.

| Cột | Nội dung |
|---|---|
| 1. Bổn tự | Ấn tròn bản ngà + đoạn giới thiệu 2–3 dòng + địa chỉ (Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội) + mạng xã hội (Tùng Lâm Hòa Phúc, Quỳnh Nhai Cam Lộ Tự) |
| 2. Thời khóa tu học | Giờ mở cửa, lịch cộng tu định kỳ, liên kết "Xem lịch tu học" (lấy từ cấu hình admin, không gõ cứng) |
| 3. Liên hệ | Trưởng ban lãnh chúng · Thư ký · Hỗ trợ thông tin – mỗi số là liên kết `tel:` cao ≥ 48px |
| 4. Bản đồ chùa | Ảnh bản đồ tĩnh (không nhúng iframe sẵn – nặng và có cookie) + nút "Mở Google Maps" |

Lưới: 1 cột (mobile) → 2 (md) → 4 (xl). Dải cuối: "© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc" · khẩu hiệu "Nơi để trở về – Chốn thiêng bình yên" · liên kết "Về đầu trang" (thay cho nút nổi).

### 5.5. Thông báo in-line, biểu mẫu & trạng thái

| Thành phần | Quy cách |
|---|---|
| Khối thông báo | Viền trái 4px màu `*-solid`, nền `*-bg`, icon 20px, tiêu đề 600, mô tả `body-sm`, bo 10px. `role="alert"` cho lỗi, `role="status"` cho thành công/thông tin |
| Vị trí | Ngay trên nút gửi (tóm tắt lỗi) và ngay dưới trường lỗi. Sau khi gửi lỗi: đưa focus tới khối tóm tắt |
| Input | Cao 48px, bo 10px, viền 1px `border-strong`, nền `surface`, đệm ngang 16px; nhãn luôn hiển thị phía trên (16px/600); lỗi: viền `error-solid` + dòng chữ `error` có icon |
| Đăng ký thành công (Q15) | Chuyển sang trang tĩnh `/dang-ky/thanh-cong`: mã đăng ký, tóm tắt, dặn dò y phục – tư trang, nút in phiếu / lưu mã QR |
| Đang tải | Khung xương (skeleton) đúng vị trí nội dung, nền `bg-alt`; không spinner phủ toàn trang |

```tsx
<div role="alert" className="flex gap-3 rounded-md border border-error-border border-l-4 border-l-error-solid bg-error-bg p-4 text-error">
  <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
  <div>
    <p className="font-semibold">Chưa gửi được đăng ký</p>
    <p className="text-body-sm">Kính mời quý vị nhập số điện thoại hợp lệ (10 chữ số).</p>
  </div>
</div>
```

**Giọng văn thông báo:** "Kính mời quý vị…", "Kính mong quý vị hoan hỷ…", "Nam Mô A Di Đà Phật". Ví dụ lỗi hệ thống: "Hệ thống đang bận, kính mong quý vị hoan hỷ thử lại sau ít phút."

### 5.6. Quy tắc ZERO FLOATING UI

Ngày 02/11/2026 chủ dự án quyết định giữ toàn bộ hiệu ứng của Bexon, nên hai mục nút về đầu trang và carousel tự chạy được nới như ghi trong bảng (đảo ngược UX-01, UX-03). Các mục còn lại vẫn cấm.

| Cấm tuyệt đối | Thay bằng |
|---|---|
| Toast, snackbar "Đã lưu/Đã gửi" | Dòng trạng thái in-line cạnh nút (`role="status"`) |
| Modal/popup tự bật (kể cả popup chào mừng của site cũ) | Khối "Lời chào" tĩnh trên trang chủ hoặc trang Giới thiệu |
| Banner nổi, thanh dính đáy, bong bóng chat nổi | Dải thông báo trong luồng đầu trang (Q12); khối "Hỏi AI Hòa Phúc" là một section trong trang |
| ~~Nút "lên đầu trang" nổi, thanh tiến trình cuộn nổi~~ **Được giữ** | Nút `BackToTop` của Bexon (vòng tiến trình cuộn) có nhãn "Về đầu trang", vùng chạm ≥ 48px, không che nội dung ở 375px; footer vẫn có liên kết "Về đầu trang" |
| Banner cookie nổi | Dùng phân tích không cookie (Cloudflare Web Analytics) để khỏi cần banner; nếu bắt buộc, đặt thông tin trong trang Chính sách và footer |
| Đếm ngược nhảy từng giây (Q7) | Đếm theo ngày, tĩnh: "Còn 12 ngày đến khóa tu" |
| ~~Carousel tự chạy~~ **Được giữ** | Slider của Bexon tự chạy ≥ 7 giây/khung, có nút tạm dừng dùng được bằng bàn phím, dừng khi di chuột/focus (WCAG 2.2.2); không tự chạy khi giảm chuyển động |

**Được phép** (do người dùng chủ động mở, đóng bằng Esc, có bẫy focus, không tự mở lại): menu con, accordion, tab, `<details>`, lightbox xem ảnh album (Q8).

---

## 6. Áp dụng vào mã nguồn Next.js

### 6.1. Áp vào Bexon (Bootstrap/SCSS) – cách website chùa đang dùng

Website dựng lại từ theme Bexon (Bootstrap 5 + SCSS), giữ nguyên markup và hiệu ứng, chỉ đổi màu, chữ và nội dung. Bộ token không thay Bootstrap mà nằm trên nó qua một **cầu nối biến CSS**.

**Thứ tự nạp** (`src/app/layout.js` → `src/app/globals.scss`):

1. `design-system/tokens.css` – nguồn duy nhất của màu, chữ, khoảng cách (`--tlhp-*`).
2. Bootstrap + các partial Bexon còn giữ – đọc mọi màu, font, cỡ tiêu đề từ `--tj-*`.
3. `utilities/_tlhp-bridge.scss` – trỏ từng `--tj-*` sang `--tlhp-*`. Khai báo trên `:root, [data-theme], .tlhp-dark` để giá trị tự đổi theo chủ đề.
4. `components/_reduced-motion.scss` – tắt chuyển động khi hệ điều hành bật "giảm chuyển động".

| Biến Bexon | Trỏ sang | Ghi chú |
|---|---|---|
| `--tj-color-grey-1` / `--tj-color-theme-bg` | `--tlhp-bg` / `--tlhp-bg-alt` | Nền trang ngà, section xen kẽ kem |
| `--tj-color-theme-primary` | `--tlhp-primary` | Mộc; trong `.tlhp-dark` và chủ đề tối thành hoại sắc |
| `--tj-color-theme-dark` | `--tlhp-moc-950` | Đen mun cho section tối, footer |
| `--tj-color-heading-primary` / `--tj-color-text-body` | `--tlhp-heading` / `--tlhp-fg` | Gỗ lim / đá |
| `--tj-color-border-1` | `--tlhp-border` | Viền 1px |
| `--tj-ff-heading` / `--tj-ff-body` | `--tlhp-font-serif` / `--tlhp-font-sans` | Biến của `next/font` đặt trên `<html>` |
| `--tj-fs-h1` … `--tj-fs-h6` | `--tlhp-text-display` … `--tlhp-text-body-lg` | Cỡ tiêu đề theo token |
| `--bs-code-color` | `--tlhp-accent-text` | Thay màu hồng mặc định của Bootstrap |

**Quy tắc khi sửa SCSS của Bexon:**

- **Không viết cứng mã màu.** Partial Bexon dùng `var(--tj-…)`; mã mới dùng thẳng `var(--tlhp-…)`. Màu trong suốt viết `color-mix(in srgb, var(--tj-color-theme-dark) 40%, transparent)` thay cho `rgba(…)`. Ảnh SVG trang trí tô bằng mã hex của token (ví dụ hoại sắc `#D4A373`).
- **Chữ tiếng Việt:** tiêu đề line-height ≥ 1.15 (dùng `--tlhp-leading-*`), giãn chữ không âm hơn −0.01em; tiêu đề một dòng cũng không để `line-height: 1`. Không `text-transform: capitalize` cho menu (giữ viết hoa đầu câu).
- **Hiệu ứng tách chữ** (`titleAnim*`, GSAP SplitText 3.13): SplitText tự gắn `aria-label` nguyên câu và tách theo cụm chữ (không rời dấu). Lớp che dòng dùng `clip-path: inset(-0.35em -0.1em -0.25em -0.1em)` thay cho `overflow: hidden` để không cắt dấu chồng và dấu nặng.
- **Nút** (`ButtonPrimary` → `.tj-primary-btn`): nền mộc, chữ ngà, ô icon tròn nền hoại sắc (đảo thành nền tối, mũi tên hoại sắc trong section tối), cao ≥ 48px, focus `--tlhp-shadow-focus`. Ô icon đặt `aria-hidden`. Nhãn cuộn lên khi hover nằm trong hộp có đệm 0.3em và dịch 2em để không cắt dấu.
- **Chip trên tiêu đề** (`.sec-heading.style-2 .sub-title`): nền `--tlhp-accent-soft`, chữ `--tlhp-accent-text`.
- **Section tối:** thêm lớp `.tlhp-dark` (mọi biến bên trong tự đổi), hoặc giữ section tối gốc của Bexon (`.tj-service-section`, footer) vốn dùng `--tj-color-theme-dark`.
- **Chuyển động:** mọi hiệu ứng kiểm `prefersReducedMotion()` (`src/libs/motion.ts`); CSS ẩn phần tử chờ hiệu ứng phải nằm trong `@media (prefers-reduced-motion: no-preference)`.

**Kiểm tra:** trang `/styleguide` (noindex, trả 404 trên `www`) bày đủ màu, h1–h6 có "Ẫ Ộ Ữ Ỹ ạ ợ", hiệu ứng tách chữ, nút, thẻ, biểu mẫu và section tối. Test: `tests/e2e/theme.spec.ts`, `tests/e2e/styleguide.spec.ts` (không còn teal `rgb(30, 138, 138)`, số đo tiêu đề, nút, axe ở nền sáng và tối).

### 6.2. Dự án dùng Tailwind (tham khảo)

Các đoạn dưới đây dành cho ứng dụng mới viết bằng Tailwind (ví dụ trang quản trị nếu dựng riêng).

```tsx
// app/layout.tsx
import { Noto_Serif, Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

const serif = Noto_Serif({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-noto-serif', display: 'swap' });
const sans = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-be-vietnam-pro', display: 'swap' });

export const viewport = { themeColor: '#FAFAF5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="light" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css — Tailwind v4 */
@import "tailwindcss";
@import "../design-system/tokens.css";
@config "../design-system/tailwind.config.js";

/* Tailwind v3: thay 3 dòng trên bằng
   @import "../design-system/tokens.css";
   @tailwind base; @tailwind components; @tailwind utilities;
   và đặt tailwind.config.js ở gốc dự án */
```

**Section tối kiểu Bexon** – mọi lớp vai trò bên trong tự đổi sang bảng màu tối:

```tsx
<section className="tlhp-dark mx-section-inset rounded-xl bg-background py-section-y text-foreground">
  <div className="mx-auto max-w-container px-gutter">
    <span className="rounded-xs bg-accent-soft px-2.5 py-[7px] text-overline text-accent-text">Lịch tu học</span>
    <h2 className="mt-5 font-serif text-h2 text-heading">Thời khóa Phật lịch 2570</h2>
  </div>
</section>
```

**Chế độ đọc kinh (Q14):** bọc bài trong `<article className="tlhp-reading mx-auto">`; nút A−/A+ đặt `style={{ '--tlhp-reading-scale': 1.15 }}` trên khung đọc; nút "Giấy dó" đặt `data-theme="sepia"` trên `<html>` và lưu lựa chọn vào `localStorage`.

**Dùng JSON** (email xác nhận, ảnh OG, biểu đồ admin):

```ts
import tokens from '@/design-system/brand-tokens.json';
const primary = tokens.color.semantic.light.primary;      // "#835414"
const title = tokens.typography.h2;                        // { fontSize, lineHeight, fontWeight, … }
```

---

## 7. Điểm cần Ban Trị Sự / Ban Truyền Thông xác nhận

| # | Nội dung | Đề xuất trong bộ này |
|---|---|---|
| 1 | Font nội dung: Q5 (đã chốt) ghi "Roboto/Inter" | Đề xuất **Be Vietnam Pro** (thiết kế cho tiếng Việt), Inter làm dự phòng. Đổi lại chỉ cần sửa 1 dòng `--tlhp-font-sans` |
| 2 | Chuyển từ giao diện nền tối + vàng phát sáng (site hiện tại) sang nền ngà sáng | Theo Q1 đã chốt (nền ngà `#FAFAF5`) và Bexon Home-02; giữ nền tối cho các section nhấn và footer |
| 3 | Logo SVG chính thức, bản ngang (Q2 đang xử lý) | Cần file để dựng logo ngang, favicon và đo lại kích thước tối thiểu |
| 4 | Khẩu hiệu hero (Q3 chưa trả lời) | Tạm dùng "Nơi để trở về – Chốn thiêng bình yên" của site hiện tại |
| 5 | Đếm ngược khóa tu trên hero (Q7) | Đếm theo ngày, không nhảy giây |
