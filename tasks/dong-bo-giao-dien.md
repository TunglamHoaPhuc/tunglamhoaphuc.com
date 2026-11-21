# Checklist: đồng bộ giao diện web cũ sang web mới và thiết kế lại các trang

Nhánh `feat/chu-de-toi-web-cu`, worktree `.claude/worktrees/chu-de-toi`. Lập ngày 17/11/2026.
Việc này chạy song song với `tasks/todo.md` (T1–T41) và không thay thế nó.

Ký hiệu: `[x]` đã làm và đã kiểm · `[~]` làm một phần · `[ ]` chưa làm · `[?]` chờ chủ site quyết.

## 0. Skill đã dùng

| Skill | Dùng cho |
|---|---|
| `ui-ux-pro-max` | Thứ tự ưu tiên rà soát (a11y → chạm → bố cục → chữ, màu → chuyển động), checklist trước khi giao |
| `agent-skills:planning-and-task-breakdown` | Chia việc thành mục nhỏ có tiêu chí kiểm, có điểm dừng kiểm tra |
| `agent-skills:frontend-ui-engineering` | Bản "hợp đồng thiết kế", responsive 375 / 768 / 1024 / 1440, tránh giao diện rập khuôn |
| `web-design-guidelines` | Rà giao diện theo Web Interface Guidelines |
| `superpowers:verification-before-completion` | Chỉ đánh `[x]` khi có bằng chứng (test, ảnh chụp, số đo) |

Tra `ui-ux-pro-max --design-system` cho "chùa, sự kiện, nền tối vàng kim" trả về kiểu "Vibrant & Block-based" (cam, xanh): không hợp, **không áp dụng**. Hướng thiết kế lấy từ chính web cũ.

## 1. Một tuyến nội dung (hợp đồng thiết kế)

Người tu học vào trang để làm bốn việc, theo thứ tự này. Mọi trang, menu và khối trang chủ xếp theo đúng thứ tự đó.

1. **Sắp tới chùa có gì** → Khóa tu sắp tới, Lịch tu học.
2. **Chùa vừa làm gì, Thầy dạy gì** → Dòng Chảy Hoằng Pháp, Tông Chỉ Tu Học, Trí Tuệ Phật Pháp.
3. **Chùa là nơi thế nào** → Giới thiệu, Vũ Trụ Phật Giáo, Bảo Tượng Phật Giáo.
4. **Liên hệ, đăng ký** → Liên hệ, Đăng ký khóa tu.

Giữ nguyên: khung Bexon và mọi hiệu ứng (quyết định 02/11), tối ưu ảnh hiện tại (`imageAt()`, `/cdn-cgi/image`, `/anh-goc`, tải lười, ngân sách ảnh), mức a11y tối thiểu (chữ thân bài ≥ 16px, tương phản AA, vùng chạm ≥ 44px).

Lấy từ web cũ: nền nâu đen, vàng kim, UTM Niagara cho tiêu đề, biểu tượng vàng trên tiêu đề mục, thẻ viền vàng, nút dạng viên thuốc.

Không lấy từ web cũ: chữ 10–13px (web cũ dùng rất nhiều, khó đọc với người lớn tuổi), hộp thoại tự bật khi vào trang, video nền tự chạy.

## 2. Đồng bộ tiểu tiết web cũ → web mới

Số đo web cũ lấy bằng máy ngày 17/11/2026 ở 1440px và 375px trên 9 trang.

### 2.1 Màu

| # | Vai trò | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| M1 | Nền trang chủ | `#1A120B` | `#1A120B` | [x] |
| M2 | Nền trang trong, nền xen kẽ | `#2C1C11` | `#2C1C11` (nền xen kẽ và thẻ) | [x] |
| M3 | Chữ thân bài | `#E3D2C1` | `#E3D2C1` | [x] |
| M4 | Tiêu đề lớn | `#F2C14E`, quầng sáng 24px | `#F2C14E`, quầng sáng 24px | [x] |
| M5 | Tiêu đề thẻ | `#F2C14E` / `#FFE5A3` | `#FFE5A3` | [x] |
| M6 | Dòng dẫn nhỏ (kicker) | `#E5A93C`, nghiêng | `#E5A93C`, in hoa giãn chữ | [x] |
| M7 | Chữ phụ, mô tả thẻ | `#C9B896` | `#C9B896` | [x] |
| M8 | Ngày tháng, số liệu phụ | `#A69383` | `#A69383` ở ngày đăng và lượt xem của thẻ bài, trang bài | [x] |
| M9 | Viền thẻ | vàng `#F2C14E` 20–30%, hover 50–60% | vàng 22%, hover 55% có quầng sáng | [x] |
| M10 | Nút chính | dải vàng `#F2C14E → #E5A93C`, chữ nâu đen | dải vàng `#F2C14E → #E5A93C`, chữ nâu đen | [x] |
| M11 | Nút phụ | viên thuốc nâu `#4A3728 → #3D2B1F`, viền vàng | viên thuốc nâu `#4A3728 → #3D2B1F`, viền vàng | [x] |
| M12 | Header | `rgba(26,15,8,.95 → .82)`, mờ nền 14px, viền dưới vàng 28% | cùng nền, mờ nền và viền vàng; giữ dạng thanh bo góc của Bexon | [x] |
| M13 | Footer | dải `#3D2B1F → #2A1D14`, sóng vàng | dải `#3D2B1F → #2A1D14`, viền trên vàng, sóng vàng mờ ở chân | [x] |
| M14 | Đỏ sơn son (Chủ nhật, nhãn) | đỏ tươi trên nền tối | `#D97A66` (đạt 4.5:1) | [x] |

