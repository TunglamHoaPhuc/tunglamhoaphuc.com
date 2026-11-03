import type { ReactNode } from "react";
import type { Announcement } from "@/config/site";
import BackToTop from "@/components/shared/others/BackToTop";
import AnnouncementBar from "./AnnouncementBar";
import Footer2 from "./footer/Footer2";
import Header from "./header/Header";
import PageEffects from "./PageEffects";

type Props = {
	children: ReactNode;
	/** 2: the transparent header over the home hero; 1: the solid header of inner pages. */
	headerType?: 1 | 2;
	/** Defaults to `site.features.search`; /styleguide turns it on to preview the popup. */
	showSearch?: boolean;
	/** Defaults to `site.announcement`. */
	announcement?: Announcement | null;
};

// The frame Bexon repeated on every page: the floating header and its sticky copy outside
// the smoothed content, the notice strip, the page, the footer. Route group layouts and
// the 404 page render it, so pages hold only their <main>.
export default function SiteShell({ children, headerType = 1, showSearch, announcement }: Props) {
	return (
		<>
			<Header headerType={headerType} showSearch={showSearch} />
			<Header headerType={headerType} showSearch={showSearch} isStickyHeader />
			<div id="smooth-wrapper">
				<div id="smooth-content">
					<AnnouncementBar announcement={announcement} />
					{children}
					<Footer2 />
				</div>
			</div>
			{/* After the footer, so it is also the last stop for the Tab key. */}
			<BackToTop />
			<PageEffects />
		</>
	);
}
