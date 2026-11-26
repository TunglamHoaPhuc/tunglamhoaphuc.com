# Chuyển V3 làm trang chính và dời admin sang `quantri.` (trình tự chạy)

> Lập 23/11/2026, theo bản rà soát `docs/chuyen-v3-lam-site-chinh.md` của repo V3 (`E:\tlhp-v3-doc`, nhánh `fix/v3-doc`; mục 5 là kế hoạch admin, mục 6 là rủi ro Cloudflare, mục 8 là danh sách việc) và bản kiểm kê tài khoản [kiem-ke-cloudflare-23-11-2026.md](kiem-ke-cloudflare-23-11-2026.md). Thay [chuyen-www.md](chuyen-www.md) (lần chuyển 20/11 từ Vercel sang `tlhp-web`).
> **Tài liệu này chưa chạy lần nào.** Mọi lệnh `cf` bên dưới viết ra để chủ dự án duyệt; người soạn không chạy lệnh nào trên Cloudflare. Mục đánh dấu ⚠️ là suy luận chưa ai thử: diễn tập trên `thu.tunglamhoaphuc.com` trước (mục 2).
> Quy tắc của repo (`CLAUDE.md`): không deploy, không đổi Cloudflare, không đổi gói cước khi chủ dự án chưa đồng ý **từng lần**; deploy từ worktree sạch; không in giá trị bí mật.

## 0. Hai giai đoạn, và vì sao tách

| Giai đoạn | Việc | Đảo ngược được? | Khi nào |
|---|---|---|---|
| **1. Dời admin** | `tlhp-web` thêm host `quantri.tunglamhoaphuc.com`, deploy với `ADMIN_BASE_URL=https://quantri…`. `www` vẫn là `tlhp-web` (Bexon), nên khách không thấy gì | Có: deploy lại với `ADMIN_BASE_URL=https://www…`; mất công duy nhất là mọi người đăng nhập lại | Trước ngày chuyển, ít nhất vài ngày, để người biên tập quen |
| **2. V3 làm trang chính** | Gỡ `www` và tên miền gốc khỏi `tlhp-web`, gắn vào `tlhp-v3`; Redirect Rule gốc → www; xóa cache | Có, trong khoảng 14 ngày (mục 6), vì `tlhp-web` và `v2.` còn nguyên | Ngoài giờ lễ, sau khi V3 xong các hạng mục chặn (V3 doc mục 0, bảng B1–B9) |

Không gộp hai giai đoạn: nếu chuyển `www` mà admin chưa dời thì người biên tập mất admin (V3 trả 404 cho `/quan-tri` và `/api/quan-tri`).

## 1. Hiện trạng cần biết (đọc 23/11/2026, kiểm lại trước khi chạy)

| | |
|---|---|
| Tài khoản, zone | `b91a395bd9b7ab86ef4cba41d1d828ae`; zone `tunglamhoaphuc.com` id `411520190ae6e5f3fcb524cacdf9bc91` (gói Free); hồ sơ `cf` là `tlhp` |
| Worker | `tlhp-web` (repo này; domain `v2.`, `www.`, gốc) và `tlhp-v3` (domain `v3.`). Mã phiên bản đang chạy: lấy lại bằng lệnh ở 2.2 ngay trước khi chuyển (ghi hôm nay: `tlhp-web` `edd6b3a4`, V3 `175a956a`; `d1.md` mục 7 ghi `ac9b547c` cho www) |
| DNS | `www`, `v2`, `v3`, gốc: AAAA `100::` proxied, **do Custom Domain của Worker tạo và quản**, không sửa tay. Wildcard `*` proxied; `admin.`, `old.` là WordPress ngoài, **giữ nguyên** |
| Cloudflare | Không có Redirect Rule, WAF tùy chỉnh, Cache Rule nào của zone; `ssl=full`, `always_use_https=off`. Không có route Worker nào nhìn thấy được qua `cf`: phải xem ở Dashboard (2.3) |
| Access | `www/admin`, `www/login`, `www/van-hanh` đang bị ứng dụng Access "Admin site cũ" chặn; `quantri.` chưa có gì (403 do wildcard) |

## 2. Trước khi chạy (đánh dấu từng mục)

Mã và tài liệu:

