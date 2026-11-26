# AGENT_SYNC — phiên đang chỉnh sửa song song

| Phiên | Nhánh | Thư mục | Phạm vi sở hữu (chỉ phiên này sửa) |
|---|---|---|---|
| Soạn thảo & tối ưu admin (23/11/2026) | `feat/admin-editor-optimization` (từ `origin/main` 8a9d15c) | `E:\tlhp-editor` | `src/components/admin/content/RichEditor.tsx`, `editorExtensions.ts`, `src/admin/content/html.ts`, `src/components/admin/content/*`, `src/admin/media/*`, `src/admin/rbac/*`, `src/app/quan-tri/**`, `tests/**/admin/**`, `package.json` (thêm extension TipTap) |
| Giao diện công khai (checkout chính) | `feat/admin-cms` (có việc dở chưa commit) | `E:\tung-lam-hoa-phuc` | `src/app/(site)`, `src/app/(home)`, SCSS, fonts, `PostArticle.tsx`, e2e công khai |

Quy tắc: không đụng tệp của hàng kia; không merge vào `main` khi chưa `git fetch` và chưa kiểm xung đột; không migration/deploy D1/Worker thật khi chưa được chủ dự án đồng ý.
