import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HydrationFlag } from "@/components/admin/HydrationFlag";
import "./admin.css";

// The admin: never indexed, and apart from the public site's look (admin.css, scoped to .tq).
export const metadata: Metadata = {
	title: { default: "Quản trị – Tùng Lâm Hòa Phúc", template: "%s – Quản trị Tùng Lâm Hòa Phúc" },
	robots: { index: false, follow: false },
	alternates: { canonical: null },
};

// Until React has taken the page over a form would be sent by the browser itself: a GET with every typed field,
// passwords included, in the address bar. This script (it runs while the page is still being parsed) stops that;
// <HydrationFlag> lifts it once the page's own handlers are in place.
const BLOCK_NATIVE_SUBMIT = "document.addEventListener('submit',function(e){if(!window.__tqReady)e.preventDefault()},true)";

export default function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<div className="tq">
			<script dangerouslySetInnerHTML={{ __html: BLOCK_NATIVE_SUBMIT }} />
			<HydrationFlag />
			{children}
		</div>
	);
}
