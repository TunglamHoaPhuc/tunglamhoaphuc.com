"use client";
import { scrollToPageTop } from "@/libs/scrollToTop";

// The footer's own way back up (BRAND-GUIDELINES 5.4), for when the floating button has
// stepped aside. A button, since it moves the view rather than opening a page.
export default function ScrollTopLink() {
	return (
		<button type="button" className="tlhp-footer-top-link" onClick={scrollToPageTop}>
			Về đầu trang <i className="tji-arrow-up-long" aria-hidden="true"></i>
		</button>
	);
}
