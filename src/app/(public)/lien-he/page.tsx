// Trang Liên hệ: tên chùa, địa chỉ, giờ mở cửa, số điện thoại, bản đồ và mạng xã hội đều đọc từ `site.info` của admin
// (Cấu hình > Thông tin trang), không viết cứng. Thay đổi ở admin hiện ở đây trong khoảng một phút.
import type { Metadata } from "next";
import { loadContactPage } from "@/lib/v3-contact";
import ContactView from "./ContactView";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadContactPage();
  const who = data.title || "chùa";
  return {
    title: `Liên hệ – ${data.name || "Tùng Lâm Hòa Phúc"}`,
    description: data.address ? `Địa chỉ, số điện thoại và giờ mở cửa của ${who}: ${data.address}.` : `Địa chỉ, số điện thoại và giờ mở cửa của ${who}.`,
  };
}

export default async function LienHePage() {
  return <ContactView data={await loadContactPage()} />;
}