### 2.2 Hình nền

| # | Chỗ | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| N1 | Hero trang chủ | video YouTube tự chạy, tắt tiếng, phủ tối | ảnh toàn cảnh chùa, slider | [x] giữ ảnh (video nặng, đã chốt ở T10) |
| N2 | Banner trang trong | ảnh bài mới nhất mờ 30%, hòa màu, phủ dải nâu | ảnh nền chung, phủ dải nâu tan vào nền trang, huy hiệu nhỏ trên tiêu đề, banner thấp hơn | [x] dùng một ảnh nền chung thay vì ảnh bài mới nhất |
| N3 | Nền mục trang chủ | ảnh mờ + dải `#1A120B` trên, dưới | quầng sáng vàng mờ sau tiêu đề (Khóa tu, Khu vực, Chư Tôn Đức) | [x] dùng dải màu thay ảnh mờ để không tải thêm ảnh |
| N4 | Họa tiết sen | `lotus-pattern.png` mờ 3% | `pattern-2/3.webp` | [x] dùng họa tiết sẵn có |
| N5 | Thẻ | dải nâu đậm từ trên xuống | dải `#2C1C11 → #1E140C` | [x] |

### 2.3 Icon

| # | Chỗ | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| I1 | Trên tiêu đề mục | icon vàng 80px (tin mới, dấu ấn, lịch, khu vực, bảo tượng) | icon vàng 72 / 56px trên 6 khối trang chủ | [x] |
| I2 | Huy hiệu tròn giữa ảnh và chữ của thẻ | có | có ở thẻ bài, thẻ khu vực, thẻ tượng | [x] |
| I3 | Loại sự kiện trong lịch | cộng tu, khóa lễ, đại lễ | có | [x] |
| I4 | Menu | không icon | icon vàng trong menu thả | [x] giữ (dễ nhận hơn) |
| I5 | Mạng xã hội ở footer | 9 nút (Zalo, nhóm, Instagram, Facebook, TikTok, YouTube, Facebook và web Quỳnh Nhai Cam Lộ Tự…), **không nút nào gắn địa chỉ** | chưa có (chờ GD-06) | [?] web cũ không có địa chỉ để lấy; cần Ban Truyền Thông gửi danh sách |
| I6 | Logo | Mộc Ấn treo dưới header 194×144 | Mộc Ấn 140×104 treo dưới thanh header từ 1280px; dưới 1280px giữ ấn nhỏ trong thanh | [x] |

### 2.4 Kiểu chữ

| # | Chỗ | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| C1 | Tiêu đề mục, tiêu đề trang, khẩu hiệu | UTM Niagara 400, in hoa | UTM Niagara 400, in hoa | [x] |
| C2 | Tiêu đề phụ trong trang | UTM Classizism Antiqua, in hoa, giãn chữ | Noto Serif | [x] giữ Noto Serif (đủ dấu, đã tối ưu tải) |
| C3 | Chữ thường, menu, nút | UTM Avo | Be Vietnam Pro | [x] giữ Be Vietnam Pro (đã chốt) |
| C4 | Menu | in hoa, đậm, giãn 1.2px | in hoa, đậm, giãn 0.08em | [x] |
| C5 | Tiêu đề thẻ | in hoa, đậm, vàng | in hoa, đậm, vàng (thẻ bài, khu vực, tượng, giới thiệu) | [x] |
| C6 | Dòng dẫn trên tiêu đề | in hoa, giãn 3px hoặc nghiêng | in hoa, giãn 0.22em, không khung | [x] |

### 2.5 Cỡ chữ

