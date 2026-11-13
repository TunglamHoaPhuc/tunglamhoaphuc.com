import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-fade";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/thumbs";
import "./assets/css/animate.min.css";
import "./assets/css/bexon-icons.css";
import "./assets/css/bootstrap.min.css";
import "./assets/css/fa-brands.css";
import "./assets/css/glightbox.min.css";
import "./assets/css/odometer-theme-default.css";
import "./assets/css/fonts.css";
import "../../design-system/tokens.css";
import "./globals.scss";
// Noto Serif and Be Vietnam Pro are declared in assets/css/fonts.css under the names
// design-system/tokens.css uses (--tlhp-font-serif / --tlhp-font-sans). The upright faces
// are preloaded, latin and vietnamese: 10 small files, about 121 KB (next/font preloaded 20
// files, over 400 KB, T41f). Fewer let text swap fonts after the first paint and move the
// month buttons of the calendar (the layout-shift tests caught it). Italics are not preloaded.
const PRELOADED_FONTS = Object.values(
	import.meta.glob("./assets/fonts/tlhp/*-normal-*.woff2", { query: "?url", import: "default", eager: true }),
);

export const metadata = {
	title: "Bexon - Corporate Business React NextJs Template",
	description: "Bexon - Corporate Business React NextJs Template",
};

export default function RootLayout({ children }) {
	return (
		<html
			lang="vi"
			// The whole site runs on the dark "Đêm thiền" theme, the look of the old site.
			data-theme="dark"
			data-scroll-behavior="smooth"
			dir="ltr"
			// The notice strip's inline script sets an attribute and a CSS variable here
			// before React hydrates.
			suppressHydrationWarning
		>
			<head>
				{PRELOADED_FONTS.map((href) => (
					<link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
				))}
			</head>
			<body>{children}</body>
		</html>
	);
}
