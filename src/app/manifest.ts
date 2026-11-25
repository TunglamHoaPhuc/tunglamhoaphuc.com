import type { MetadataRoute } from "next";

// "Thêm vào màn hình chính" trên điện thoại: tên chùa, nền tối của site và con dấu Mộc Ấn (tệp ở public/brand/favicon).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tùng Lâm Hòa Phúc",
    short_name: "Tùng Lâm Hòa Phúc",
    description: "Nơi để trở về – Chốn thiêng bình yên",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#1a120b",
    theme_color: "#1a120b",
    icons: [
      { src: "/brand/favicon/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/favicon/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
