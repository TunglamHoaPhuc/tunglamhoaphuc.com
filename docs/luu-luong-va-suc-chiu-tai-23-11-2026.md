# Lưu lượng truy cập và sức chịu tải của gói Cloudflare hiện tại (23/11/2026)

> Phân tích chỉ đọc: không đổi, deploy, purge hay ghi gì lên Cloudflare hay trên site; không đổi gói cước; không in bí mật. Dữ liệu lấy bằng `cf ... --profile tlhp` (telemetry Workers, `cf d1 insights`, `cf sql query` trên `events.d1Queries`, `cf zones ... get`, `cf bot-management get`), cộng 7 yêu cầu `GET/HEAD` vào site công khai (UA `tlhp-capacity-audit-readonly/1.0`) và tài liệu chính thức lấy bằng `cf docs search` và `curl` tới `developers.cloudflare.com`.
> Phạm vi: Worker `tlhp-v3` (đang là `www`, `tunglamhoaphuc.com`, `v3.`), Worker `tlhp-web` (admin ở `quantri.`, trước 23/11 05:38 UTC là `www`, còn `v2.`), D1 `tlhp-db`, R2 `tlhp-media`, zone Free, tài khoản Workers Paid (5 USD/tháng).
> Liên quan: [kiem-ke-cloudflare-23-11-2026.md](../../tlhp-av3/docs/van-hanh/kiem-ke-cloudflare-23-11-2026.md) (bản kiểm kê tài khoản, nằm ở repo `E:\tlhp-av3`), [chuyen-v3-lam-site-chinh.md](chuyen-v3-lam-site-chinh.md).

**Nhãn nguồn dùng trong tài liệu:** **[đo]** = đọc trực tiếp từ Cloudflare hoặc từ site; **[TL]** = lấy từ tài liệu chính thức (đọc ngày 23/11/2026); **[ước]** = tính suy ra, ghi rõ giả định. Thời gian ghi UTC, kèm giờ Việt Nam (UTC+7) khi cần.

---

## 0. Tóm tắt

1. **Có những đợt tăng vọt, nhưng không có đợt nào do khách thật.** Trong 7 ngày Workers Logs còn giữ (16/11 đến 23/11) có ba đợt đáng kể: (a) **20/11 08:56 UTC (15:56 VN), 5.927 yêu cầu/phút (khoảng 99 yêu cầu/giây)**, từ một máy quét lỗ hổng bên ngoài (UA `TLM-Audit-Scanner/2.0`, máy chủ ở Hà Lan, dò `/.env`, `/.git-credentials`…), gấp khoảng 270 lần mức trung bình theo phút của ngày đó (31.584 sự kiện/1.440 phút ≈ 22/phút), không gây lỗi 5xx; (b) 17/11 07:39 UTC, 1.707 sự kiện/phút, do chính các phiên kiểm thử của dự án (IP FPT, Chrome 156 và `tlhp-check-urls`); (c) 23/11 04:52 UTC, 1.503 sự kiện/phút trên V3 và 6.574 truy vấn D1 trong một phút, do lượt quét 829 URL của agent. Ngoài ra có **một đợt bò liên tục của Bytespider (TikTok) vào lịch tu học**, khoảng 300 yêu cầu/giờ suốt cả ngày 22/11 (6.451 yêu cầu, 18% mọi sự kiện của ngày), đã bị V3 vô hiệu (chỉ còn là chuyển hướng 307).
2. **Lưu lượng thật rất nhỏ**: ngày 22/11 (ngày đầy đủ cuối cùng www còn chạy trên `tlhp-web`) có khoảng **23.300 yêu cầu vào cả hai Worker**, trong đó **ít nhất 52% là bot/crawler**, khoảng 18% là các phiên kiểm thử của chính dự án; người dùng Việt Nam thật chỉ là khoảng 107 địa chỉ IP khác nhau trong 2 ngày (21 đến 22/11).
3. **Gói hiện tại gánh được các đợt tăng về mặt tiền, nhưng chưa gánh tốt về mặt cấu hình.** Với 90% truy cập trúng bộ nhớ đệm, 200 lần mức trung bình vẫn chỉ ước khoảng **297 USD/tháng nếu giữ nguyên mã, và ước khoảng 97 USD/tháng nếu sửa hai việc rẻ** (mục 5). Nếu giữ nguyên cấu hình hôm nay (TTL bộ đệm 30 đến 60 giây, tỷ lệ trượt đo được **khoảng 90%**), 200 lần là khoảng 1.000 USD/tháng (mục 4.2).
4. **Thứ chạm trước tiên không phải là hạn mức của gói mà là độ ổn định**: lượt quét 829 URL chưa có trong bộ đệm với 8 luồng song song làm V3 trả **503 ở 10 trên 829 yêu cầu (1,2%)** (nguyên nhân chưa xác định, sự kiện `exception` không có thông điệp, CPU chỉ 4 đến 21 ms). Trong các hạn mức của gói, thứ chạm đầu tiên theo thứ tự lưu lượng tăng là: ảnh biến đổi miễn phí 5.000/tháng (không phụ thuộc lưu lượng, rơi về ảnh gốc 7 đến 9 MB khi hết), rồi **D1 25 tỷ dòng đọc/tháng ở khoảng 10 lần mức hôm nay**, **ghi nhật ký Workers ở khoảng 8 lần (từ 1/12)**, **10 triệu yêu cầu Workers ở khoảng 14 lần**.
5. **Hai sửa rẻ nhất, hiệu quả nhất**: (i) câu truy vấn `galleries()` dùng `LIKE ?` nên quét cả bảng 21.102 dòng mỗi lần nạp lại: **một câu duy nhất chiếm 85,3% mọi dòng D1 đã đọc** (239,98 trên 281,33 triệu); đổi sang khoảng `>= 'page:' AND < 'page;'` còn đọc cỡ 30 dòng; (ii) nhật ký Workers đang ghi 100% mọi yêu cầu: từ 1/12 tính theo GB, hạ `head_sampling_rate` xuống 0,1 giảm khoảng 90% chi phí đó.

---

## 1. Phạm vi dữ liệu và cách đọc

- **Telemetry Workers** (`cf o11y telemetry query`, bộ dữ liệu `cloudflare-workers`): giữ 7 ngày (gói Paid [TL]), dữ liệu thật bắt đầu 16/11 00:00 UTC và kết thúc lúc đọc, 23/11 09:34 UTC. Mỗi yêu cầu vào site cho **hai loại sự kiện** [đo]:
  - *ngoài* (outer): Worker nhận yêu cầu của khách (CPU trung bình 11 ms [đo]);
  - *trong* (inner): bộ vinext gọi lại chính Worker qua lối vào `VinextCachedResponse`, có `?__vinext_cache_key=` trong URL: **chỉ chạy khi bộ nhớ đệm Workers không có sẵn** (trượt hoặc làm mới nền), nên số sự kiện *trong* chính là số lần dựng lại trang. Kiểm chứng bằng 2 lần `GET /` của tôi lúc 09:49 UTC: sinh ra 2 sự kiện ngoài (CPU 12 và 22 ms) và 2 sự kiện trong (HTML 174 ms CPU / 1.131 ms treo, RSC 278 ms CPU / 1.259 ms), trả `X-Vinext-Cache: UPDATING`, `Age: 81`.
  - Số "yêu cầu ngoài" dưới đây = tổng sự kiện trừ sự kiện có `__vinext_cache_key` **[đo, tính hiệu]**. Đếm không chia nhóm là chính xác (hệ số lấy mẫu 1,0001); các truy vấn chia nhóm trên cửa sổ dài bị lấy mẫu ×10 (ghi `si 10`), nên chỉ dùng cho tỷ lệ.
