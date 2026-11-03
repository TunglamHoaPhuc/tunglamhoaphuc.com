"use client";
import ErrorPrimary from "@/components/sections/error/ErrorPrimary";
import HeroInner from "@/components/sections/hero/HeroInner";
import HeaderSpace from "@/components/shared/others/HeaderSpace";

// Shown in place of a page that failed to render, inside the site frame.
export default function Error({ reset }) {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title="Chưa tải được trang" text="Chưa tải được trang" />
			<ErrorPrimary
				title="Hệ thống đang bận"
				text="Kính mong quý vị hoan hỷ thử lại sau ít phút."
				action={
					<button type="button" className="tj-primary-btn error-btn" onClick={() => reset()}>
						<span className="btn-text">
							<span>Thử lại</span>
						</span>
						<span className="btn-icon" aria-hidden="true">
							<i className="tji-arrow-right-long"></i>
						</span>
					</button>
				}
			/>
		</main>
	);
}
