# Graph Report - tung-lam-hoa-phuc  (2026-11-02)

## Corpus Check
- 7 files · ~30,144 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 274 nodes · 1011 edges · 8 communities
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 272 edges (avg confidence: 0.87)
- Token cost: 422,604 input · 0 output

## Community Hubs (Navigation)
- Trang quản trị & bảo mật admin
- Design system & khởi tạo ứng dụng
- Dữ liệu: snapshot JSON → D1
- Nhận diện, điều hướng & SEO
- Trang công khai theo Bexon Home-02
- Hạ tầng Cloudflare & kho ảnh
- Vấn đề UX, chữ & tốc độ
- Lịch tu học & luồng đăng ký

## God Nodes (most connected - your core abstractions)
1. `Kế hoạch triển khai: Dựng lại giao diện Tùng Lâm Hòa Phúc theo Bexon Home-02 × Design System TLHP` - 39 edges
2. `Zero Floating UI rule` - 26 edges
3. `T18: Schema D1 (Drizzle) và script nhập từ snapshot` - 25 edges
4. `Mô hình dữ liệu D1 đề xuất (thực thể chính)` - 24 edges
5. `Q: Vì sao Đánh giá trải nghiệm (UX Review) là cầu nối giữa cộng đồng Cloudflare với lịch, D1, tech stack và sơ đồ site?` - 24 edges
6. `Q: Vì sao Mô hình dữ liệu D1 đề xuất là cầu nối giữa cộng đồng D1 và sáu cộng đồng khác?` - 23 edges
7. `Ánh xạ Bexon Home-02 → trang chủ TLHP (12 khối + khối kết trang)` - 21 edges
8. `Đánh giá trải nghiệm (UX Review) & vấn đề ưu tiên` - 20 edges
9. `BRAND-GUIDELINES.md (TLHP brand identity & design tokens v1.0.0)` - 20 edges
10. `Phân hệ quản trị Next.js (/admin)` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Câu hỏi mở #9: Kho mã GitHub và tài khoản Cloudflare của chùa (HT-02); Workers thay Pages đã xác nhận chưa?` --semantically_similar_to--> `Việc còn mở cần trả lời (mã nguồn, host, WebP, bucket)`  [INFERRED] [semantically similar]
  tasks/plan.md → tunglamhoaphuc-cloudflare-migration.md
- `Dark 4-column footer` --semantically_similar_to--> `Footer site cũ (địa chỉ, mạng xã hội, giờ mở cửa, bảng liên hệ tel:)`  [INFERRED] [semantically similar]
  design-system/BRAND-GUIDELINES.md → dac-ta-ky-thuat-tunglamhoaphuc.md
- `Theme Đêm thiền (data-theme="dark" / .tlhp-dark)` --semantically_similar_to--> `Phong cách Luxury Spiritual / Dark Heritage`  [INFERRED] [semantically similar]
  design-system/BRAND-GUIDELINES.md → dac-ta-ky-thuat-tunglamhoaphuc.md
- `WCAG 2.1 contrast audit (117 pairs, 0 failures)` --semantically_similar_to--> `Đánh giá tương phản WCAG 2.1`  [INFERRED] [semantically similar]
  design-system/BRAND-GUIDELINES.md → dac-ta-ky-thuat-tunglamhoaphuc.md
- `Rủi ro: Nhiều quyết định thương hiệu chưa chốt (logo SVG, khẩu hiệu, font, menu)` --semantically_similar_to--> `Open decisions for Ban Trị Sự / Ban Truyền Thông`  [INFERRED] [semantically similar]
  tasks/plan.md → design-system/BRAND-GUIDELINES.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Ngăn xếp kiến trúc đích Cloudflare (Workers/OpenNext + R2 + D1 + Image Transformations + Access + ISR cache)** — tunglamhoaphuc_cloudflare_migration_cloudflare_workers, tunglamhoaphuc_cloudflare_migration_opennextjs_cloudflare, tunglamhoaphuc_cloudflare_migration_cloudflare_r2, tunglamhoaphuc_cloudflare_migration_cloudflare_d1, tunglamhoaphuc_cloudflare_migration_drizzle_orm, tunglamhoaphuc_cloudflare_migration_image_transformations, tunglamhoaphuc_cloudflare_migration_cloudflare_access, tunglamhoaphuc_cloudflare_migration_opennext_isr_cache [EXTRACTED 1.00]
