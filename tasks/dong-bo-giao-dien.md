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
| M8 | Ngày tháng, số liệu phụ | `#A69383` | có biến `--tlhp-faint`, chưa gắn vào từng chỗ | [~] |
| M9 | Viền thẻ | vàng `#F2C14E` 20–30%, hover 50–60% | vàng 22%, hover 55% có quầng sáng | [x] |
| M10 | Nút chính | dải vàng `#F2C14E → #E5A93C`, chữ nâu đen | dải vàng `#F2C14E → #E5A93C`, chữ nâu đen | [x] |
| M11 | Nút phụ | viên thuốc nâu `#4A3728 → #3D2B1F`, viền vàng | viên thuốc nâu `#4A3728 → #3D2B1F`, viền vàng | [x] |
| M12 | Header | `rgba(26,15,8,.95 → .82)`, mờ nền 14px, viền dưới vàng 28% | cùng nền, mờ nền và viền vàng; giữ dạng thanh bo góc của Bexon | [x] |
| M13 | Footer | dải `#3D2B1F → #2A1D14`, sóng vàng | dải `#3D2B1F → #2A1D14`, viền trên vàng; chưa có sóng vàng | [~] |
| M14 | Đỏ sơn son (Chủ nhật, nhãn) | đỏ tươi trên nền tối | `#D97A66` (đạt 4.5:1) | [x] |

### 2.2 Hình nền

| # | Chỗ | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| N1 | Hero trang chủ | video YouTube tự chạy, tắt tiếng, phủ tối | ảnh toàn cảnh chùa, slider | [x] giữ ảnh (video nặng, đã chốt ở T10) |
| N2 | Banner trang trong | ảnh bài mới nhất mờ 30%, hòa màu, phủ dải nâu | ảnh nền nhúng CSS, phủ tối | [ ] chưa chỉnh lớp phủ |
| N3 | Nền mục trang chủ | ảnh mờ + dải `#1A120B` trên, dưới | nền phẳng xen kẽ | [ ] chưa làm (cần ảnh nền cho từng mục) |
| N4 | Họa tiết sen | `lotus-pattern.png` mờ 3% | `pattern-2/3.webp` | [x] dùng họa tiết sẵn có |
| N5 | Thẻ | dải nâu đậm từ trên xuống | dải `#2C1C11 → #1E140C` | [x] |

### 2.3 Icon

| # | Chỗ | Web cũ | Web mới | Trạng thái |
|---|---|---|---|---|
| I1 | Trên tiêu đề mục | icon vàng 80px (tin mới, dấu ấn, lịch, khu vực, bảo tượng) | icon vàng 72 / 56px trên 6 khối trang chủ | [x] |
| I2 | Huy hiệu tròn giữa ảnh và chữ của thẻ | có | không có | [ ] chưa làm |
| I3 | Loại sự kiện trong lịch | cộng tu, khóa lễ, đại lễ | có | [x] |
| I4 | Menu | không icon | icon vàng trong menu thả | [x] giữ (dễ nhận hơn) |
| I5 | Mạng xã hội ở footer | 6 nút (Facebook ×2, nhóm ×2, Instagram, TikTok, YouTube, web) | chưa có (chờ GD-06) | [?] |
| I6 | Logo | Mộc Ấn treo dưới header 194×144 | Mộc Ấn nhỏ trong thanh header | [?] |

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
- [~] A7. Footer: dải nâu, viền trên vàng, tiêu đề cột in hoa vàng đã xong; tên chùa bằng UTM Niagara và sóng vàng chưa làm (M13).
- [~] A8. Banner trang trong: tiêu đề 72 / 44px và đường kẻ hai bên đã xong; lớp phủ kiểu web cũ chưa làm (K3, N2).
- [x] A9. Tiêu đề thẻ in hoa đậm màu vàng ở thẻ bài, thẻ khu vực, thẻ tượng (C5).

**Điểm kiểm A:** [x] axe sạch trên các mẫu trang của `a11y.spec.ts`; test `theme`, `styleguide`, `header`, `footer` xanh ở cả máy tính và di động (máy chủ dev, 17/11).

Làm thêm ngoài dự kiến: tiêu đề phụ trong trang (`.tlhp-section-title`, `.tlhp-article-heading`) in hoa giãn chữ, có đường kẻ vàng chạy sang phải; nút tối của khối “Về chùa tu học” từng mất chữ, đã sửa; thẻ trang Liên hệ từng nền trắng chữ sáng, đã sửa.

### Đợt B – Ảnh

- [x] B1. Ảnh hỏng từ nguồn: thay bằng khung có ấn tròn của chùa, không hiện biểu tượng ảnh vỡ. Đã kiểm ở trang Giới thiệu và trang chủ (chân dung Sư Tổ): máy đo không còn ảnh vỡ.
- [x] B2. Ảnh dọc trong khung thẻ: thẻ bài, thẻ sự kiện, thẻ khu vực dùng khung ngang 3:2; ảnh dọc được cắt theo khung, lấy phần trên. Thẻ chân dung (Chư Tôn Đức, Bảo tượng) giữ khung dọc vì là ảnh người và tượng.
- [x] B3. Ảnh méo: ảnh nhỏ ở hero, ảnh đại diện tròn và ảnh khối Lời Thầy dạy từng bị bóp méo (20 chỗ), nay cắt theo khung. Máy đo không thấy ảnh nào tràn ra ngoài khung hay gây cuộn ngang.
- [~] B4. Giữ nguyên tối ưu ảnh: không đổi nguồn, cỡ hay cách tải ảnh; `image-sizes` xanh. `image-budget` cần bản build, chưa chạy.
- [x] B5. Danh sách ảnh hỏng cho Ban Biên Tập ở mục 5 (chưa gửi).