- [ ] Nhánh `feat/admin-quantri` (liên kết tuyệt đối ra `https://www…`, chuyển hướng trên host `quantri.`, kiểm `deploy:v2`) đã vào nhánh deploy của `tlhp-web`; `npx vitest run` và `npx tsc --noEmit -p .` xanh.
- [ ] V3 xong các hạng mục chặn: robots/sitemap/canonical, `/lien-he`, tiêu đề bảo mật, giới hạn tần suất 4 API Tạng, bỏ thanh tìm kiếm AI giả, `/api/memorials`, chuyển `/quan-tri[/…]` → `https://quantri…/quan-tri/…` (V3 doc mục 8.1, các mục 1–12). Ban Trị Sự đã duyệt V3 (điều kiện 4 của [chuyen-www.md](chuyen-www.md)).
- [ ] Người biên tập được báo trước: địa chỉ admin mới; đăng nhập lại ở host mới (cookie `__Host-` theo host, bản ghi cũ ở `www` vô hại); bản xem trước nháp vẫn kiểu cũ (thanh đầu trang nói rõ); bài hiện trên web chậm 30–75 giây ([admin-architecture.md](../admin-architecture.md) mục 6.5); **không bấm "quên mật khẩu" trong lúc dời** (thư gửi trước đó mang địa chỉ cũ, vô hiệu).

Cloudflare (chỉ đọc, an toàn chạy bất cứ lúc nào):

### 2.1 Xuất DNS

```powershell
npx cf dns records export --zone tunglamhoaphuc.com --profile tlhp > docs/van-hanh/dns-truoc-khi-chuyen-v3-2026-MM-DD.zone
```
Giữ bản xuất ngoài git nếu có nghi ngại; bản 20/11 là `dns-truoc-khi-chuyen-www-2026-11-20.zone`.

### 2.2 Ghi phiên bản Worker để lùi

```powershell
npx cf workers deployments list --worker tlhp-web --profile tlhp
npx cf workers deployments list --worker tlhp-v3  --profile tlhp
```
Ghi **số hiệu phiên bản đang chạy 100%** của cả hai vào mục 7 của [d1.md](d1.md) trước khi làm gì tiếp.

### 2.3 Route của zone (Dashboard, `cf` không liệt kê được)

Workers & Pages → Settings của từng Worker → Domains & Routes; và Websites → `tunglamhoaphuc.com` → Workers Routes. Cần thấy: không còn route `www.tunglamhoaphuc.com/api/*` của `tlhp-admin-guard` (nếu còn, nó chặn mọi POST công khai của V3 bằng 403: gỡ). Ghi lại những gì thấy.

### 2.4 Diễn tập trên tên phụ

Làm cả hai giai đoạn trên `thu.tunglamhoaphuc.com` (gắn cho một Worker thử, chuyển sang Worker khác, đo khoảng trống giữa gỡ và gắn, thử Redirect Rule, thử purge). Chưa diễn tập thì mọi ⚠️ vẫn là giả thuyết.

## 3. Giai đoạn 1: dời admin sang `quantri.` (đảo ngược được)

Worktree sạch của nhánh deploy, ví dụ `E:\tlhp-av3`. Hồ sơ `tlhp` chỉ gắn với `E:\tlhp-x`, nên gắn tạm cho worktree (xem [d1.md](d1.md) mục 7):

```powershell
npx cf auth activate tlhp E:\tlhp-av3
```

1. Sửa `cloudflare.config.ts`, dòng `domains`, thêm `quantri.`: `["quantri.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]`. Commit.
2. Deploy, **giữ cả hai biến** (`npm run deploy:v2` dừng nếu thiếu `ADMIN_BASE_URL` hoặc nó không phải https):

```powershell
$env:TLHP_ADMIN="1"; $env:ADMIN_BASE_URL="https://quantri.tunglamhoaphuc.com"; npm run deploy:v2
```
3. Kiểm (mong đợi trong ngoặc; `curl.exe` vì PowerShell có bí danh `curl`):

