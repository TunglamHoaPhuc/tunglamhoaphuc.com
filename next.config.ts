import type { NextConfig } from "next";

// Các host công khai dạng điều kiện has/missing. Giữ khớp src/lib/v3-hosts.ts (không nhập từ đó: trình nạp cấu hình không chắc
// theo được đường dẫn `@/`); tests/unit/v3-next-config.test.ts kiểm hai bản khớp nhau.
const PUBLIC_HOST = String.raw`(www\.)?tunglamhoaphuc\.com(:\d+)?`;
const BARE_HOST = String.raw`tunglamhoaphuc\.com(:\d+)?`;
const CANONICAL_HOST = "www.tunglamhoaphuc.com";
const ADMIN_ORIGIN = "https://quantri.tunglamhoaphuc.com";

// Mặc định an toàn cho mọi trang và API, trên mọi host (khớp next.config.js của www): chỉ HTTPS (host này, không phải host con),
// không cho trang khác nhúng khung, nhóm ngữ cảnh duyệt riêng. Không có Content-Security-Policy: trang công khai chạy script nội
// tuyến và nhúng ngoài (bản đồ, YouTube), chính sách sai sẽ làm hỏng trang.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// Địa chỉ admin: /quan-tri và /api/quan-tri (đường dẫn của admin mới), /admin, /login, /van-hanh (admin cũ của www). Mỗi cái
// sang cùng đường dẫn trên quantri.; chỉ khi host là host công khai.
const ADMIN_PATHS = ['/quan-tri', '/api/quan-tri'];
// The old site's admin addresses (before 23/11/2026 Cloudflare Access guarded them) lead to the new admin's front door, NOT to the same
// path on quantri.: that host answers a path it does not serve with a 308 back to www, which would loop.
const OLD_ADMIN_PATHS = ['/admin', '/login', '/van-hanh'];
const ADMIN_REDIRECTS = [
  ...ADMIN_PATHS.flatMap((path) => [
    { source: path, has: [{ type: 'host' as const, value: PUBLIC_HOST }], destination: `${ADMIN_ORIGIN}${path}`, permanent: false },
    { source: `${path}/:rest*`, has: [{ type: 'host' as const, value: PUBLIC_HOST }], destination: `${ADMIN_ORIGIN}${path}/:rest*`, permanent: false },
  ]),
  ...OLD_ADMIN_PATHS.flatMap((path) => [
    { source: path, has: [{ type: 'host' as const, value: PUBLIC_HOST }], destination: `${ADMIN_ORIGIN}/quan-tri`, permanent: false },
    { source: `${path}/:rest*`, has: [{ type: 'host' as const, value: PUBLIC_HOST }], destination: `${ADMIN_ORIGIN}/quan-tri`, permanent: false },
  ]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days GPU decoding cache
    // Không có remotePatterns: mọi ảnh nằm trên chính site (public/ và /anh-goc/ đọc R2), không host ngoài nào được tối ưu.
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'dayjs'],
  },
  async headers() {
    return [
      // Chỉ trang công khai được lập chỉ mục: mọi host khác (v3., thu., *.workers.dev, localhost) nói noindex. Dùng tiêu đề HTTP
      // chứ không đọc host trong layout/trang (headers() làm vinext mất Workers Cache). Điều kiện `missing`: luật chỉ áp khi host
      // KHÔNG phải www hay tên miền gốc.
      {
        source: '/:path*',
        missing: [{ type: 'host', value: PUBLIC_HOST }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Mặc định an toàn cho mọi trang và API, trên mọi host (khớp www).
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // Cho phép các file tĩnh trong tibetan-study được nhúng qua iframe
        source: '/tibetan-study/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Admin CMS nằm ở Worker khác (tlhp-web) trên quantri.: địa chỉ cũ ở www đưa người dùng tới đó. Chỉ trên host công khai
      // (ở host khác các địa chỉ này là 404) và tạm thời (307). Đặt TRƯỚC luật tên miền gốc để tunglamhoaphuc.com/quan-tri
      // sang thẳng quantri. không qua www. Chuỗi truy vấn (vd ?token=) không theo sang host khác (vinext).
      ...ADMIN_REDIRECTS,
      // Tên miền gốc về www. vinext không mang chuỗi truy vấn sang host khác, nên ?q=... mất ở đây: Redirect Rule của
      // Cloudflare giữ được chuỗi truy vấn và chạy trước Worker, là cửa tốt hơn; luật này chỉ là lớp dự phòng
      // (docs/chuyen-v3-lam-site-chinh.md mục 3.2).
      { source: '/:path*', has: [{ type: 'host', value: BARE_HOST }], destination: `https://${CANONICAL_HOST}/:path*`, permanent: true },
      {
        source: '/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam',
        destination: '/tong-chi-tu-hoc/tiep-buoc-thay-toi',
        permanent: true,
      },
      // Mỗi tượng một địa chỉ: /bao-tuong/{slug}. Dạng /bao-tuong-phat-giao/{slug} (liên kết cũ, www trả 404) và /bao-tuong
      // (không có trang, www trả 404) về địa chỉ chuẩn, để một trang không có hai địa chỉ cùng 200.
      { source: '/bao-tuong-phat-giao/:slug', destination: '/bao-tuong/:slug', permanent: true },
      { source: '/bao-tuong', destination: '/bao-tuong-phat-giao', permanent: true },
    ];
  },
};

export default nextConfig;