| # | Chỗ | Web cũ 1440 / 375 | Web mới 1440 / 375 | Trạng thái |
|---|---|---|---|---|
| K1 | Khẩu hiệu hero | 128 / ~56px | 128 / 64px | [x] |
| K2 | Tiêu đề mục | 72 / 36px | 72 / 44px | [x] |
| K3 | Tiêu đề trang trong | 72 / 36px | 72 / 44px | [x] |
| K4 | Thân bài viết | 18px, giãn dòng 36px | 18–20px, giãn dòng 1.8 | [x] |
| K5 | Chữ thường | 14 / 12px | 17–18px | [x] cố ý to hơn |
| K6 | Menu | 12px | 14px in hoa | [x] |
| K7 | Tiêu đề thẻ | 15–20px | 20–24px | [x] |
| K8 | Chữ nhỏ nhất | 10px | 14px | [x] cố ý to hơn |

## 3. Việc cần làm, theo thứ tự

### Đợt A – Nền tảng phong cách (áp cho mọi trang)

- [x] A1. Bảng màu phụ của web cũ thành biến: amber `#E5A93C`, vàng sáng `#FFDE59`, chữ phụ `#C9B896`, chữ mờ `#A69383` (M6–M8). Kiểm: axe không lỗi tương phản.
- [x] A2. Dòng dẫn trên tiêu đề (`.sub-title`): bỏ khung nét đứt, in hoa, giãn chữ, màu amber (C6, M6).
- [x] A3. Tiêu đề mục có icon vàng phía trên và đường kẻ hai bên khi canh giữa (I1).
- [x] A4. Nút chính dải vàng, nút phụ viên thuốc nâu viền vàng (M10, M11). Kiểm: tương phản chữ nút ≥ 4.5:1, cao ≥ 48px.
- [x] A5. Thẻ: viền vàng mờ, hover sáng hơn, bo 14px (M9, N5).
- [x] A6. Header: nền tối mờ, viền dưới vàng, menu in hoa 14px giãn chữ (M12, C4, K6). Kiểm: một hàng ở 1024 / 1280 / 1440, không cắt chữ.
- [x] A7. Footer: dải nâu, viền trên vàng, tiêu đề cột in hoa vàng, tên chùa bằng UTM Niagara phía trên các cột, sóng vàng mờ ở chân (M13).
- [x] A8. Banner trang trong: tiêu đề 72 / 44px, đường kẻ hai bên, huy hiệu nhỏ trên tiêu đề, lớp phủ nâu tan vào nền trang, cao 104 + 96px đệm thay cho 133 + 150px (K3, N2).
- [x] A9. Tiêu đề thẻ in hoa đậm màu vàng ở thẻ bài, thẻ khu vực, thẻ tượng (C5).

**Điểm kiểm A:** [x] axe sạch trên các mẫu trang của `a11y.spec.ts`; test `theme`, `styleguide`, `header`, `footer` xanh ở cả máy tính và di động (máy chủ dev, 17/11).

Làm thêm ngoài dự kiến: tiêu đề phụ trong trang (`.tlhp-section-title`, `.tlhp-article-heading`) in hoa giãn chữ, có đường kẻ vàng chạy sang phải; nút tối của khối “Về chùa tu học” từng mất chữ, đã sửa; thẻ trang Liên hệ từng nền trắng chữ sáng, đã sửa.

### Đợt B – Ảnh

- [x] B1. Ảnh hỏng từ nguồn: thay bằng khung có ấn tròn của chùa, không hiện biểu tượng ảnh vỡ. Đã kiểm ở trang Giới thiệu và trang chủ (chân dung Sư Tổ): máy đo không còn ảnh vỡ.
- [x] B2. Ảnh dọc trong khung thẻ: thẻ bài, thẻ sự kiện, thẻ khu vực dùng khung ngang 3:2; ảnh dọc được cắt theo khung, lấy phần trên. Thẻ chân dung (Chư Tôn Đức, Bảo tượng) giữ khung dọc vì là ảnh người và tượng.
- [x] B3. Ảnh méo: ảnh nhỏ ở hero, ảnh đại diện tròn và ảnh khối Lời Thầy dạy từng bị bóp méo (20 chỗ), nay cắt theo khung. Máy đo không thấy ảnh nào tràn ra ngoài khung hay gây cuộn ngang.
- [x] B4. Giữ nguyên tối ưu ảnh: không đổi nguồn, cỡ hay cách tải ảnh. `image-sizes`, `image-budget` và `edge-cache` xanh trên bản build (17/11). Ảnh hỏng nguồn khi hiện ấn tròn vẫn giữ địa chỉ đã xin trong `data-tlhp-src`.
- [x] B5. Danh sách ảnh hỏng cho Ban Biên Tập: `docs/anh-hong-nguon.md`, 37 dòng có tên bài, ô dữ liệu và địa chỉ ảnh (chưa gửi; chờ chủ site cho biết gửi ai, qua kênh nào).