### Đợt C – Trang chủ

- [x] C1. Thứ tự khối: giữ Hero → 6 chuyên mục → Khóa tu sắp tới → Tin tức → Lời chào → Tông chỉ → Khu vực → Lộ trình → Lời Thầy dạy → Chư Tôn Đức. Dải 6 chuyên mục ngay dưới hero đóng vai các nút tắt của web cũ; khóa tu vẫn ở màn hình thứ hai.
- [x] C2. Lời chào trên điện thoại: video thành dải 16:9 phía trên, chữ rộng hết màn hình.
- [x] C3. Khu vực nổi bật trên điện thoại: không phải lỗi. Ảnh chưa kịp tải trên máy chủ dev (dev tải ảnh gốc, không thu nhỏ); trên `v2.` ảnh hiện dưới lớp chữ.
- [x] C4. Trang chủ ở 375px: 18.459px → 11.931px. Khóa tu, Tông chỉ, Lộ trình, Chư Tôn Đức thành hàng vuốt ngang; ba ô số liệu nằm một hàng. Ở 768px khối Lộ trình xếp 2×2.
- [x] C5. 6 chuyên mục khi tắt chuyển động: lưới 2 cột trên điện thoại, 3 cột trên tablet.

### Đợt D – Từng trang ở 375 / 768 / 1024 / 1440

- [~] D1. Dòng Chảy Hoằng Pháp (danh sách, bài viết): đạt tiêu chí máy đo; đã xem ảnh ở 1440 và 768.
- [~] D2. Lịch tu học: đạt tiêu chí máy đo; đã xem ở 1440, 768, 375. Ngày âm lịch trong ô lịch là 12px (ô hẹp), giữ nguyên.
- [x] D3. Giới thiệu: nhóm chỉ có một bài nay là thẻ ngang (ảnh trái, chữ phải) từ 768px; đã xem ở 1440 và 375.
- [~] D4. Tông Chỉ Tu Học: đạt tiêu chí máy đo; đoạn mở đầu ở 1440 vẫn lệch trái, còn nửa phải trống.
- [~] D5. Vũ Trụ Phật Giáo: đạt tiêu chí máy đo; đã xem ở 1440 và 768.
- [~] D6. Bảo Tượng Phật Giáo: đạt tiêu chí máy đo; đã xem ở 1440 và 768.
- [~] D7. Trí Tuệ Phật Pháp: đạt tiêu chí máy đo; chưa xem ảnh từng trang.
- [~] D8. Liên hệ, Tìm kiếm, 404: đạt tiêu chí máy đo; Liên hệ đã sửa tương phản; chưa xem ảnh Tìm kiếm và 404.

Tiêu chí chung mỗi trang: không cuộn ngang, không ảnh tràn hay méo, một `h1`, vùng chạm ≥ 24px (mức AA của WCAG 2.2; nút và menu ≥ 44px), chữ ≥ 14px.

`[~]` ở đợt này nghĩa là máy đo đạt nhưng chưa rà bằng mắt đủ cả bốn cỡ màn hình.

### Đợt E – Kiểm tra và bàn giao

- [x] E1. `tsc --noEmit` sạch, lint 0 lỗi (72 cảnh báo có từ trước), 187 unit test xanh.
- [~] E2. E2E trên máy chủ dev, máy tính: 284 xanh, 1 đỏ (bộ lọc Bảo tượng bấm trước khi trang kịp chạy JavaScript trên dev; thử tay chạy đúng). Di động: 257 xanh, 1 đỏ (cùng test bộ lọc Bảo tượng), 31 bỏ qua theo thiết kế của bộ test. Chưa chạy trên bản build; các test `visual`, `performance`, `edge-cache`, `image-budget` và hai test dò mọi liên kết chưa chạy.
- [ ] E3. Chụp lại ảnh mẫu `visual.spec.ts` (chỉ khi chủ site duyệt giao diện)
- [ ] E4. Cập nhật `BRAND-GUIDELINES.md`, quyết định 9 trong `tasks/plan.md`, bảng khảo sát (Q1, TH-03)
- [ ] E5. Đưa lên `v2.` (chỉ khi chủ site bảo)

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

- [?] P1. Menu: bỏ mục "Đăng ký khóa tu" trong menu vì đã có nút cùng tên ở góc phải; thay bằng "Trí Tuệ Phật Pháp" hoặc để 4 mục.
- [?] P2. Mạng xã hội ở footer: web cũ có 8 liên kết, web mới đang chờ danh sách chính thức (GD-06).
- [?] P3. Logo Mộc Ấn treo dưới header như web cũ.
- [?] P4. Gỡ 7 trang mẫu Bexon còn mở công khai (`/contact`, `/blogs`, `/services`, `/team`, `/history`, `/our-gallery`, `/portfolios`).
- [?] P5. Thanh điều hướng chấm bên trái trang chủ của web cũ: không đưa sang vì che nội dung trên điện thoại.