- **Không phải mọi yêu cầu có mặt ở đây**: tệp tĩnh (`/_next/static`, `/images`, `/brand`, `/fonts`) và ảnh biến đổi `/cdn-cgi/image/...` được trả ở rìa trước Worker, **không hiện trong telemetry**. Chỉ lần Cloudflare lấy ảnh nguồn qua `/anh-goc/...` mới thấy (header `Via: 1.1 image-resizing-proxy`). Phía zone (lượt xem trang, bộ nhớ đệm, băng thông) đọc ở mục 7.
- **D1**: `cf d1 insights databases` (số liệu cùng nguồn tính tiền D1 [TL]) và `cf sql query` trên `events.d1Queries` (có lấy mẫu, SUM/COUNT đã được hệ thống quy đổi).

---

## 2. (A) Có đợt tăng đột biến nào không?

### 2.1 Sự kiện Worker mỗi ngày

| Ngày (UTC) | `tlhp-web` sự kiện | `tlhp-web` yêu cầu ngoài | CPU tổng `tlhp-web` (ms) | `tlhp-v3` sự kiện | `tlhp-v3` yêu cầu ngoài | CPU tổng `tlhp-v3` (ms) |
|---|---:|---:|---:|---:|---:|---:|
| 16/11 | 620 | 295 | 23.095 | 0 | 0 | 0 |
| 17/11 | 34.113 | 19.639 | 868.137 | 0 | 0 | 0 |
| 18/11 | 8.971 | 5.051 | 195.740 | 0 | 0 | 0 |
| 19/11 | 1.731 | 812 | 58.940 | 0 | 0 | 0 |
| 20/11 | 31.584 | 17.599 | 912.193 | 0 | 0 | 0 |
| 21/11 | 32.166 | 16.207 | 1.072.173 | 0 | 0 | 0 |
| 22/11 | 35.900 | 18.738 | 1.276.830 | 8.373 | 4.581 | 149.269 |
| 23/11 (đến 09:34) | 13.188 | 6.235 | 415.279 | 16.099 | 8.008 | 492.173 |
| **8 ngày** | **158.273** (gần khớp 152.178 của bản kiểm kê, đo sớm hơn vài giờ) | **84.576** | **4.822.387** | **24.472** | **12.589** | **641.442** |

[đo] telemetry. Cột "yêu cầu ngoài" là tính hiệu. `tlhp-web` theo host (8 ngày, lấy mẫu): `www` 95.570, `v2` 49.620, gốc `tunglamhoaphuc.com` 12.000, `quantri` 860.

**Mốc chuyển site chính** [đo]: sự kiện host `www` xuất hiện ở `tlhp-v3` lần đầu lúc **23/11 05:38 UTC (12:38 VN)** và ở `tlhp-web` dừng cùng phút đó (minute 05:38 là phút cuối: 576 sự kiện). Vì vậy dữ liệu "V3 làm www" mới có khoảng 4 giờ và phần lớn là các lượt kiểm tra của chúng ta (2.544 trên 3.752 yêu cầu ngoài là `curl`); dữ liệu về lưu lượng thật của www đến từ `tlhp-web` các ngày trước.

### 2.2 Các đỉnh

| # | Thời điểm UTC (giờ VN) | Worker | Quy mô | Ai | Phân loại |
|---|---|---|---|---|---|
| 1 | **20/11 08:56 và 08:57** (15:56, 15:57) | `tlhp-web` (host `www`, gốc) | **5.927 và 4.134 sự kiện/phút** (≈ 99 và 69/giây); UA này riêng 4.747 + 4.056 = 8.803 yêu cầu trong 2 phút (các UA khác, như `tlhp-check-urls`, góp phần còn lại); cả giờ 08:00 UTC: 13.340 sự kiện (8.172 ngoài) | UA `TLM-Audit-Scanner/2.0`, ASN `TECHOFF SRV LIMITED` (Hà Lan, 5.909 sự kiện), đường dẫn thăm dò `/config/laravel.log`, `/core/.env`, `/.git-credentials`, `/s3/bucket`, `/healthz`… Mã trả về của UA này (cả 8 ngày, chỉ xuất hiện trong đợt này): 404 5.040, 308 3.000, 200 chỉ 10, hủy 560; trong đợt: 8.331 ok, 472 bị hủy; **CPU trung vị 4 ms, p99 134, tối đa 356; không có 5xx**. UA này **không có trong cả hai repo** | Máy quét lỗ hổng bên ngoài (không phải của dự án). Đúng ngày chuyển www sang `tlhp-web` |
| 2 | **17/11 07:00 đến 08:00** (14:00 đến 15:00), đỉnh phút **07:39 = 1.707 sự kiện** | `tlhp-web` (host `v2`) | 14.009 sự kiện/giờ (8.790 ngoài); 8.779 từ `FPT Telecom Company` (VN) | Chrome 156 trên Windows (6.907), Pixel 7 giả lập (4.150), `tlhp-check-urls` (2.419, tập lệnh `scripts/check-urls.ts` của repo `tlhp-av3`) | Kiểm thử của chính dự án (từ IP nhà mạng FPT) |
| 3 | 18/11 01:00 đến 02:00 | `tlhp-web` | 4.711 sự kiện (2.851 ngoài) | FPT Telecom 2.848: cùng bộ Chrome 156 và Pixel 7 | Kiểm thử của chính dự án |
| 4 | 21/11 15:00 đến 16:00 (22:00) | `tlhp-web` | 4.134 sự kiện; `AhrefsSiteAudit/6.1` 1.276 (≈ 21 yêu cầu/phút), `ClaudeBot` 102 | Ahrefs (Mỹ), Anthropic | Công cụ kiểm tra site của bên thứ ba (hoặc ai đó dùng Ahrefs để quét site) |
| 5 | **23/11 04:00 đến 07:00** (11:00 đến 14:00), đỉnh phút **04:52 = 1.503 sự kiện**; D1 đỉnh **6.574 truy vấn/phút** (04:52) | `tlhp-v3` (+ `tlhp-web` 6.247 trong giờ 04) | V3 6.217 sự kiện trong giờ 04:00; D1 giờ 04:00: 35.729 truy vấn, 18,0 triệu dòng | `curl/8.22.0` (2.140 sự kiện ở `tlhp-web` giờ 04, cả 9.711 ở V3 trong 8 ngày), `tlhp-url-parity-check` (3.095): các lượt quét 829 URL của agent, 8 luồng | Kiểm thử của chính dự án; **đây là lúc 503 xuất hiện** (mục 4.4) |
| 6 | **22/11, cả ngày** (đều từ 02:00 UTC) | `tlhp-web` (host `www`) | **Bytespider ≈ 300 yêu cầu/giờ**, 6.451 yêu cầu trong ngày (18% mọi sự kiện), ASN Amazon Singapore | UA `Bytespider` (ByteDance), vào `/lich-tu-hoc?loai=…&thang=2007-06 … 2061-05`: tháng chạy từ 2007 đến 2061 nên mỗi URL là một lần trượt bộ đệm; trả 200 6.442, CPU trung vị 30 ms (p99 237), ≈ 4,2 truy vấn D1 mỗi lần dựng | Bẫy vô hạn (lịch tháng): bot bò mãi. Trên V3 giờ chỉ là 307 → `/#lich-tu-hoc` (đo trực tiếp 23/11 ≈ 10:00 UTC: `307 Location: /#lich-tu-hoc`) |