### Đợt C – Trang chủ

- [x] C1. Thứ tự khối: giữ Hero → 6 chuyên mục → Khóa tu sắp tới → Tin tức → Lời chào → Tông chỉ → Khu vực → Lộ trình → Lời Thầy dạy → Chư Tôn Đức. Dải 6 chuyên mục ngay dưới hero đóng vai các nút tắt của web cũ; khóa tu vẫn ở màn hình thứ hai.
- [x] C2. Lời chào trên điện thoại: video thành dải 16:9 phía trên, chữ rộng hết màn hình.
- [x] C3. Khu vực nổi bật trên điện thoại: không phải lỗi. Ảnh chưa kịp tải trên máy chủ dev (dev tải ảnh gốc, không thu nhỏ); trên `v2.` ảnh hiện dưới lớp chữ.
- [x] C4. Trang chủ ở 375px: 18.459px → 11.931px. Khóa tu, Tông chỉ, Lộ trình, Chư Tôn Đức thành hàng vuốt ngang; ba ô số liệu nằm một hàng. Ở 768px khối Lộ trình xếp 2×2.
- [x] C5. 6 chuyên mục khi tắt chuyển động: lưới 2 cột trên điện thoại, 3 cột trên tablet.

### Đợt D – Từng trang ở 375 / 768 / 1024 / 1440

- [x] D1. Dòng Chảy Hoằng Pháp (danh sách, bài viết): thẻ có huy hiệu; album bài viết hai cột trên điện thoại (trước là một cột, 12 ảnh dài 2.500px).
- [x] D2. Lịch tu học: đã xem ở 1440, 768, 375. Ngày âm lịch trong ô lịch là 12px (ô hẹp), giữ nguyên.
- [x] D3. Giới thiệu: nhóm chỉ có một bài nay là thẻ ngang (ảnh trái, chữ phải) từ 768px; đã xem ở 1440 và 375.
- [x] D4. Tông Chỉ Tu Học: đoạn mở đầu canh giữa trang, có chữ cái đầu lớn màu vàng như web cũ.
- [x] D5. Vũ Trụ Phật Giáo (bản đồ, khu vực): thẻ khu vực có huy hiệu, khung ảnh 3:2.
- [x] D6. Bảo Tượng Phật Giáo (danh sách, tượng): thẻ tượng có huy hiệu.
- [x] D7. Trí Tuệ Phật Pháp (danh sách, bài, Học tiếng Tạng): đã xem ở 1440 và 375.
- [x] D8. Liên hệ, Tìm kiếm, 404: đã xem ở 1440 và 375.

Tiêu chí chung mỗi trang: không cuộn ngang, không ảnh tràn hay méo, một `h1`, vùng chạm ≥ 24px (mức AA của WCAG 2.2; nút và menu ≥ 44px), chữ ≥ 14px.

Mỗi trang đã được máy đo ở cả bốn cỡ và xem ảnh chụp ở 375 và 1440; cỡ 768 đã xem ảnh trang chủ, Lịch, Bảo tượng, Vũ trụ; cỡ 1024 chỉ có số đo của máy.

### Đợt E – Kiểm tra và bàn giao

