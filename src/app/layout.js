import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-fade";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/thumbs";
import "./assets/css/animate.min.css";
import "./assets/css/bexon-icons.css";
import "./assets/css/bootstrap.min.css";
import "./assets/css/font-awesome-pro.min.css";
import "./assets/css/glightbox.min.css";
import "./assets/css/meanmenu.css";
import "./assets/css/nice-select2.css";
import "./assets/css/odometer-theme-default.css";
import "../../design-system/tokens.css";
import "./globals.scss";

// Variable names match design-system/tokens.css (--tlhp-font-serif / --tlhp-font-sans);
// utilities/_tlhp-bridge.scss points Bexon's --tj-ff-* at them.
const headingFont = Noto_Serif({
	variable: "--font-noto-serif",
	subsets: ["latin", "vietnamese"],
	weight: ["400", "500", "600", "700"],
	style: ["normal", "italic"],
	display: "swap",
});
const bodyFont = Be_Vietnam_Pro({
	variable: "--font-be-vietnam-pro",
	subsets: ["latin", "vietnamese"],
	weight: ["400", "500", "600", "700"],
	style: ["normal", "italic"],
	display: "swap",
});

export const metadata = {
	title: "Bexon - Corporate Business React NextJs Template",
	description: "Bexon - Corporate Business React NextJs Template",
};

export default function RootLayout({ children }) {
	return (
		// Font variables sit on <html> because the bridge resolves them at :root.
		<html
			lang="vi"
			data-scroll-behavior="smooth"
			dir="ltr"
			className={`${headingFont.variable} ${bodyFont.variable}`}
			// The notice strip's inline script sets an attribute and a CSS variable here
			// before React hydrates.
			suppressHydrationWarning
		>
			<body>{children}</body>
		</html>
	);
}