[đo] telemetry, truy vấn D1. **Kết luận (A): trong 7 ngày giữ được log, không có đợt tăng vọt nào do khách tự nhiên (không có bài lan truyền, không có ngày lễ).** Đợt lớn nhất (2) là máy quét; các đợt khác là kiểm thử của chúng ta. Không biết các ngày trước 16/11 (đã quá hạn giữ 7 ngày), và không biết lưu lượng ở phía zone (mục 7).

### 2.3 Cơ cấu lưu lượng (ngày 22/11, `tlhp-web`) [đo]

| Mục | Số liệu |
|---|---|
| Tổng sự kiện / yêu cầu ngoài / địa chỉ IP khác nhau | 35.900 / 18.738 / 1.721 (IP đếm trên mọi sự kiện) |
| Mã trạng thái (sự kiện, làm tròn do lấy mẫu) | 200: 27.126 · 404: 5.376 · 308: 3.242 · 0 (khách hủy): 70 · 401: 27 · 304: 26 · 503: 24 · 405: 4 · 500: 2 |
| Quốc gia | VN 6.022 · US 5.501 · SG 3.476 · DE 690 · TW 534 · HK 402 |
| Hãng mạng | FPT Telecom 4.010 · Amazon SG 3.209 · Amazon IE 1.919 · Google 1.812 · VNPT 1.657 · Anthropic 1.305 |
| Bot đã xác minh (`verifiedBotCategory`, sự kiện) | AI Crawler 1.852 · SEO 681 · Công cụ tìm kiếm 409 · Xem trước trang 384 · AI Search 29 |
| UA nổi bật | Chrome 157 Windows 8.829 (của chúng ta) · Bytespider 6.447 · CogBot 3.020 · ClaudeBot 2.608 · Lighthouse 875 · facebookexternalhit 820 · GoogleOther-Image 639 |
| Đường dẫn nhiều nhất | `/lich-tu-hoc` 10.785 (bẫy Bytespider và ClaudeBot) · `/` 1.762 · `/dong-chay-hoang-phap` 593 · `/robots.txt` 540 · `/lien-he` 393 · `/quan-tri/lich-tu-hoc/moi` 378 |
| Số đường dẫn khác nhau / một ngày | 3.527 (phần lớn là bài, tông chỉ, `thang=…`) |

**Phân loại 34.445 yêu cầu ngoài của 21 và 22/11 theo UA** [đo, phân loại theo mẫu UA]: bot/crawler **17.800 (52%)**; trình duyệt Chrome 156/157 Windows của chính ta, Lighthouse, `curl`, `tlhp-*`: 6.162 (**18%**); còn lại 10.483 (**30%**) gồm người thật và các bộ cào dùng UA Chrome 131 chung chung. Khách Việt Nam thật khá ít: yêu cầu ngoài từ IP Việt Nam trong 2 ngày là 7.926 nhưng chỉ từ **107 IP khác nhau**; trong đó UA di động (điện thoại) 1.166 yêu cầu từ 40 IP. **Ước: người thật chỉ vài chục lượt truy cập mỗi ngày.**

### 2.4 Sức khỏe: mã lỗi, ngoại lệ, độ trễ [đo]

| | `tlhp-web` (8 ngày) | `tlhp-v3` (22/11 đến 23/11) |
|---|---|---|
| ok / hủy / ngoại lệ | 157.640 / 1.330 / 2 thật (truy vấn nhóm lấy mẫu ×10 cho ra 20; đếm thẳng sự kiện được 2) | 24.335 / 46 / 22 |
| 200 / 404 / 308 / 307 | 118.008 / 24.966 / 12.735 / 97 | 21.155 / 2.144 / 323 / 453 |
| 503 + 500 | 31 + 3 | 24 + 0 |
| CPU (ms) trung vị / p90 / p99 / tối đa / trung bình | 18 / 97 / 199 / 1.935 / 36 (22/11) | 12 / 65 / 204 / 557 / 26,5 |
| Thời gian treo (ms) trung vị / p90 / p99 / tối đa | 383 / 1.200 / 3.130 / 7.368 | 296 / 890 / 2.382 / 10.087 |
| Sự kiện *trong* (dựng trang): CPU trung bình / p99 | 62 ms / 233 ms | 44 ms / 262 ms |

**Cả 22 ngoại lệ của V3 và 22 trong 24 lần 503 rơi vào hai lượt quét của agent** (23/11 04:52 đến 04:59 và 05:41 đến 05:42 UTC); 2 lần 503 còn lại (CPU 0 đến 1 ms, trả ngay) lúc 22/11 14:54 và 23/11 02:23, đều của `curl`. Trên `tlhp-web`, 2 ngoại lệ thật cũng nằm trong lượt quét 23/11 04:57 đến 04:58. Các sự kiện ngoại lệ có thông điệp rỗng, CPU 4 đến 21 ms, thời gian treo 4 đến 25 ms: không phải vượt giới hạn CPU. **Nguyên nhân chưa xác định** từ log (xem mục 8).

---

## 3. Hiện trạng tài nguyên đã đo

### 3.1 Workers: CPU và yêu cầu

- Chi phí trung bình mỗi yêu cầu ngoài ≈ **11 ms CPU**; mỗi lần dựng lại trang ≈ **56 ms CPU trung bình** (tính từ 1.426.099 ms CPU của cả hai Worker ngày 22/11 trừ phần ngoài, chia cho 20.954 sự kiện trong) [đo, tính].
- **Trang chủ nặng nhất**: một lần làm mới trang chủ tốn **174 ms (HTML) + 278 ms (RSC) ≈ 452 ms CPU** (mẫu đo của tôi 09:49 UTC, 1 mẫu) [đo].
- **CPU tháng** ở nhịp 22/11 ≈ 1,43 triệu ms/ngày ≈ **42,8 triệu ms/tháng** (so với 30 triệu bao gồm [TL]) [ước] → vượt khoảng 12,8 triệu ms ≈ **0,26 USD**.
- **Bộ nhớ đệm Workers**: phản hồi gửi cho trình duyệt là `Cache-Control: private, max-age=0, must-revalidate` (đo trên trang chủ). TTL thật của bộ nhớ đệm phía Cloudflare là `revalidate` của từng trang (**30 hoặc 60 giây**, ghi trong mã: `page.tsx` trang chủ 60, `dong-chay-hoang-phap/[slug]` 30, `gioi-thieu/[slug]` 30, `tong-chi-tu-hoc/[slug]` 30, `bao-tuong/[slug]` 60, `lich-tu-hoc/[slug]` 60) và vinext đổi nó thành `public, max-age=<revalidate>, stale-while-revalidate`.
- **Tỷ lệ trượt đo được ≈ 90%**: số sự kiện *trong* chia cho số yêu cầu *ngoài* theo từng đường dẫn, 21 đến 22/11 [đo]: `/` 1.530 trên 1.681, `/lich-tu-hoc` 10.864 trên 10.871, `/dong-chay-hoang-phap` 619 trên 623, `/gioi-thieu` 278 trên 297, `/lien-he` 244 trên 321, `/robots.txt` 353 trên 535. Lý do: site ít truy cập và mỗi URL thường được hỏi cách nhau hơn 30 đến 60 giây, và bot đi vào các URL không bao giờ lặp lại. (Số *trong* gồm cả làm mới nền, mỗi lần làm mới sinh 2 lần dựng: HTML và RSC, nên tỷ lệ thật có thể thấp hơn 90% một chút.)
- **`/anh-goc/...` trả `CF-Cache-Status: BYPASS`** (đo 1 mẫu): ảnh gốc không đi qua bộ đệm Workers/zone, mỗi lần mở trực tiếp là 1 yêu cầu Worker + 1 lần đọc R2. Ảnh biến đổi `/cdn-cgi/image/...` thì `HIT` (`Age 15270`, 30.100 byte AVIF, `Cache-Control` 30 ngày) [đo].
- `robots.txt` trả `no-store, BYPASS` nên mỗi lần bot lấy là một lần gọi Worker (535 trong 2 ngày) [đo].