- [x] E1. `tsc --noEmit` sạch, lint 0 lỗi (72 cảnh báo có từ trước), 187 unit test xanh.
- [x] E2. E2E trên bản build (`npm run build`, cổng 4175, 17/11), cả máy tính và di động, trừ `visual`: 590 xanh, 1 đỏ, 59 bỏ qua theo thiết kế của bộ test. Test đỏ là test cỡ ảnh trang tượng ở bản di động: ảnh chân dung không tải kịp một lần nên hiện ấn tròn và test đọc phải địa chỉ ấn tròn; đã cho test đọc địa chỉ đã xin (`data-tlhp-src`), chạy lại 3 lần ở mỗi bản đều xanh. Test bộ lọc Bảo tượng và test phân trang Dòng Chảy (từng đỏ trên máy chủ dev) đều xanh trên bản build. Test `visual` chưa chạy (xem E3).
- [x] E2b. Ngân sách phông 200 KB: thêm UTM Niagara làm trang chủ tải 206 KB. Dòng khẩu hiệu ở footer là chỗ duy nhất dùng Noto Serif nghiêng và kéo theo 64,6 KB trên mọi trang; đổi sang chữ không chân nghiêng như web cũ. Trang chủ nay tải 141,3 KB phông.
- [x] E3. Chủ site duyệt giao diện ngày 17/11. Chụp lại 14 ảnh mẫu `visual.spec.ts` (7 trang × máy tính, di động) trên bản build cổng 4175; chạy lại lần hai 14/14 khớp. Ảnh mẫu nằm ngoài git theo `.gitignore`, chỉ có trên máy này.
- [x] E4. `BRAND-GUIDELINES.md` lên bản 1.1.0 (mục 0 mới, sửa mục 1.2, 3.3, 4.1); `tasks/plan.md`: thêm dòng quyết định của chủ dự án, viết lại quyết định 9, thêm dòng lịch sử số 11; `khao-sat/khao-sat-yeu-cau-v2.csv`: cập nhật TH-01 và TH-03. Bảng Google Sheets gốc chưa sửa; TH-03 vẫn ghi "Chờ xác nhận" cho phông nội dung Be Vietnam Pro.
- [x] E5. Đưa lên `v2.`: chủ site bảo ngày 17/11. Worker `tlhp-web` phiên bản `737859aa-9cc3-4b29-99f9-f61b018642ad` (9.800 KiB, nén 1.246 KiB, khởi động 2 ms). 11 trang chính trả 200, trang lạ trả 404, còn header noindex. 85 test (`theme`, `performance`, `home`, `bao-tuong`, cả máy tính và di động) chạy thẳng vào `v2.` đều xanh. Đường lùi: phiên bản trước `fce3f5db-7d60-4992-90b0-2287846e27a2` (giao diện sáng, deploy 13/11), đưa lại bằng `cf workers deployments create`. Lưu ý: deploy từ nhánh `chore/khoi-tao-du-an` sẽ đưa `v2.` về giao diện sáng cho tới khi nhánh này được gộp.

## 4. Kết quả máy đo (web mới, trước khi sửa)

21 mẫu trang × 4 cỡ màn hình (375, 768, 1024, 1440), tắt chuyển động, ngày 17/11/2026.

| Tiêu chí | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Trang bị cuộn ngang | 0 / 84 | 0 (đo lại 21 trang ở 768; trang chủ và Giới thiệu ở cả 4 cỡ) |
| Ảnh hiện biểu tượng vỡ | 5 ảnh nguồn 404, lặp trên 6 trang | 0 (thay bằng ấn tròn) |
| Ảnh bị bóp méo | 20 chỗ, đều ở trang chủ | 0 |
| Trang có hơn một `h1` | 0 | 0 |
| Chiều dài trang chủ ở 375px | 18.459px | 11.931px |
| Chiều dài trang chủ ở 1440px | 11.914px | 12.303px |

Ghi chú về phép đo: mục “ảnh tràn khung” báo ấn tròn ở footer trên mọi trang, đó là báo nhầm (ảnh nằm trong thẻ liên kết dạng dòng). Trang chủ còn 3–4 thẻ tin chưa có nguồn ảnh: đó là các slide chưa tới lượt, được gán ảnh khi trượt tới (tối ưu có từ T41).

## 5. Ảnh hỏng từ nguồn (gửi Ban Biên Tập)

37 trên 6.050 ảnh ngoài album trả 404 ngay tại nơi lưu, web cũ cũng vỡ ở các ảnh này:

- **Tông Chỉ Tu Học: 25 ảnh** (ảnh nền bài nổi bật, bìa sách nguồn, banner) trên máy chủ WordPress.
- **Dòng Chảy Hoằng Pháp: 8 ảnh** album của 6 bài năm 2022–2024.
- **Giới thiệu: 3 ảnh** (chân dung và album Sư Tổ Ngộ Chân Tử, một ảnh album Sư ông Thanh Lương).
- **Vũ Trụ Phật Giáo: 1 ảnh.**

Không ảnh nào trong 6.050 ảnh mang cờ xoay EXIF. 76 ảnh nặng trên 3 MB (lớn nhất 9,3 MB); web mới đã thu nhỏ qua Cloudflare nên người đọc không tải bản gốc.

## 6. Đề xuất thêm (cùng tuyến nội dung, chờ chủ site quyết)

- [x] P1. Menu còn 4 mục: Giới thiệu ▾ · Tin tức – Pháp thoại ▾ · Lịch tu học · Liên hệ. "Đăng ký khóa tu" chỉ còn là nút vàng ở header và trong menu điện thoại (17/11). Trí Tuệ Phật Pháp đã có trong "Tin tức – Pháp thoại" nên không thêm mục riêng.
- [?] P2. Mạng xã hội ở footer: đã dò web cũ ngày 17/11, 9 nút ở footer chỉ là hình, không gắn địa chỉ. Footer web mới đã sẵn chỗ (`site.social`), chỉ cần danh sách chính thức (GD-06).
- [x] P3. Logo Mộc Ấn treo dưới header như web cũ, từ 1280px trở lên (xem I6).
- [x] P4. 7 trang mẫu Bexon (`/contact`, `/blogs`, `/services`, `/team`, `/history`, `/our-gallery`, `/portfolios` và trang con) chuyển vào nhóm route `(mau-bexon)`: trả 404 trên `www`, noindex, vẫn mở được trên `v2.` để làm khuôn mẫu và cho bộ test (giống `/styleguide`). Không xóa mã vì `footer`, `motion-guard`, `styleguide` đang test trên các trang này.
- [x] P5. Thanh điều hướng chấm bên trái trang chủ của web cũ: không đưa sang vì che nội dung trên điện thoại (chốt 17/11).