```powershell
curl.exe -sI https://quantri.tunglamhoaphuc.com/quan-tri/dang-nhap          # 200; có Content-Security-Policy, X-Frame-Options: DENY
curl.exe -sI https://quantri.tunglamhoaphuc.com/                            # 307, Location: /quan-tri
curl.exe -sI https://quantri.tunglamhoaphuc.com/gioi-thieu                  # 308, Location: https://www.tunglamhoaphuc.com/gioi-thieu
curl.exe -s -o NUL -w "%{http_code}`n" https://quantri.tunglamhoaphuc.com/api/quan-tri/v1/auth/me   # 401 (có admin, chưa đăng nhập)
curl.exe -s -o NUL -w "%{http_code}`n" https://www.tunglamhoaphuc.com/api/quan-tri/v1/auth/me       # 404 (sai host: admin chỉ trả lời ở ADMIN_BASE_URL)
curl.exe -sI https://quantri.tunglamhoaphuc.com/robots.txt                  # 200 và Disallow: / (không phải host công khai)
```
Rồi bằng trình duyệt ở `https://quantri.tunglamhoaphuc.com`: đăng nhập (mọi người phải đăng nhập lại), mở một bài nháp, bấm **Xem trước** (thanh đầu trang có câu "Trang thật có thể trông khác…"; ảnh hiện), bấm **Xem trên trang ↗** của một bài đã xuất bản (mở `https://www.tunglamhoaphuc.com/…`, không phải `quantri.`), mở thư viện ảnh. Bấm "quên mật khẩu" một lần bằng tài khoản thử và xem liên kết trong thư mang `quantri.`.
4. Gỡ liên kết hồ sơ: `npx cf auth deactivate E:\tlhp-av3`.
5. Báo người biên tập địa chỉ mới. Ứng dụng Access "Admin site cũ" (www `/admin`, `/login`, `/van-hanh`) chưa gỡ ở bước này.

*Tùy chọn, chủ quyết định:* thêm ứng dụng Access cho `quantri.tunglamhoaphuc.com` dùng chính sách sẵn có "Quản trị TLHP – email được phép" làm cửa thứ hai. Access chặn người không có trong chính sách, và nếu phủ cả `/api/quan-tri/*` thì trình duyệt nhận trang đăng nhập Access thay JSON; chỉ bật nếu đã thử.

**Lùi giai đoạn 1:** deploy lại đúng lệnh trên với `ADMIN_BASE_URL=https://www.tunglamhoaphuc.com` (và nếu muốn, gỡ `quantri.` khỏi `domains`). Mọi người đăng nhập lại ở `www`.

## 4. Giai đoạn 2: V3 làm trang chính

Chỉ khi giai đoạn 1 đã chạy ổn vài ngày, mục 2 đã đánh dấu hết, chủ dự án đồng ý. Ngoài giờ lễ (tránh sáng sớm và trước ngày lễ lớn). Chuẩn bị sẵn hai cửa sổ dòng lệnh: một ở `E:\tlhp-av3` (`tlhp-web`), một ở `E:\tlhp-v3-doc` (`tlhp-v3`), cả hai đã `npx cf auth activate tlhp <thư mục>`.

### 4.1 Redirect Rule: tên miền gốc → `www`, giữ chuỗi truy vấn (làm trước, vô hại)

Luật trong app (`next.config.js`) làm mất `?q=…` (đo: `tunglamhoaphuc.com/tim-kiem?q=a` ra `www…/tim-kiem`), nên đặt luật ở rìa Cloudflare, chạy trước Worker. Tạo tệp `redirect-goc.json` (ngoài git):

```json
[
  {
    "action": "redirect",
    "description": "Ten mien goc ve www, giu chuoi truy van",
    "expression": "(http.host eq \"tunglamhoaphuc.com\")",
    "action_parameters": {
      "from_value": {
        "status_code": 301,
        "preserve_query_string": true,
        "target_url": { "expression": "concat(\"https://www.tunglamhoaphuc.com\", http.request.uri.path)" }
      }
    }
  }
]
```
```powershell
# kiểm trước, không ghi gì:
npx cf rulesets entrypoint update http_request_dynamic_redirect --zone tunglamhoaphuc.com --profile tlhp --rules @redirect-goc.json --dry-run
# ghi thật (⚠️ phase này chưa có ruleset nào ở zone: xem --help nếu cần `create` thay `update`):
npx cf rulesets entrypoint update http_request_dynamic_redirect --zone tunglamhoaphuc.com --profile tlhp --rules @redirect-goc.json
curl.exe -sI "https://tunglamhoaphuc.com/tim-kiem?q=niem+phat"    # 301, Location: https://www.tunglamhoaphuc.com/tim-kiem?q=niem+phat
```
Luật chỉ chạm tên miền gốc nên chạy được ngay cả khi `www` còn là `tlhp-web`. Nó chỉ chạy nếu gốc còn là bản ghi DNS **proxied**: ở 4.3 gốc được gắn cho V3, nên còn.

### 4.2 Chốt trạng thái để lùi

Đã làm ở 2.1 và 2.2; chạy lại 2.2 nếu có deploy nào xen giữa, và xác nhận V3 đang chạy bản đã đo (sitemap V3 so sitemap www: mọi địa chỉ trả 200 hoặc chuyển hướng có chủ ý; V3 doc mục 8.1.12).