### 3.2 D1 `tlhp-db` (đọc từ `cf d1 insights` và `events.d1Queries`) [đo]

| Ngày (UTC) | Dòng đọc | Truy vấn | Dòng ghi |
|---|---:|---:|---:|
| 17/11 | 17.499.894 | 13.445 | 112.404 |
| 18/11 | 11.104.907 | 4.449 | 0 |
| 19/11 | 2.644.530 | 651 | 0 |
| 20/11 | 40.763.253 | 28.589 | 0 |
| 21/11 | 63.810.529 | 45.205 | 0 |
| 22/11 | **83.925.717** | 87.068 | 200.769 |
| 23/11 (00:00 đến 10:00) | 61.587.605 | **94.054** | 81 |
| **Cộng từ 17/11** | **281.332.937** | **273.434** | **313.254** |

(Tổng cộng khớp với `cf d1 insights`; cột 22/11 của `events.d1Queries` cho 86.919 truy vấn và 81,9 triệu dòng, sai khác vài phần trăm do lấy mẫu.) Hạn mức đã gồm trong Workers Paid: **25 tỷ dòng đọc/tháng**, **50 triệu dòng ghi/tháng** [TL]. Hôm nay: 2,46 tỷ/tháng ở nhịp 22/11 = **10% hạn mức đọc**; ghi 0,3 triệu = 0,6% hạn mức ghi.

**Một câu duy nhất chiếm 85,3% dòng đọc** [đo `events.d1Queries`, từ 17/11]:

| Câu | Số lần chạy | Dòng đọc mỗi lần | Tổng dòng đọc | Thời gian TB |
|---|---:|---:|---:|---:|
| `select ai.album_id … from album_item ai join media m … where ai.album_id like ?` (hàm `galleries()`, `src/lib/tlhp-content/sources/d1.ts:113`) | 11.365 | **21.115** | **239.975.364 (85,3%)** | 2,76 ms |
| `POST_SUMMARY` và biến thể (632 bài + `category` + 2 lần `media`) | 6.222 + 5.244 + 2.224 | 2.529 | 15,7 + 13,3 + 5,6 triệu | 12 đến 13 ms |
| ảnh album của một bài (`album_item` theo `p.id`) | 37.619 | 81 | 3,05 triệu | 0,58 ms |
| `statue` (+ `statue_cluster`, `media`) hai biến thể | 2.376 + 1.815 | 580 | 2,4 triệu | 7,8 ms |
| thống kê thư viện ảnh của admin (`media`, 42.904 dòng) | 48 + 15 + 29 + 27 | 21.452 đến 42.904 | 3,9 triệu | 7 đến 57 ms |

**Nguyên nhân** [đo trên bản sao `real.sqlite`, `EXPLAIN QUERY PLAN`]: `album_item` có 21.102 dòng, trong đó **chỉ 15 dòng thuộc `page:` và 12 dòng thuộc `teaching:`** (21.075 là của bài, `post:`). Phép `LIKE` không dùng được chỉ mục nhị phân nên kế hoạch là `SCAN ai USING INDEX sqlite_autoindex_album_item_1` (đọc hết 21.102 dòng); viết lại thành `album_id >= 'page:' AND album_id < 'page;'` cho kế hoạch `SEARCH ai USING INDEX … (album_id>? AND album_id<?)`.

**Giới hạn thông lượng của D1** [TL]: mỗi cơ sở dữ liệu xử lý một truy vấn tại một thời điểm; thời gian truy vấn trung bình càng lớn thì thông lượng càng thấp; hàng đợi đầy thì trả lỗi "overloaded". Đo: thời gian truy vấn trung bình từ 22/11 là **1,16 ms** nên trần lý thuyết ≈ 1.000 / 1,16 ≈ **860 truy vấn/giây**. **Đỉnh đo được: 6.574 truy vấn trong một phút (≈ 110/giây)** lúc 04:52 UTC 23/11; phút bận nhất tính theo tổng thời gian truy vấn là 04:57 với **13.981 ms trong 60.000 ms ≈ 23% công suất** [đo].

**Chi phí đọc D1 mỗi lần dựng lại trang** [ước từ số dòng đo được ở bảng trên và mã]:

| Loại trang trượt bộ đệm | Dòng đọc | Số truy vấn | Ghi chú |
|---|---:|---:|---|
| Bài (`/dong-chay-hoang-phap/<slug>`, `/tri-tue-phat-phap/<slug>`) | ≈ 5.200 nếu kho nội dung đã hết hạn 15 giây; ≈ 2.400 nếu còn mới | 4 đến 5 | `summaries` 2.529 + nội dung + ảnh 81 + "liên quan" 2.224 đến 2.529 |
| Trang chủ | ≈ 25.000 (kho nội dung hết hạn); hai lần dựng (HTML và RSC) dùng chung kho trong 15 giây | 12 đến 16 | `summaries` + `loadAbout` (có `galleries` 21.115) + lịch (4 câu) + tượng + khu vực |
| Tông chỉ (`/tong-chi-tu-hoc/<slug>`), giới thiệu (`/gioi-thieu/<slug>`) | ≈ 21.200 | 2 đến 3 | gần như toàn bộ là `galleries` |
| Lịch (`/lich-tu-hoc/<slug>`) | ≈ 100 đến 200 | 4 | 4 bảng nhỏ |

**Chặn trên theo thời gian** [ước]: một lần nạp đầy đủ kho nội dung ≈ 2,5k (bài) + 2 × 21,1k (about, tông chỉ) + 0,7k (tượng) + 0,2k ≈ **45,6 nghìn dòng, 13 truy vấn**, và kho được làm mới sau mỗi `D1_RENEW_MS = 15 giây` (`repository.ts:261`) **trên từng isolate đang có yêu cầu**. Một isolate liên tục bận ≈ 5.760 lần nạp/ngày ≈ 262 triệu dòng/ngày. Số liệu thật (≈ 84 triệu dòng/ngày) tương đương khoảng 1/3 một isolate bận liên tục.

### 3.3 R2 `tlhp-media`

- Lưu trữ: 20.912 đối tượng, 2.953.892.303 byte (≈ 2,75 GiB), nhỏ hơn mức miễn phí 10 GB-tháng [đo, `cf r2 buckets metrics list`; hạn mức [TL]].
- Số thao tác Class A/B: **không đọc được bằng `cf`** (lệnh trả chỉ dung lượng). Xấp xỉ bằng số lần Worker phục vụ `/anh-goc/...`: `tlhp-web` 5.290 (8 ngày, lấy mẫu) và `tlhp-v3` 2.288 → **khoảng 950 lần/ngày ≈ 28.000/tháng** (cả hai Worker; trong đó, các lần do bộ biến đổi ảnh lấy ảnh nguồn: 2.180 và 1.337) [ước]; so với 10 triệu Class B miễn phí/tháng [TL]. Băng thông ra internet của R2 miễn phí [TL].

### 3.4 Biến đổi ảnh (Cloudflare Images transformations)