- **Lộ trình chuyển đổi 4 giai đoạn (1,5–3 tuần)** — tunglamhoaphuc_cloudflare_migration_giai_doan_1_kho_anh_r2, tunglamhoaphuc_cloudflare_migration_giai_doan_2_du_lieu_d1, tunglamhoaphuc_cloudflare_migration_giai_doan_3_code_workers, tunglamhoaphuc_cloudflare_migration_giai_doan_4_chay_thu_dns [EXTRACTED 1.00]
- **Hệ thống nhận diện thương hiệu Tùng Lâm Hòa Phúc** — dac_ta_ky_thuat_tunglamhoaphuc_logo_moc_an, dac_ta_ky_thuat_tunglamhoaphuc_bang_mau_chuan, dac_ta_ky_thuat_tunglamhoaphuc_danh_gia_tuong_phan_wcag, dac_ta_ky_thuat_tunglamhoaphuc_typography_utm, dac_ta_ky_thuat_tunglamhoaphuc_phong_cach_dark_heritage, dac_ta_ky_thuat_tunglamhoaphuc_giong_van_nha_chua [EXTRACTED 1.00]
- **TLHP base color palettes built around the five anchors** — design_system_brand_guidelines_anchor_colors, design_system_brand_guidelines_palette_moc, design_system_brand_guidelines_palette_hoaisac, design_system_brand_guidelines_palette_chusa, design_system_brand_guidelines_palette_dong, design_system_brand_guidelines_palette_da, design_system_brand_guidelines_palette_nen [EXTRACTED 1.00]
- **TLHP logo system (Mộc Ấn, horizontal, seal, favicon)** — design_system_brand_guidelines_logo_moc_an, design_system_brand_guidelines_logo_ngang, design_system_brand_guidelines_an_tron, design_system_brand_guidelines_dau_hp_favicon [EXTRACTED 1.00]
- **Three-theme semantic color system (Ngà, Giấy dó, Đêm thiền)** — design_system_brand_guidelines_semantic_role_colors, design_system_brand_guidelines_theme_nga, design_system_brand_guidelines_theme_giay_do, design_system_brand_guidelines_theme_dem_thien [EXTRACTED 1.00]
- **Current-site UX problems answered by the TLHP design system** — dac_ta_ky_thuat_tunglamhoaphuc_popup_chao_mung, dac_ta_ky_thuat_tunglamhoaphuc_header_navigation, dac_ta_ky_thuat_tunglamhoaphuc_dang_ky_cong_tu, dac_ta_ky_thuat_tunglamhoaphuc_font_nang_thua, dac_ta_ky_thuat_tunglamhoaphuc_tinh_de_dung_nguoi_lon_tuoi, dac_ta_ky_thuat_tunglamhoaphuc_noi_dung_tai_phia_client, design_system_brand_guidelines_zero_floating_ui, design_system_brand_guidelines_header, design_system_brand_guidelines_registration_success_page, design_system_brand_guidelines_nextjs_integration, design_system_brand_guidelines_de_doc_nguoi_cao_tuoi, design_system_brand_guidelines_inline_alerts_forms [INFERRED 0.85]
- **Old site identity (dark heritage, gold, UTM) vs new TLHP identity (ngà, mộc, Noto Serif / Be Vietnam Pro)** — dac_ta_ky_thuat_tunglamhoaphuc_logo_moc_an, dac_ta_ky_thuat_tunglamhoaphuc_bang_mau_chuan, dac_ta_ky_thuat_tunglamhoaphuc_typography_utm, dac_ta_ky_thuat_tunglamhoaphuc_phong_cach_dark_heritage, dac_ta_ky_thuat_tunglamhoaphuc_giong_van_nha_chua, design_system_brand_guidelines_logo_moc_an, design_system_brand_guidelines_anchor_colors, design_system_brand_guidelines_noto_serif, design_system_brand_guidelines_be_vietnam_pro, design_system_brand_guidelines_visual_voice, design_system_brand_guidelines_buddhist_message_voice [INFERRED 0.85]
- **Đăng ký cộng tu / khóa tu flow: entry points, form rules, success page** — dac_ta_ky_thuat_tunglamhoaphuc_dang_ky_cong_tu, dac_ta_ky_thuat_tunglamhoaphuc_registration, dac_ta_ky_thuat_tunglamhoaphuc_quy_tac_kiem_tra_du_lieu, design_system_brand_guidelines_header, design_system_brand_guidelines_inline_alerts_forms, design_system_brand_guidelines_registration_success_page, design_system_brand_guidelines_event_card [INFERRED 0.85]
- **Lớp nội dung có đường nối: snapshot JSON → ContentRepository → D1** — tasks_plan_contentrepository, tasks_plan_snapshot_json, tasks_plan_bo_chuan_hoa_du_lieu, tasks_todo_t2_lop_noi_dung_snapshot_repository, tasks_todo_t18_schema_d1_import_snapshot, tasks_todo_t19_repository_d1_chuyen_nguon, tunglamhoaphuc_cloudflare_migration_cloudflare_d1, tunglamhoaphuc_cloudflare_migration_drizzle_orm [INFERRED 0.85]
- **Thực thi Zero Floating UI trên site và admin (test canh gác, không toast, không popup)** — design_system_brand_guidelines_zero_floating_ui, tasks_plan_test_canh_gac_zero_floating_ui, tasks_todo_t5_footer_404_test_canh_gac, tasks_plan_qd10_admin_dung_chung_token, tasks_todo_t21_dang_ky_khoa_tu, tasks_todo_t35_hoi_ai_hoa_phuc, dac_ta_ky_thuat_tunglamhoaphuc_popup_chao_mung [INFERRED 0.85]
- **Bảo mật admin mới: Cloudflare Access + JWT phía server + RBAC + AuditLog** — tasks_plan_qd9_admin_khong_login_access_jwt, tasks_todo_t22_khung_admin_access_rbac_nhat_ky, tunglamhoaphuc_cloudflare_migration_cloudflare_access, dac_ta_ky_thuat_tunglamhoaphuc_user_auditlog, dac_ta_ky_thuat_tunglamhoaphuc_phan_quyen_rbac, tasks_plan_ht_01_va_lo_hong_login, tasks_todo_checkpoint_f_admin_loi, tasks_plan_rui_ro_bao_mat_admin_moi [INFERRED 0.85]