### 4.3 Đổi chủ của `www` và tên miền gốc (hai lệnh liền nhau)

Custom Domain chỉ thuộc một Worker và Cloudflare có thể từ chối gắn khi tên còn ở Worker kia ⚠️, nên gỡ trước rồi gắn. **Giữa hai lệnh có khoảng trống** (vài chục giây đến vài phút, đo ở buổi diễn tập): khách thấy lỗi Cloudflare (522 hoặc 1xxx). Chạy lệnh thứ hai ngay khi lệnh thứ nhất xong.

1. `tlhp-web` (`E:\tlhp-av3`): sửa `domains` thành `["quantri.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com"]`, commit, deploy **với hai biến**:

```powershell
$env:TLHP_ADMIN="1"; $env:ADMIN_BASE_URL="https://quantri.tunglamhoaphuc.com"; npm run deploy:v2
```
2. **Ngay sau đó**, `tlhp-v3` (`E:\tlhp-v3-doc`): `domains` = `["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "v3.tunglamhoaphuc.com"]`, deploy:

```powershell
npm run deploy
```
3. Nếu bước 2 bị từ chối vì tên chưa nhả: chờ ít phút rồi lặp lại; xem nút chuyển tên ở Dashboard (Workers → `tlhp-v3` → Domains & Routes) ⚠️. Nếu quá 10 phút còn lỗi, **lùi** (mục 6).

### 4.4 Xóa cache cả vùng

Trang do `tlhp-web` dựng có thể còn trong Workers Cache tới 5 phút (cộng stale-while-revalidate).

```powershell
npx cf cache purge --zone tunglamhoaphuc.com --profile tlhp --body '{"purge_everything":true}'
```
Kiểm `CF-Cache-Status` và nội dung (giao diện V3 hay Bexon) bằng `curl.exe -sI` rồi `curl.exe -s … | findstr`. Ảnh `/anh-goc/*` và `/cdn-cgi/image/*` không đổi (cùng R2), bị xóa cache cũng chỉ dựng lại; các tệp `_next/static` của hai bản build có tên băm khác nhau nên không đụng nhau.

### 4.5 Kiểm trong 5 phút

```bash
for p in / /gioi-thieu /dong-chay-hoang-phap /lich-tu-hoc/le-quy-y-tam-bao-thang-9-binh-ngo /lien-he /sitemap.xml /robots.txt /favicon.ico /manifest.webmanifest; do
  echo "$p $(curl -sS -o /dev/null -w '%{http_code}' https://www.tunglamhoaphuc.com$p)"; done                     # đều 200
curl -sI https://www.tunglamhoaphuc.com/ | grep -iE "x-robots|strict-transport|x-frame|cross-origin"             # không có X-Robots-Tag; có HSTS
curl -s  https://www.tunglamhoaphuc.com/ | grep -o '<meta name="robots"[^>]*>'                                   # không có
curl -s  https://www.tunglamhoaphuc.com/ | grep -o '<link rel="canonical"[^>]*>'                                 # có
curl -sI "https://tunglamhoaphuc.com/tim-kiem?q=niem+phat"                                                        # 301 tới www, giữ ?q=
curl -sI https://v3.tunglamhoaphuc.com/ | grep -i x-robots                                                        # noindex, nofollow
curl -sI https://v2.tunglamhoaphuc.com/ | grep -i x-robots                                                        # noindex, nofollow (tlhp-web)
curl -sI https://www.tunglamhoaphuc.com/quan-tri/dang-nhap | grep -i location                                     # tới quantri. (luật của V3)
curl -s -X POST -H 'content-type: application/json' -d '{}' -o /dev/null -w '%{http_code}\n' https://www.tunglamhoaphuc.com/api/analyze   # 400 (không phải 403)
curl -sI https://quantri.tunglamhoaphuc.com/quan-tri/dang-nhap | head -1                                           # 200: admin vẫn sống
curl -sI https://quantri.tunglamhoaphuc.com/gioi-thieu | grep -i location                                         # 308 tới www/gioi-thieu
```
Quét toàn bộ sitemap (cùng cách đã dùng ở phụ lục A của V3 doc): mọi địa chỉ 200, 5xx dưới 0,1%. Bằng điện thoại: trang chủ, một bài, Lịch tu học, Liên hệ, `hoc-tieng-tang`. **Admin:** đăng nhập ở `quantri.`, xuất bản một bài thử (rồi đưa về nháp), xác nhận nó hiện ở `www` trong ≤ 75 giây.

