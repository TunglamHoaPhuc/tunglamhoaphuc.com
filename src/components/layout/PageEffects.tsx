"use client";
import { usePathname } from "next/navigation";
import ClientWrapper from "@/components/shared/wrappers/ClientWrapper";

// Bexon starts its smooth scrolling and scroll animations once per page mount. The shell
// now stays mounted while visitors move between pages, so restart them for each page:
// the old instance reverts its animations, the new one finds the new page's elements.
export default function PageEffects() {
	const pathname = usePathname();
	return <ClientWrapper key={pathname} />;
}
