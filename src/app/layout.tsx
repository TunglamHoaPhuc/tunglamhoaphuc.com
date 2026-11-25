import type { Metadata, Viewport } from "next";
import "./globals.css";
import ScrollProgressButton from "@/components/common/ScrollProgressButton";
import { SiteChromeProvider } from "@/components/public/SiteChrome";
import { loadSiteChrome } from "@/lib/v3-chrome";
import { PUBLIC_ORIGIN } from "@/lib/site-url";
// ZenAudioPlayer tạm tắt theo yêu cầu (sẽ bật lại sau)

// Sửa lại thông tin SEO chuẩn cho Cổng thông tin của Chùa
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap";

// Lập chỉ mục KHÔNG quyết định ở đây: `robots` của trang không đặt, để host công khai (www, tên miền gốc) được lập chỉ mục. Host
// khác (v3., thu., workers.dev, localhost) nhận tiêu đề HTTP `X-Robots-Tag: noindex, nofollow` từ next.config.ts. Không đọc host
// bằng headers() ở layout hay trang: vinext coi đó là trang động và bỏ Workers Cache.
const TITLE = "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc";
const DESCRIPTION =
  "Kênh thông tin chính thức của Chùa Tùng Lâm Hòa Phúc - Lịch tu học, lễ hội, bài giảng Phật pháp và hoạt động Phật sự.";
const SHARE_IMAGE = { url: "/brand/og-tung-lam-hoa-phuc.jpg", width: 1200, height: 630, alt: "Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên" };

export const metadata: Metadata = {
  // Địa chỉ gốc công khai: mọi địa chỉ tương đối trong metadata (canonical, og:url, ảnh chia sẻ) thành địa chỉ tuyệt đối trên www,
  // kể cả khi trang mở từ v3.
  metadataBase: new URL(PUBLIC_ORIGIN),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Tùng Lâm Hòa Phúc",
  // Mỗi trang tự trỏ về chính nó (không chuỗi truy vấn). Trang nào cần canonical khác thì tự đặt (src/lib/v3-seo.ts).
  alternates: { canonical: "./" },
  // Mặc định cho trang không tự đặt. Trang đặt openGraph riêng thì thay hẳn khối này (Next không trộn), nên các hàm dựng ở
  // src/lib/v3-seo.ts tự mang ảnh chia sẻ chung.
  openGraph: { type: "website", siteName: "Tùng Lâm Hòa Phúc", locale: "vi_VN", title: TITLE, description: DESCRIPTION, images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/brand/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#2A1D14" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const chrome = await loadSiteChrome();
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Phông tiêu đề (chữ lớn đầu trang): tải sớm. */}
        <link rel="preload" href="/fonts/UTMNiagara.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/UTMClassizismAntiqua.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {/* Phông thân chữ (nút, menu, đoạn văn): thường và đậm. Không tải sớm thì chữ nút đầu trang đổi cỡ lúc phông về và làm hàng nút nhảy (CLS). */}
        <link rel="preload" href="/fonts/UTMAvo.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/UTMAvoBold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {/* Google Fonts không chặn hiển thị: stylesheet được nạp bằng script bên dưới, phông tải khi có chữ dùng tới (font-display: swap). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href=${JSON.stringify(GOOGLE_FONTS)};document.head.appendChild(l);})();`,
          }}
        />
        <noscript>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" />
        </noscript>
      </head>
      <body className="min-h-full flex flex-col m-0 p-0 font-sans relative" suppressHydrationWarning>
        <SiteChromeProvider value={chrome}>{children}</SiteChromeProvider>
        {/* Nút phần trăm cuộn: gắn một lần cho mọi trang; tự ẩn khi trang không cuộn được (vd. /van-hoa-viet-nam) */}
        <ScrollProgressButton />
        {/* <ZenAudioPlayer /> - Tắt tạm thời */}
      </body>
    </html>
  );
}