- Zone đã bật: `image_resizing = on`, `transformations = on`, `allowed_origins = *` (sửa 04/11) [đo, `cf zones transformations-config get`].
- **Hạn mức [TL]**: gói Free **5.000 biến đổi khác nhau mỗi tháng lịch**; vượt thì biến đổi mới trả lỗi 9422 (có `onerror=redirect` thì về **ảnh gốc**), **không bị tính tiền**; biến đổi đã ở bộ đệm vẫn được phục vụ. Hai kích thước bằng nhau về `format`/`quality` chỉ tính một lần (chỉ khác `width` mới tính thêm).
- Site chỉ dùng độ rộng **360, 640, 1280** (và 1920 định nghĩa nhưng chưa thấy dùng) với `quality=75,format=auto,onerror=redirect` (`media.ts:154-158`, `IMAGE_WIDTH`): trang chủ đo được 17 URL ảnh trong 14 cặp (nguồn, kích thước).
- **Số đã dùng trong tháng: không đọc được** (`cf images stats` chỉ trả ảnh lưu: 0/0). Xấp xỉ: số lần bộ biến đổi lấy ảnh nguồn qua `/anh-goc` trong 8 ngày = **2.180 (`tlhp-web`, 564 nguồn khác nhau) + 1.337 (`tlhp-v3`, 530 nguồn)** [đo]; đây là cận trên của số biến đổi khác nhau từ 16/11 (có lặp do hết hạn bộ đệm), chưa tính 1 đến 15/11.
- **Kho ảnh có thể biến đổi** [đo trên `real.sqlite`]: 591 ảnh đại diện bài (cũng là ảnh bìa; 632 bài dùng chung một ảnh cho cả hai chỗ), 111 ảnh tượng, 14 khu vực, 15 sự kiện, 883 ảnh album WordPress (chỉ ảnh WordPress mới biến đổi, `albumImageAt`). Số tổ hợp (ảnh × độ rộng) nếu mọi trang đều bị bò ≈ **3.000 đến 5.000** [ước]. Tức là cận hạn mức; vượt thì trang tải ảnh gốc 7 đến 9 MB (mã ghi rõ, `media.ts:150`).

### 3.5 Zone (gói Free) và bảo vệ

- Zone **không có luật tùy chỉnh nào** (WAF, giới hạn tần suất, Cache Rules), chỉ có luật chuyển hướng "Chuyen huong goc ve www" mới thêm và 4 bộ luật do Cloudflare quản lý (Normalization, Managed Response Firewall, DDoS L7, Managed Free) [đo, `cf rulesets list`].
- **Bot Fight Mode: tắt** (`fight_mode: false`); `ai_bots_protection`, `crawler_protection`, `ai_training`, `ai_search`: tất cả `disabled` [đo, `cf bot-management get`].
- **Giới hạn gói Free** [TL]: **5 luật tùy chỉnh WAF**, không hỗ trợ regex; giới hạn tần suất: biểu thức chỉ dùng được `Path` và `Verified Bot`, **cửa sổ đếm 10 giây, thời gian chặn 10 giây**, không đếm theo mã phản hồi; **chống DDoS L3/4/7 không giới hạn, không tính phí cho mọi gói**; Bot Fight Mode miễn phí.

### 3.6 Nhật ký Workers

- `observability: { enabled: true }` với `head_sampling_rate` mặc định 1 (**100%**): mỗi sự kiện ngoài và trong là một sự kiện log, khoảng **4,5 KB** mỗi sự kiện (`eventSize: 4485` ở 1 mẫu) [đo].
- **Đến 30/11** [TL]: 20 triệu sự kiện bao gồm/tháng, thêm 0,60 USD/triệu. **Từ 1/12/2026** [TL]: tính theo Cloudflare Observability: **50 GB nhập vào bao gồm mỗi chu kỳ, thêm 0,25 USD/GB; 10 GB-tháng lưu trữ bao gồm, thêm 0,10 USD/GB-tháng**; thời gian giữ mặc định 7 ngày. Hôm nay ≈ 44.000 sự kiện/ngày ≈ 1,3 triệu/tháng ≈ 6 GB: trong hạn mức.

### 3.7 Thanh toán thật: không đọc được

`cf billing usage ...` và `get-account-billable-metrics` trả **403 Authentication error** với quyền hiện tại [đo]. Dự đoán hóa đơn tháng 11 ≈ **5,00 đến 5,30 USD** (gói Workers Paid + CPU vượt nhẹ) [ước]; cần xác nhận ở Dashboard.

---

## 4. (B) Gói hiện tại có gánh được đợt tăng không?

### 4.1 Giả định

- Nhịp cơ sở "1 lần" = ngày 22/11 của cả hai Worker [đo]: **23.319 yêu cầu ngoài/ngày**; **20.954 lần dựng lại/ngày** (trượt ≈ 90%); CPU **1.426.099 ms/ngày**; D1 **86.919 truy vấn/ngày**, **81,9 triệu dòng đọc/ngày**; log **44.273 sự kiện/ngày**; R2 ≈ 2.700 lần đọc/ngày (cả hai Worker, gồm lấy ảnh nguồn).
- Hệ số: CPU ngoài 11 ms; CPU dựng 55,8 ms; 4,15 truy vấn và 3.911 dòng đọc mỗi lần dựng; 4,5 KB mỗi sự kiện log; 30 ngày/tháng; **R2 tăng tỷ lệ theo hệ số lưu lượng** (cận trên: thực tế ảnh biến đổi được bộ đệm của zone giữ).
- Tỷ lệ trượt `m`: **0,90** (đo hôm nay, TTL 30 đến 60 giây) và **0,10** (kịch bản "90% trúng bộ đệm" chủ yêu cầu; **không đo được ở mức lưu lượng đó, chỉ là giả định**).
- Giá [TL]: Workers 0,30 USD/triệu yêu cầu sau 10 triệu; CPU 0,02 USD/triệu ms sau 30 triệu; D1 đọc 0,001 USD/triệu dòng sau 25 tỷ; R2 Class B 0,36 USD/triệu sau 10 triệu; nhật ký theo quy tắc **từ 1/12** (xem 3.6). Tiền cố định 5 USD/tháng. Các khoản **không** gồm: ghi D1 (admin), R2 Class A, Workers AI, tên miền, Images Paid (chưa mua).
- **Phí yêu cầu Workers có thể gấp tới 2 lần** nếu phản hồi lấy từ bộ nhớ đệm của lối vào `VinextCachedResponse` cũng bị tính như một yêu cầu (chú thích 4 trong trang giá nói rằng yêu cầu trúng bộ đệm Workers, gồm cả gọi worker-to-worker, tính cùng đơn giá; trong khi phần Service bindings nói không tính thêm). Bảng dưới lấy cận thấp (1 lần); nếu 2 lần thì thêm khoảng 39 USD ở mức 200 lần, và 7,5 USD ở mức 50 lần.
- Lưu ý: **các "hệ số lưu lượng" nhân đều mọi loại yêu cầu của hôm nay**, tức giữ nguyên cơ cấu 52% bot/18% thử nghiệm; một bài lan truyền hoặc ngày lễ thật (người dùng thật vào ít URL, nhiều lần) có chi phí thấp hơn nhiều vì các URL đó trúng bộ nhớ đệm và được gộp yêu cầu (request collapsing [TL]).

### 4.2 Bảng kịch bản: giữ nguyên cấu hình hôm nay