## 7. Việc còn lại và skill sẽ dùng (tra ngày 17/11/2026)

Skill đã cài, lấy theo bảng trong `CLAUDE.md`:

| Việc còn lại | Skill đã cài |
|---|---|
| E3 chụp lại ảnh mẫu `visual.spec.ts` | `ecc:e2e-testing`, `superpowers:verification-before-completion` |
| E4 cập nhật `BRAND-GUIDELINES.md`, quyết định 9, bảng khảo sát | `agent-skills:documentation-and-adrs`, `ui-ux-pro-max:brand`, `xlsx` |
| I5, I6, P1–P5 (menu, mạng xã hội, logo treo, gỡ trang mẫu) | `agent-skills:frontend-ui-engineering`, `ui-ux-pro-max`, `web-design-guidelines` |
| Gộp nhánh `feat/chu-de-toi-web-cu` sau khi duyệt | `/code-review`, `superpowers:finishing-a-development-branch`, `agent-skills:git-workflow-and-versioning` |
| T1b kho GitHub và CI | `agent-skills:ci-cd-and-automation`, `ecc:github-ops` |
| T17b hai phòng đọc của Trí Tuệ | `agent-skills:spec-driven-development`, `agent-skills:frontend-ui-engineering` |
| T19 đọc thẳng từ B2 (chờ khóa chỉ đọc) | `workers-best-practices`, `wrangler` |
| T20 SEO trước ra mắt | `ecc:seo`, `web-perf` |
| T21 admin cũ sang `quantri.` sau Access | `cloudflare-one`, `cf-cli` |
| T41 phần còn lại, giới hạn CPU của Workers Free | `web-perf`, `workers-profiling`, `agent-skills:performance-optimization` |
| T22 kiểm thử và chuyển `www` | `agent-skills:shipping-and-launch`, `ecc:canary-watch`, `/security-review` |
| T23–T26 D1, lượt xem, đăng ký khóa tu | `cloudflare`, `ecc:database-migrations`, `agent-skills:test-driven-development`, `turnstile-spin` |
| T27–T38 trang quản trị mới | `cloudflare-one`, `agent-skills:security-and-hardening`, `agent-skills:api-and-interface-design`, `ecc:dashboard-builder` |
| T38b sao lưu, T39 chuyển hẳn sang D1 | `agent-skills:deprecation-and-migration`, `ecc:database-migrations` |
| T40 khối "Hỏi AI Hòa Phúc" | `claude-api`, `agents-sdk` |

Skill bên ngoài tìm bằng `skills find`, **chưa cài**, cần chủ site đồng ý và đọc nguồn trước khi dùng:

| Việc | Skill gợi ý | Lượt cài |
|---|---|---|
| T23–T24 schema D1 | `jezweb/claude-skills@d1-drizzle-schema` | 1,7K |
| T20 SEO | `coreyhaines31/marketingskills@seo-audit` | 256,8K |
| T31 trình soạn thảo bài viết | `jezweb/claude-skills@tiptap` | 478 |
| T1b CI | `callstackincubator/agent-skills@github-actions` | 12,4K |
| E3 ảnh mẫu | `codeatcode/oss-ai-skills@playwright-visual-regression` | 24 (ít người dùng, `ecc:e2e-testing` đã đủ) |

## 8. Rà bố cục, icon, menu và ảnh khu vực (17/11/2026, đợt 2)

Theo tám ảnh chụp chủ dự án gửi. Skill dùng: `ui-ux-pro-max` (tra luật "nhãn gọn không rớt một chữ xuống dòng"), `frontend-ui-engineering`.

