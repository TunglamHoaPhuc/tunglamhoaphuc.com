import ErrorPrimary from "@/components/sections/error/ErrorPrimary";
import HeroInner from "@/components/sections/hero/HeroInner";
import HeaderSpace from "@/components/shared/others/HeaderSpace";

export const notFoundMetadata = {
	title: "Không tìm thấy trang – Tùng Lâm Hòa Phúc",
	robots: { index: false },
};

// The body of the 404 page, in the honorific voice of BRAND-GUIDELINES 5.5.
const NotFoundMain = () => {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title="Không tìm thấy trang" text="Không tìm thấy trang" />
			<ErrorPrimary
				notFound
				title="Trang quý vị tìm không còn ở đây"
				text="Đường dẫn có thể đã thay đổi, hoặc trang đã được dời đi. Kính mời quý vị về trang chủ, hoặc xem lịch tu học của Bổn tự."
			/>
		</main>
	);
};

export default NotFoundMain;
