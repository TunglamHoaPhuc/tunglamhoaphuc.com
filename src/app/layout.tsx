import type { Metadata } from "next";
import "./globals.css";
import { SiteChromeProvider } from "@/components/public/SiteChrome";
import { loadSiteChrome } from "@/lib/v3-chrome";
import { V3_ORIGIN } from "@/lib/v3-seo";
// ZenAudioPlayer tạm tắt theo yêu cầu (sẽ bật lại sau)

// Sửa lại thông tin SEO chuẩn cho Cổng thông tin của Chùa
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap";

export const metadata: Metadata = {
  // Địa chỉ gốc để mọi địa chỉ tương đối trong metadata (ảnh chia sẻ, liên kết) thành địa chỉ tuyệt đối trên V3.
  metadataBase: new URL(V3_ORIGIN),
  // v3 là bản xem trước của giao diện mới; nội dung trùng www nên không cho máy tìm kiếm lập chỉ mục.
  robots: { index: false, follow: false },
  title: "Cổng Thông Tin Điện Tử Chùa Tùng Lâm Hòa Phúc",
  description:
    "Kênh thông tin chính thức của Chùa Tùng Lâm Hòa Phúc - Lịch tu học, lễ hội, bài giảng Phật pháp và hoạt động Phật sự.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const chrome = await loadSiteChrome();
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Phông tiêu đề (chữ lớn đầu trang): tải sớm. */}
        <link rel="preload" href="/fonts/UTMNiagara.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/UTMClassizismAntiqua.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {/* Google Fonts không chặn hiển thị: tải xong mới áp dụng (font-display: swap). */}
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" />
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
        {/* <ZenAudioPlayer /> - Tắt tạm thời */}
      </body>
    </html>
  );
}
