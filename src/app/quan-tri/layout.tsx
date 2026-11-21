import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";

// The admin: never indexed, and apart from the public site's look (admin.css, scoped to .tq).
export const metadata: Metadata = {
	title: { default: "Quản trị – Tùng Lâm Hòa Phúc", template: "%s – Quản trị Tùng Lâm Hòa Phúc" },
	robots: { index: false, follow: false },
	alternates: { canonical: null },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <div className="tq">{children}</div>;
}