| Kịch bản | Trượt `m` | Yêu cầu/ngày | Dựng lại/ngày | Yêu cầu/tháng | CPU ms/tháng | D1 dòng đọc/tháng | D1 truy vấn/giây TB | Log sự kiện/tháng (GB) | $ Workers | $ CPU | $ D1 | $ Log (từ 1/12) | **Tổng USD/tháng** | Trong gói? |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Hôm nay (1×) | 0,90 | 23.319 | 20.987 | 0,70 triệu | 42,8 triệu | 2,46 tỷ | 1,0 | 1,3 triệu (6 GB) | 0 | 0,26 | 0 | 0 | **5,26** | Có (CPU vượt nhẹ) |
| 10× | 0,90 | 233.190 | 209.871 | 7,0 triệu | 428 triệu | 24,6 tỷ | 10,1 | 13,3 triệu (60 GB) | 0 | 7,97 | 0 | 2,79 | **15,76** | Sát trần D1 và log |
| 50× | 0,90 | 1,17 triệu | 1,05 triệu | 35,0 triệu | 2.142 triệu | 123 tỷ | 50 | 66,5 triệu (298 GB) | 7,49 | 42,24 | 98,11 | 67,97 | **220,82** | Không |
| 200× | 0,90 | 4,66 triệu | 4,20 triệu | 139,9 triệu | 8.568 triệu | 492 tỷ | 201 | 265,8 triệu (1.192 GB) | 38,97 | 170,75 | 467,45 | 312,39 | **996,80** (+2,23 R2) | Không; D1 sát trần lý thuyết ở đỉnh |

### 4.3 Bảng kịch bản: 90% trúng bộ đệm (m = 0,10), nhưng chưa sửa mã

| Kịch bản | Yêu cầu/ngày | Dựng lại/ngày | CPU ms/tháng | D1 dòng đọc/tháng | D1 truy vấn/giây TB | Log sự kiện/tháng (GB) | $ Workers | $ CPU | $ D1 | $ Log | **Tổng USD/tháng** | Trong gói? |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Hôm nay (1×) | 23.319 | 2.332 | 11,6 triệu | 0,27 tỷ | 0,1 | 0,8 triệu (3 GB) | 0 | 0 | 0 | 0 | **5,00** | Có |
| 10× | 233.190 | 23.319 | 116 triệu | 2,74 tỷ | 1,1 | 7,7 triệu (35 GB) | 0 | 1,72 | 0 | 0 | **6,72** | Có |
| 50× | 1,17 triệu | 116.595 | 580 triệu | 13,7 tỷ | 5,6 | 38,5 triệu (173 GB) | 7,49 | 11,00 | 0 | 33,67 | **57,16** | Vượt nhẹ (CPU, log) |
| 200× | 4,66 triệu | 466.380 | 2.320 triệu | 54,7 tỷ | 22 | 153,9 triệu (690 GB) | 38,97 | 45,80 | 29,72 | 175,17 | **296,90** (+2,23 R2) | Vượt (log là khoản lớn nhất) |

### 4.4 Thứ gì hỏng trước, và bao nhiêu

Theo thứ tự xảy ra khi lưu lượng tăng, mức chạm tính theo hệ số lưu lượng `k` (giữ nguyên cấu hình, `m = 0,9`) [ước, trừ khi ghi đo]:

| Thứ tự | Giới hạn | Chạm ở | Hậu quả |
|---|---|---|---|
| 0 (đã xảy ra) | **Độ ổn định khi nhiều lần dựng trang song song**: lượt quét 829 URL chưa có trong bộ đệm, 8 luồng, trên V3 | Đã thấy: **10/829 (1,2%) trả 503**; 22 sự kiện ngoại lệ trong 2 đợt quét (23/11 04:52 đến 04:59 và 05:41 đến 05:42 UTC); [đo] | Lỗi tạm, thử lại thành công. Nguyên nhân chưa rõ. Chạy cục bộ cùng kịch bản (8 và 16 luồng) **không tái hiện** (829/829 trả 200, mục 6). Đây là rủi ro thật trước mọi hạn mức |
| 1 | **Ảnh biến đổi 5.000/tháng** (Free) | Không phụ thuộc lưu lượng: phụ thuộc số (ảnh, độ rộng) bị bò; cận trên ước 3.000 đến 5.000, cận trên quan sát (lần lấy ảnh nguồn) 3.517 trong 8 ngày [đo] | Không tính tiền; trang rơi về ảnh gốc 7 đến 9 MB (chậm, nặng). Đặt lại đầu tháng sau |
| 2 | **CPU 30 triệu ms/tháng** | k ≈ 0,7 (đã vượt) | +0,02 USD/triệu ms: **0,26 USD/tháng hôm nay**, 8 USD ở 10 lần |
| 3 | **Nhật ký (từ 1/12): 50 GB nhập vào** | k ≈ 8,4 | 0,25 USD/GB: 2,79 USD ở 10 lần, 68 USD ở 50 lần, 312 USD ở 200 lần; **khoản lớn nhất ở 200 lần** nếu `m` giảm |
| 4 | **D1 25 tỷ dòng đọc/tháng** | **k ≈ 10,2** (m = 0,9); k ≈ 91 (m = 0,1) | 1 USD/tỷ dòng: 98 USD ở 50 lần, 467 USD ở 200 lần |
| 5 | **Yêu cầu Workers 10 triệu/tháng** | k ≈ 14,3 | 0,30 USD/triệu: 7,5 USD ở 50 lần, 39 USD ở 200 lần |
| 6 | **Thông lượng một CSDL D1** (≈ 860 truy vấn/giây theo thời gian truy vấn TB 1,16 ms) | Trung bình 201 truy vấn/giây ở k = 200 (23% công suất); **các đợt dồn nén gấp 5 lần trung bình chạm trần ở khoảng 170 đến 200 lần** | Hàng đợi, rồi lỗi "overloaded" của D1; đỉnh đã đo hôm nay 110 truy vấn/giây (23% công suất, 23/11 04:57) |
| — | CPU/bộ nhớ mỗi lần gọi (10 ms Free, **5 phút Paid**; 128 MB/isolate; 10.000 truy vấn con) [TL] | Không thấy chạm: CPU lớn nhất đo được 1.935 ms | — |

**Câu trả lời ngắn (B):**
- **Nếu 90% truy cập trúng bộ đệm**: đến **50 lần** mức hôm nay thì vẫn nằm trong gói (≈ 57 USD/tháng, vượt nhẹ CPU và log); **200 lần** ≈ 297 USD/tháng, không còn "trong gói" nhưng vẫn không sập: trả theo mức dùng, không có hạn mức cứng nào ngắt site (trừ khi bạn tự đặt hạn mức chi tiêu, mục 5). Cần nhớ giả định 90% trúng chưa được chứng minh: **hôm nay chỉ trúng khoảng 10%**.
- **Nếu giữ nguyên cấu hình**: 10 lần vẫn rẻ (≈ 16 USD), **50 lần đã ≈ 221 USD, 200 lần ≈ 1.000 USD/tháng**; khoản lớn nhất là D1 (câu `LIKE`) rồi nhật ký và CPU.
- **Một URL nóng (bài lan truyền)** gần như miễn phí: yêu cầu trúng bộ đệm không tốn CPU, các lần trượt đồng thời được gộp [TL]. Thứ làm tốn tiền là **nhiều URL không bao giờ lặp lại** (bot và bẫy `?thang=`), vì mỗi URL là một lần dựng và khoảng 4 truy vấn D1.

---

## 5. Giảm nhẹ, xếp theo lợi ích trên chi phí

Tất cả đều **chưa làm**; đây là đề xuất. Cột "Tác dụng" là ước theo số đo ở trên.