| # | Việc | Kết quả |
|---|---|---|
| 1 | Dải 6 chuyên mục: chữ rớt một từ xuống dòng ("Vũ Trụ Phật / Giáo") | ✅ Hai dòng cân nhau (`text-wrap: balance`), thẻ có viền vàng mảnh |
| 2 | Nút về đầu trang: số % đen trên nền đen (1:1) | ✅ Số vàng, phần vòng chưa cuộn là vàng nhạt thay cho trắng |
| 3 | Lời Thầy dạy: tiêu đề và ô "11" đè lên chữ của áp phích tháng, áp phích bị cắt | ✅ Áp phích hiện nguyên (1200×1015), tiêu đề đưa lên trên khối, tháng và chủ đề là chú thích dưới áp phích; chấm chuyển câu không còn đè tên chủ đề |
| 4 | Menu sổ ra khi rê chuột | ✅ Mở dưới con trỏ, mở dần từ trên xuống, từng mục hiện nối nhau; rời chuột 0,18 giây thì đóng. Bàn phím, chạm và Esc như cũ; `aria-expanded` theo đúng trạng thái |
| 5 | Ảnh đại diện khu vực | ✅ Dùng bộ ảnh riêng từng khu của site cũ (`04-vu-tru-phat-giao/khu-vuc/`, 14 ảnh, đã kiểm cả 14 trả 200). Dữ liệu admin cũ chỉ có ảnh tạm: "toàn cảnh chùa" cho 5 khu, bìa sách cho Thư viện và Tứ Ân, `canh-1` cho 2 khu |
| 6 | Icon đặt sai mục | ✅ Xem bảng dưới |
| 7 | Hiệu ứng mượt | ✅ Mã không tắt hiệu ứng nào; ảnh chụp của chủ dự án cho thấy máy đang ở chế độ "giảm chuyển động" (dải chuyên mục đứng yên thành lưới), khi đó site tắt mọi hiệu ứng theo quyết định 02/11. Chủ dự án chọn "giữ hiệu ứng nhẹ" (17/11): ở chế độ đó khối hiện dần khi cuộn tới, menu sổ ra, nút và liên kết đổi màu êm; không có gì di chuyển (không cuộn mượt, không dải chạy, slider không tự chạy). Không thêm thư viện, không tải GSAP ở chế độ này: tốc độ tải không đổi |

**Icon, theo đúng tên trong `bo-nhan-dien/README_BO_NHAN_DIEN.md`** (`SectionMark.tsx` nay có kiểu `BrandIcon` liệt kê đủ bộ):

| Chỗ | Trước | Nay |
|---|---|---|
| Tiêu đề "Lộ trình tu học" | `tinh-do-nhan-gian` (hình đỏ, là mục bài viết) | `tong-chi-tu-hoc` (Lộ trình là một nhóm của Tông Chỉ; site cũ đánh dấu các thẻ này bằng icon đó) |
| Tiêu đề "Chư Tôn Đức" | `phap-am` (chuông pháp âm) | logo tròn (bộ icon không có hình cho mục này) |
| Tiêu đề "Lời Thầy dạy" | không có | `quote-chu-de` (đúng nghĩa: trích dẫn / chủ đề tháng) |
| Ba ô số liệu ở Lời chào | icon mẫu Bexon (dấu tích, quả địa cầu, biểu đồ) | `dong-chay-hoang-phap`, `tri-tue-phat-phap`, `lich-tu-hoc` theo đúng thứ được đếm |
| Năm nhóm Tông Chỉ | icon mẫu Bexon (`tji-service-1…5`) | `tong-chi-tu-hoc` |
| Menu: Lịch sử Bổn tự, Chư Tôn Đức, Thanh quy | `dau-an-hoang-phap`, `quote-chu-de`, `phap-am` | logo tròn cho Lịch sử; chấm vàng (như menu site cũ) cho hai mục không có icon riêng |

Chưa đổi: icon mục bài (`cong-tu`, `khoa-le-truyen-thong`, `dai-le-su-kien`) chưa hiện trên thẻ bài và thẻ lịch như site cũ; thanh điều hướng chấm dọc và thẻ có huy hiệu icon của site cũ (ảnh 7, 8) chưa làm, chờ chủ dự án xác nhận có cần không.

**Kiểm chứng:** 253 test đơn vị (thêm 3 test ảnh khu vực), eslint 0 lỗi, `tsc`, build sạch. e2e trên máy chủ dev: `header home vu-tru tong-chi` 124 qua; 5 hỏng đều là quá 30 giây khi duyệt hàng chục trang trên máy chủ dev (chạy riêng từng test với thời gian chờ dài thì cả ba test đó đều qua). `a11y motion-guard` máy tính 80/80. Test menu đổi: mở dưới chuột, mở bằng bàn phím. Chưa deploy.

**Tầng hiệu ứng nhẹ (thêm sau):** `motion-guard` đổi tên và nội dung: ở chế độ giảm chuyển động, mọi trang (24 trang × máy tính và điện thoại) không có gì đang di chuyển, không slider tự chạy, không cuộn mượt, và thứ đã vào màn hình thì hiện đủ; thêm test khối dưới màn hình hiện dần khi cuộn tới rồi trả lại như cũ, và test tắt JavaScript thì không khối nào bị ẩn. Máy tính 93 test (`motion-guard header`) và điện thoại 27 test đều qua; 253 test đơn vị, eslint 0 lỗi, build sạch.

