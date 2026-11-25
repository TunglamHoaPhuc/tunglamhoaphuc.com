import type { ReactNode } from "react";

// Triển lãm số /van-hoa-viet-nam là một ứng dụng toàn màn hình có thanh điều hướng riêng: nằm ngoài
// SiteShell (không header, footer, thông báo, cuộn mượt của web), nên layout chỉ trả lại nội dung.
export default function VanHoaLayout({ children }: { children: ReactNode }) {
	return children;
}