| # | Việc | Chi phí / rủi ro | Tác dụng |
|---|---|---|---|
| 1 | **Sửa `galleries()` (`sources/d1.ts:113`) từ `LIKE 'page:%'` sang khoảng chỉ mục** `ai.album_id >= ? and ai.album_id < ?` với `('page:', 'page;')` và `('teaching:', 'teaching;')`; áp cho cả bản sao trong repo `tlhp-av3` (mã chép lại giữa hai repo) | 0 USD; vài dòng mã; kiểm bằng `EXPLAIN QUERY PLAN` (đã thấy `SEARCH … album_id>? AND album_id<?` trên `real.sqlite`) và test V3 có sẵn. Thứ tự kết quả (`order by ai.album_id, ai.position`) không đổi | **−85% dòng đọc D1** (21.115 → khoảng 30 dòng mỗi lần chạy); ở 50 lần: 123 tỷ → 18 tỷ dòng/tháng, **−98 USD**; ở 200 lần: **−419 USD** |
| 2 | **Giảm lấy mẫu nhật ký**: `observability: { enabled: true, head_sampling_rate: 0.1 }` (hoặc 0,2) ở cả `tlhp-v3` và `tlhp-web` (`cloudflare.config.ts`) | 0 USD; mất 90% chi tiết (nhật ký lỗi có thể bị bỏ sót vì lấy mẫu đầu vào: [TL] "head-based sampling can omit individual warnings"); `cf o11y telemetry` ghi ít hơn nên số liệu sau này phải nhân lại | Từ 1/12: 1.192 GB → 119 GB ở 200 lần: **−293 USD**; 50 lần: **−68 USD** |
| 3 | **Chặn rác ở rìa, trước Worker**, dùng luật tùy chỉnh miễn phí (zone có 5, đang dùng 0): một luật chặn đường dẫn chứa `/.env`, `/.git`, `/wp-`, `.php`, `/config/`, `/phpinfo`, `/xmlrpc`, `/vendor/`, `/s3/`… (Free không có regex nhưng có `contains`/`starts_with`); thêm 1 luật giới hạn tần suất (Free: 10 giây/10 giây, theo IP, trên đường dẫn) | 0 USD; cần kiểm kỹ để không chặn nhầm `/_next`, `/.well-known`; chặn bằng `Block`, không tính vào yêu cầu Worker (luật chạy trước Worker) | Quét kiểu #1 (8.800 yêu cầu/2 phút, gần như toàn 404 và 308) không còn đến Worker: không tính yêu cầu, CPU, log. Quét kiểu #1 chiếm khoảng một nửa yêu cầu ngoài của riêng ngày 20/11 (8.803 trên 17.599) và 0% các ngày khác; bảo vệ tốt nhất khỏi lũ quét |
| 4 | **Bật chặn bot AI/cào nội dung** (miễn phí): `ai_bots_protection`/Bot Fight Mode (đang tắt); quyết định của chủ site vì ảnh hưởng hiển thị trên công cụ AI | 0 USD; quyết định chính sách, không phải kỹ thuật; Bot Fight Mode có thể thách thức nhầm công cụ giám sát hợp lệ (Lighthouse/PageSpeed dùng để đo: kiểm lại sau khi bật) | Bot chiếm 52% yêu cầu ngoài; riêng Bytespider + CogBot + ClaudeBot ≈ 12.000 trên 35.900 sự kiện ngày 22/11 (≈ 33%) |
| 5 | **Tăng TTL bộ nhớ đệm trang** từ `revalidate = 30/60` lên 300 đến 900 giây (giữ `stale-while-revalidate`), **kèm xóa theo yêu cầu khi xuất bản** (`ctx.cache.purge()`/thẻ `Cache-Tag`) qua một đường gọi từ admin sang V3 đã mô tả ở `chuyen-v3-lam-site-chinh.md` mục 5.3 | 0 USD; **độ trễ bài mới lên web tăng nếu chưa có đường xóa**: hôm nay đã là 45 đến 75 giây (TTL + 15 giây của kho); phải làm việc xóa trước khi tăng TTL | Với khách thật: tỷ lệ trượt có thể giảm từ 90% xuống thấp hơn nhiều ở các trang nóng (trang chủ, danh sách), **không có tác dụng với bot đi vào URL không lặp lại**. Trang chủ mỗi lần làm mới tốn 452 ms CPU: giảm 5 đến 15 lần |
| 6 | **Tăng `D1_RENEW_MS`** từ 15.000 lên 60.000 đến 300.000 (`repository.ts:261`) | 0 USD; trễ nội dung tối đa bằng giá trị này nếu chưa có `bumpContentEpoch` xuyên Worker (hiện chỉ có tác dụng trong một isolate, mục 5.3 tài liệu chuyển V3) | Giảm 4 đến 20 lần số lần nạp kho (45,6 nghìn dòng mỗi lần nạp đầy đủ); độc lập với việc 1 |
| 7 | **Ảnh dựng sẵn**: khi tải ảnh lên admin, sinh sẵn 360/640 vào R2 (hoặc dùng `IMAGE_WIDTH`) để giảm phụ thuộc hạn mức 5.000/tháng; hoặc mua Images Paid (**0,50 USD/1.000 biến đổi vượt 5.000** [TL]; phí nền của gói chưa đọc được trong trang giá đã lấy) | Việc 7a là công sức lập trình trên admin; việc 7b: 3 đến 6 USD/tháng khi 11.000 đến 17.000 biến đổi | Loại bỏ nguy cơ rơi về ảnh gốc 7 đến 9 MB |
| 8 | **Cảnh báo chi tiêu** (email) ở khoảng 10 USD, và **cân nhắc kỹ** hạn mức chi tiêu cứng: [TL] khi chạm, mọi lời gọi Worker bị từ chối với lỗi `1103` (site và admin cùng tắt, vì hạn mức áp cho cả tài khoản) | 0 USD; hạn mức cứng là con dao hai lưỡi | Chặn "phá sản" khi gặp lũ bất thường; chỉ nên đặt cứng nếu chấp nhận site tắt |
| 9 | **Bộ đệm cho `/anh-goc/...`** (đang `BYPASS`): dùng Cache API hoặc lối vào có Workers Cache cho route này | Cần thử trên `thu.`; có thể phải sửa `serveMedia` | Mỗi lần mở ảnh trực tiếp hiện là 1 yêu cầu Worker + 1 lần đọc R2; hôm nay chỉ ≈ 8% yêu cầu ngoài, quan trọng khi album lớn bị bò |
| 10 | Dọn bẫy tháng trên `tlhp-web` (`v2.`): giới hạn `?thang=` trong ±2 năm hoặc 404 ngoài khoảng đó (trên V3 đã là 307) | Vài dòng; chỉ còn tác dụng cho host `v2.` | Chấm dứt mẫu "bò vô hạn" khi chưa gỡ `v2.` |

**Sau khi làm việc 1 và 2** (bảng "có sửa" ở mục 4.5): ở 90% trúng bộ đệm, 50 lần ≈ **23,5 USD/tháng**, 200 lần ≈ **97,4 USD/tháng** (còn lại yêu cầu 39 USD, CPU 46 USD, R2 2 USD, log 5 USD). Phần "yêu cầu Workers" chỉ giảm được nếu việc 3 chặn được lưu lượng rác (luật chạy trước Worker).

### 4.5 Bảng "có sửa" (việc 1: truy vấn khoảng; việc 2: lấy mẫu log 10%)