## Communities (8 total, 0 thin omitted)

### Community 0 - "Trang quản trị & bảo mật admin"
Cohesion: 0.09
Nodes (40): Admin: Bảo Tượng Phật Giáo (/admin/bao-tuong), Admin: Danh Tăng & Tổ Sư (91 vị, chưa có trên site), Admin: Dòng Chảy Hoằng Pháp (/admin/posts), Admin: Giới Thiệu Tông Phong (/admin/gioi-thieu), Admin: Kho Ảnh S3 Cloud (Backblaze B2 – Ổ Z:), Admin: Tông Chỉ Tu Học (/admin/tong-chi), Admin: Trí Tuệ Phật Pháp (/admin/tri-tue-phat-phap), Admin: Vũ Trụ Phật Giáo (14 không gian, đa tự viện) (+32 more)

### Community 1 - "Design system & khởi tạo ứng dụng"
Cohesion: 0.11
Nodes (34): Bảng màu chuẩn (Vàng kim #F2C14E, nâu trầm, đỏ son), Hồ sơ đặc tả kỹ thuật – Cổng TTĐT Tùng Lâm Hòa Phúc, Next.js App Router + Turbopack + Tailwind CSS v4 + shadcn/ui + lucide-react, Thư viện thành phần (Component Library), BRAND-GUIDELINES.md (TLHP brand identity & design tokens v1.0.0), Five anchor colors (3 locked in Q1 + 2 from logo), Bexon React Home-02 layout reference, Pill button (CTA) component (+26 more)

### Community 2 - "Dữ liệu: snapshot JSON → D1"
Cohesion: 0.17
Nodes (30): Admin: Tổng Quan Dashboard (views-summary), Area (khu vực, tọa độ bản đồ 2D), Cấu trúc JSON thực tế từ API admin GET, Media / Album / AlbumItem (r2_key), Mô hình dữ liệu D1 đề xuất (thực thể chính), Monk (Danh Tăng & Tổ Sư – thực thể mới), Page (trang tĩnh/giới thiệu), PageView (lượt xem ghi gộp theo ngày) (+22 more)

### Community 3 - "Nhận diện, điều hướng & SEO"
Cohesion: 0.11
Nodes (30): Cổng thông tin điện tử tunglamhoaphuc.com, Footer site cũ (địa chỉ, mạng xã hội, giờ mở cửa, bảng liên hệ tel:), Giới thiệu (/gioi-thieu, mega-menu 6 thẻ), Header kính mờ & mega-menu điều hướng, Logo Mộc Ấn (khiên đỏ son viền vàng, monogram HP), Danh mục module quản trị cho bản dựng lại, Sơ đồ cây trang (Sitemap) site công khai, Ấn tròn circular monogram seal (+22 more)

### Community 4 - "Trang công khai theo Bexon Home-02"
Cohesion: 0.17
Nodes (31): Bảo Tượng Phật Giáo (126 tôn tượng, 15 cụm), Dify (nền tảng chatbot AI), Trợ lý AI 'Hỏi AI Hòa Phúc', Publication (Trí Tuệ Phật Pháp) + Series, Tông Chỉ Tu Học (~25 bài, 5 nhóm), Trí Tuệ Phật Pháp (~158 mục: sách, pháp âm, video), Vũ Trụ Phật Giáo (bản đồ 2D, 12 khu vực), Bexon Home-02 → TLHP value mapping (+23 more)

### Community 5 - "Hạ tầng Cloudflare & kho ảnh"
Cohesion: 0.15
Nodes (23): Câu hỏi mở #9: Kho mã GitHub và tài khoản Cloudflare của chùa (HT-02); Workers thay Pages đã xác nhận chưa?, Hàm mediaUrl() – điểm đổi URL ảnh duy nhất (B2 → R2 + Image Transformations), Checkpoint H: Hoàn tất – sẵn sàng chuyển DNS, Giai đoạn 5 – Hoàn thiện và chạy thử (T34–T37, Checkpoint H), T36: Hiệu năng và tiếp cận toàn site (Image Transformations, Lighthouse CI, axe), T37: Triển khai staging (staging.tunglamhoaphuc.com) và nghiệm thu, Chi phí ước tính ~$5–7/tháng, Cloudflare Images (không khuyến nghị) (+15 more)

### Community 6 - "Vấn đề UX, chữ & tốc độ"
Cohesion: 0.27
Nodes (7): Dòng Chảy Hoằng Pháp (~475 bài), Popup chào mừng (lưu localStorage), Typography UTM Niagara / UTM Avo / UTM ClassizismAntiqua, Be Vietnam Pro (body, UI, buttons, forms), Noto Serif (headings, scripture), Fluid type scale (clamp 375→1320px, display…label), Q: Vì sao Đánh giá trải nghiệm (UX Review) là cầu nối giữa cộng đồng Cloudflare với lịch, D1, tech stack và sơ đồ site?

### Community 7 - "Lịch tu học & luồng đăng ký"
Cohesion: 0.24
Nodes (13): Admin: Lịch Tu Học & Sự Kiện (/admin/lich-tu-hoc), CalendarEvent (lịch tu học, recurrence âm lịch), Đăng ký cộng tu (chưa có form), Lịch tu học Phật lịch 2570 (dương/âm lịch), Registration (đăng ký cộng tu), Cloudflare Turnstile (chống spam form), Inline alerts, forms & loading states, Registration success page /dang-ky/thanh-cong (Q15) (+5 more)

## Ambiguous Edges - Review These
- `Bucket B2 media-tunglamhoaphuc (site công khai đọc)` → `Bucket B2 tunglamhoaphuc2 (admin đọc)`  [AMBIGUOUS]
  tunglamhoaphuc-cloudflare-migration.md · relation: shares_data_with

## Knowledge Gaps
- **2 isolated node(s):** `Cloudflare Web Analytics (cookieless)`, `Câu hỏi mở #4: Trình soạn thảo và định dạng nội dung (QT-03)`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 6 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Kế hoạch triển khai: Dựng lại giao diện Tùng Lâm Hòa Phúc theo Bexon Home-02 × Design System TLHP` connect `Design system & khởi tạo ứng dụng` to `Trang quản trị & bảo mật admin`, `Dữ liệu: snapshot JSON → D1`, `Nhận diện, điều hướng & SEO`, `Trang công khai theo Bexon Home-02`, `Hạ tầng Cloudflare & kho ảnh`, `Vấn đề UX, chữ & tốc độ`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Kế hoạch triển khai: Dựng lại giao diện Tùng Lâm Hòa Phúc theo Bexon Home-02 × Design System TLHP` (e.g. with `Header kính mờ & mega-menu điều hướng` and `Phong cách Luxury Spiritual / Dark Heritage`) actually correct?**
  _`Kế hoạch triển khai: Dựng lại giao diện Tùng Lâm Hòa Phúc theo Bexon Home-02 × Design System TLHP` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cloudflare Web Analytics (cookieless)`, `Câu hỏi mở #4: Trình soạn thảo và định dạng nội dung (QT-03)` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trang quản trị & bảo mật admin` be split into smaller, more focused modules?**
  _Cohesion score 0.09071117561683599 - nodes in this community are weakly interconnected._
- **Why does `Zero Floating UI rule` connect `Trang công khai theo Bexon Home-02` to `Trang quản trị & bảo mật admin`, `Design system & khởi tạo ứng dụng`, `Nhận diện, điều hướng & SEO`, `Vấn đề UX, chữ & tốc độ`, `Lịch tu học & luồng đăng ký`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `Zero Floating UI rule` (e.g. with `Sticky header navigation` and `Principle: Nhịp chậm (slow, guiding motion only)`) actually correct?**
  _`Zero Floating UI rule` has 11 INFERRED edges - model-reasoned connections that need verification._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Bucket B2 media-tunglamhoaphuc (site công khai đọc)` and `Bucket B2 tunglamhoaphuc2 (admin đọc)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._