### 4.6 Theo dõi 24 và 48 giờ

- Workers Logs của `tlhp-v3` (`npx cf o11y telemetry query … --profile tlhp`): `exceededCpu`, 5xx, lỗi D1. V3 từng trả 503 ngẫu nhiên khi bị quét song song (V3 doc mục 7.3): nếu thấy, cân nhắc lùi.
- Cloudflare Analytics: tỷ lệ 404 không tăng so với trước chuyển.
- Search Console: gửi lại `https://www.tunglamhoaphuc.com/sitemap.xml`; Rich Results Test cho một bài và một sự kiện; "Page indexing" và "Crawl stats" sau 48 giờ.
- PageSpeed mobile `/` và một bài (mục tiêu ≥ 93).

## 5. Việc nhỏ còn lại sau chuyển

- Ứng dụng Access "Admin site cũ" và `Beta site cũ`, `tlhp-admin-guard`, DNS `beta`: dọn theo [kiem-ke-cloudflare-23-11-2026.md](kiem-ke-cloudflare-23-11-2026.md) mục 11, **hỏi chủ từng thứ**.
- Luật chuyển `/admin`, `/login`, `/van-hanh` và gốc → `www` trong `next.config.js` của `tlhp-web` để nguyên (chỉ có tác dụng với host `www`, `tunglamhoaphuc.com`, mà Worker này không còn phục vụ); không thêm tính năng công khai mới ở repo này.
- `v2.` (noindex) giữ tới hết cửa sổ lùi (mục 6), rồi mới gỡ khỏi `domains`.

## 6. Quay lại

Cửa sổ lùi: **14 ngày** sau ngày chuyển; trong thời gian đó giữ `tlhp-web` đủ route công khai và `v2.` còn chạy. Lùi khi: tỷ lệ 5xx của V3 tăng rõ, trang chính không mở được, hoặc Ban Trị Sự yêu cầu. D1 và R2 không bị đụng nên **không cần Time Travel**.

*Lùi trang công khai (admin giữ nguyên ở `quantri.`):*

1. `tlhp-v3`: gỡ `www` và gốc khỏi `domains` (còn `["v3.tunglamhoaphuc.com"]`), `npm run deploy`.
2. **Ngay sau đó**, `tlhp-web`: `domains` = `["quantri.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]`, deploy bằng đúng lệnh ở 4.3.1 (`ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com`; **không** đổi về `www`).
3. Xóa cache cả vùng (4.4).
4. Kiểm: `/` hiện giao diện Bexon, `/lien-he` 200, `/sitemap.xml` 200, không có `X-Robots-Tag` ở `www`, `https://quantri.tunglamhoaphuc.com/quan-tri/dang-nhap` vẫn đăng nhập được, `https://quantri.tunglamhoaphuc.com/gioi-thieu` vẫn chuyển 308 sang `www` (nay `www` là `tlhp-web`, trang vẫn mở).
5. Nếu 1–2 không giải quyết (tên kẹt ở Worker kia): khôi phục DNS từ bản xuất ở 2.1 (`cf dns records import`, xem `--help` ⚠️) rồi gắn lại bằng Dashboard.
6. Ghi nguyên nhân vào [d1.md](d1.md) mục 7.

*Lùi mã của admin* (không phải DNS): deploy lại phiên bản `tlhp-web` đã ghi ở 2.2 (không có migration trong đợt này).

*Lùi cả admin về `www`* (chỉ khi `quantri.` hỏng và `www` đang là `tlhp-web`): deploy `tlhp-web` với `ADMIN_BASE_URL=https://www.tunglamhoaphuc.com`; mọi người đăng nhập lại.

## 7. Điều biết trước, chưa làm bằng mã

- Bài xuất bản hiện ở `www` sau **30–75 giây**: xóa cache của admin chỉ tác động tới `tlhp-web`. Phương án sau (route `POST /api/revalidate` ở V3 ký HMAC, admin gọi trong `waitUntil`) nằm ở V3 doc mục 5.3; cần thử trước khi hứa "tức thì".
- Bản xem trước nháp vẫn dùng giao diện Bexon của `tlhp-web` (thanh đầu trang nói rõ trang thật có thể khác).
- Mã đọc nội dung của V3 là bản chép của www: đổi schema hay trình đọc D1 ở repo này thì phải chép lại sang V3 (V3 doc mục 5.4).
- Số lượt chuyển hướng ("hits") của trang Chuyển hướng admin ngừng tăng: V3 đọc bảng nhưng không đếm.