| Kịch bản | Trượt `m` | CPU ms/tháng | D1 dòng đọc/tháng | Log GB (sau lấy mẫu) | $ Workers | $ CPU | $ D1 | $ Log | **Tổng USD/tháng** |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 10× | 0,90 | 428 triệu | 3,69 tỷ | 6 | 0 | 7,97 | 0 | 0 | 12,97 |
| 50× | 0,90 | 2.142 triệu | 18,5 tỷ | 30 | 7,49 | 42,24 | 0 | 0 | 54,73 |
| 200× | 0,90 | 8.568 triệu | 73,9 tỷ | 119 | 38,97 | 170,75 | 48,87 | 19,09 | 284,92 (+2,23 R2) |
| 10× | 0,10 | 116 triệu | 0,41 tỷ | 3 | 0 | 1,72 | 0 | 0 | 6,72 |
| 50× | 0,10 | 580 triệu | 2,05 tỷ | 17 | 7,49 | 11,00 | 0 | 0 | 23,49 |
| 200× | 0,10 | 2.320 triệu | 8,21 tỷ | 69 | 38,97 | 45,80 | 0 | 5,37 | 97,37 (+2,23 R2) |

Ở 200 lần, nếu chỉ sửa 1 và 2 mà **không** tăng tỷ lệ trúng bộ đệm (m = 0,90), CPU thành khoản lớn nhất (≈ 171 USD): đây là lý do việc 5 (TTL dài kèm xóa theo yêu cầu) là bước kế tiếp.

---

## 6. Thử tải cục bộ (không đụng site thật)

Dùng đúng công thức của agent trước: `load.mjs` (`vite preview --config vite.e2e.config.ts`, `TLHP_CONTENT_SOURCE=d1`, D1 và R2 do miniflare mô phỏng; `Host: www.tunglamhoaphuc.com`), duyệt 829 URL của `/sitemap.xml`, cổng 3041 (trống trước khi chạy, đã dừng sau khi chạy: không còn tiến trình `vite preview`, không còn cổng nghe) [đo]:

| Lần chạy | Số luồng | Bộ đệm | Thời gian | Thông lượng | Kết quả | Dòng log về "hung"/lỗi |
|---|---:|---|---:|---:|---|---|
| 1 | 8 | xóa sạch (lạnh) | 174,8 giây | 4,7 yêu cầu/giây (≈ 1,7 giây/yêu cầu) | 829 × 200 | 0 / 0 |
| 2 | 16 | giữ (`reuse`) | 80,9 giây | 10,2 yêu cầu/giây | 829 × 200 | 0 / 0 |

- Tốc độ cục bộ **không so sánh được** với Cloudflare (một tiến trình miniflare trên máy Windows, SSR không có bộ đệm biên). Giá trị của phép thử: **không tái hiện được lỗi 503** (trên máy thật: 10 trong 829 với 8 luồng). Kết hợp với việc sự kiện lỗi thật có CPU thấp và thông điệp rỗng, nghi lỗi nằm ở môi trường biên (ví dụ lối gọi lại `VinextCachedResponse` hoặc cơ chế hủy yêu cầu), không phải mã dựng trang.
- Phần "hành vi đọc D1 với kho làm mới 15 giây" **không đo cục bộ** (miniflare không trả số dòng đọc, và đo chính xác cần can thiệp vào mã `d1.ts`, không làm trong lượt chỉ-đọc này). Thay vào đó dùng số dòng đọc đo từ D1 thật ở mục 3.2 (21.115 mỗi lần `galleries`, 2.529 mỗi lần `summaries`).

---

## 7. Điều tôi không đo được, và nơi chủ có thể xem trong Dashboard

| Cần biết | Vì sao không đo | Xem ở Dashboard |
|---|---|---|
| Lượt xem trang, băng thông, tỷ lệ trúng bộ đệm, top URL/quốc gia **ở mức zone** (kể cả tệp tĩnh và `/cdn-cgi/image` không qua Worker) | `cf` không có lệnh thống kê zone; `cf analytics query ...` là của Zero Trust, không phải HTTP zone | Websites, `tunglamhoaphuc.com`, **Analytics & Logs, Traffic**; Security, **Events** (luật bị chặn) |
| Chi tiêu và mức dùng thật (yêu cầu, CPU, D1, R2, log, nơ-ron AI) | `cf billing usage ...` và `get-account-billable-metrics` trả **403 Authentication error** | **Billing, Billable usage** (và Manage account, Subscriptions) |
| Số biến đổi ảnh đã dùng trong tháng | Không có lệnh; `cf images stats` chỉ trả ảnh lưu (0/0) | **Images, Transformations** (số biến đổi khác nhau trong tháng) |
| Số thao tác R2 Class A/B và băng thông R2 | `cf r2 buckets metrics list` chỉ trả dung lượng và số đối tượng | **R2, `tlhp-media`, Metrics** |
| Tỷ lệ trượt bộ nhớ đệm thật (ngoài tỷ lệ suy từ sự kiện trong/ngoài) | Telemetry không ghi `CF-Cache-Status` của Workers Cache | **Workers & Pages, `tlhp-v3`, Metrics** (yêu cầu, lỗi, CPU p50/p99) và Cache, Analytics |
| Lưu lượng trước 16/11 | Workers Logs chỉ giữ 7 ngày [TL] | Analytics & Logs của zone (xem được 30 ngày theo gói, tùy bảng điều khiển) |
| Nguyên nhân 503 và `exception` của V3 | Sự kiện lỗi không có thông điệp (`message` = chính URL), chỉ có `outcome: exception`, CPU 4 đến 21 ms; không có đường vào `tail` trong lượt chỉ-đọc này | `npx wrangler tail tlhp-v3` hoặc Workers Logs, bộ lọc `outcome = exception`, khi chạy lại lượt quét 8 luồng |
| Quá trình chọn UA `TLM-Audit-Scanner/2.0` là của ai | UA không có trong repo; IP ở Hà Lan; không có thông tin chủ | Security, Events (kiểm các luật quản lý đã chặn gì); nếu không phải của chủ site: coi là máy quét bên ngoài |
| Hiệu quả thật khi tăng TTL, chặn bot | Chưa thử (chỉ đọc) | Thử trên host `thu.` hoặc `v3.` trước |

**Hạn chế phương pháp** (để đọc số cho đúng): (1) "yêu cầu ngoài" là hiệu giữa tổng và sự kiện có `__vinext_cache_key`, nên sai lệch nhỏ nếu có yêu cầu *trong* không mang khóa; (2) phân loại bot theo mẫu UA (bot giả mạo UA trình duyệt nằm trong nhóm "còn lại"); (3) số truy vấn chia nhóm trên 7 đến 8 ngày bị lấy mẫu ×10 (tỷ lệ đúng, số tuyệt đối ±); (4) bảng kịch bản nhân đều mọi lưu lượng theo ngày 22/11, không mô hình hóa đỉnh theo phút ngoài trần D1; (5) phí yêu cầu Workers có thể gấp 2 (mục 4.1); (6) hệ số 90% trúng bộ đệm là giả định theo yêu cầu, hôm nay đo được khoảng 10%.

---

## 8. Việc kế tiếp đề nghị (theo thứ tự)

1. Làm việc 1 (truy vấn khoảng) cho cả hai repo và chạy test V3 có sẵn: đây là sửa duy nhất có lợi lớn và không đổi hành vi.
2. Đặt `head_sampling_rate` trước 1/12 (khi tính phí nhật ký đổi sang GB).
3. Quyết định chính sách bot (việc 3 và 4) cùng chủ site, vì ảnh hưởng hiển thị ở công cụ AI.
4. Tìm nguyên nhân 503 trên V3 bằng `wrangler tail tlhp-v3` khi chạy lại lượt quét 8 luồng, trước khi nhận lưu lượng thật từ Googlebot (đã nêu ở B9 của `chuyen-v3-lam-site-chinh.md`).
5. Mở Dashboard xem **Billable usage**, **Images, Transformations** và **Analytics, Traffic** để kiểm các con số `[ước]` ở trên.