**Deploy `v2.` 17/11/2026:** phiên bản Worker `ff01a8b0` (9.993 KiB, nén 1.289 KiB, khởi động 2 ms), deploy bằng `scripts/deploy-v2.mjs` (lần chạy đầu của lệnh mới, nguồn nội dung `d1`). Trên `v2.`: các trang chính 200, trang lạ 404; ở cả hai chế độ chuyển động menu mở dưới chuột, 7 tiêu đề khối mang đúng icon, 14 khu vực mang 14 ảnh riêng; ở chế độ giảm chuyển động có 53 khối chờ hiện dần và không có cuộn mượt. e2e `smoke seo header home vu-tru tong-chi motion-guard a11y`: 298 qua, 40 bỏ qua, 1 chập chờn có sẵn (không dịch bố cục khi tải). 3 hỏng ở lượt đầu: test axe trang chủ (2 khổ) đo chữ khi khối đang hiện dần giữa chừng, đã sửa test chờ hiện xong rồi mới đo, chạy lại 2/2 qua; `vu-tru:114` khổ điện thoại hỏng một lần khi chạy 4 luồng, chạy riêng thì qua. Bản trước để lùi: `a6e935fd`.

## 9. Thẻ sự kiện, thẻ bảo tượng, khung lịch (18/11/2026)

- **Thẻ bảo tượng và thẻ Chư Tôn Đức:** các thẻ cùng hàng cao khác nhau (530/530/530/555 px, 530/581 px) nên đáy khung lệch; nay mỗi hàng một chiều cao (555 hoặc 581 px, đo lại). Gốc: thẻ không giãn theo ô lưới.
- **Thẻ sự kiện:** ô nội dung có nền nâu đặc `#2c1c11` trên khung chuyển sắc xuống `#1e140c`, thấy rõ một hộp sáng hơn bên trong khung; nay nền trong suốt (cùng sửa cho mọi thẻ `blog-item` ở giao diện tối). Nút "Xem video" dồn xuống đáy thẻ để hai thẻ cùng hàng thẳng hàng.
- **Khung lịch** (đối chiếu ảnh chụp của chủ dự án): thêm khung thẻ viền vàng, thanh tháng có hai nút tròn trước/sau và nhãn "Tháng 11/2026", nhãn tháng âm lịch và Phật lịch, nút "Tháng này" khi đang xem tháng khác, và **Chú thích** (Cộng Tu, Khóa Lễ Truyền Thống, Đại Lễ Sự Kiện, nhãn đỏ mùng 1 và Rằm, ô hôm nay). Câu kệ tháng bị khung trích dẫn của Bexon bao (cao gấp đôi lịch); bỏ khung, hai cột nay cùng chiều cao.
- **Thumbnail:** các sự kiện 19/11 và 20/11 (và nhiều sự kiện khác) dùng chung áp phích chủ đề tháng, không phải ảnh riêng của sự kiện; đó là dữ liệu của admin cũ, không tự đoán được ảnh đúng. Cần Ban Biên Tập chọn ảnh riêng. Áp phích cắt 16:9 mất dòng chữ dưới, nên khó đọc là áp phích của tháng nào.
- **Chưa làm:** ngày vía Phật và Bồ Tát trên lịch (cần Ban Biên Tập xác nhận danh sách); `bao-tuong.spec.ts:56` hỏng ổn định trên máy chủ dev (bấm "Lọc" trước khi trang nạp xong, URL có tham số rỗng), không liên quan thay đổi này (qua trên `v2.`).
- **Phiên khác:** phiên "Agent Skills" đang sửa cùng kho (trang chi tiết sự kiện `lich-tu-hoc/[slug]`, `DayDialog`, `calendar.ts`, `MonthGrid`, `initSmoothScroller`). Không ghi đè; mã của hai bên cùng nằm trong `page.tsx` và `_calendar.scss`, `tsc`, 258 test đơn vị và lint vẫn sạch. Chưa commit để không gộp việc của phiên kia.

- **Ảnh đại diện sự kiện:** danh sách và cách gửi ảnh cho Ban Biên Tập ở `docs/anh-su-kien.md`.

- **Mục chưa có ảnh (18/11):** thẻ không có ảnh hiện logo tròn của chùa trên nền thẻ thay cho ô trống (`.tlhp-post-card-noimage`, `_blog.scss`): thẻ sự kiện, khóa lễ, bài, khu vực, tượng, Giới thiệu. Chưa deploy.
