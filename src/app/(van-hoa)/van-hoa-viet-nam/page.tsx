import type { Metadata } from "next";
import VanHoaScrollytelling from "@/components/van-hoa-viet-nam/VanHoaScrollytelling";
import { vhShareImage } from "@/components/van-hoa-viet-nam/image";

// Ảnh minh họa của khung đầu, qua kho ảnh của web và co về rộng 1200 (không trỏ thẳng ảnh gốc nặng).
const OG_IMAGE = vhShareImage(
	"/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/11-van-hoa-viet-nam/van-hoa-soi-duong-minh-hoa.webp",
);
const OG_ALT = `Triển lãm số Văn Hóa Soi Đường, Đạo Sáng Non Sông – Tùng Lâm Hòa Phúc`;

const TITLE = `Văn Hóa Soi Đường, Đạo Sáng Non Sông – Tùng Lâm Hòa Phúc`;
const DESCRIPTION =
	"Hành trình 2.000 năm Phật giáo đồng hành cùng văn hóa Việt Nam qua 52 khung hình hiện vật Bảo tàng Tùng Lâm Hòa Phúc, nhân Ngày Văn hóa Việt Nam 24/11.";

// Trang chuyển từ web cũ: trải nghiệm điện ảnh toàn màn hình (xem src/components/van-hoa-viet-nam).
export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	openGraph: {
		type: "website",
		locale: "vi_VN",
		siteName: "Tùng Lâm Hòa Phúc",
		title: TITLE,
		description: DESCRIPTION,
		images: [{ url: OG_IMAGE, width: 1200, height: 800, alt: OG_ALT }],
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: [OG_IMAGE],
	},
};

export default function VanHoaVietNamPage() {
	return <VanHoaScrollytelling />;
}
