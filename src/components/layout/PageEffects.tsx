"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import ClientWrapper from "@/components/shared/wrappers/ClientWrapper";

const SEAL = "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp";

// A picture whose file is gone at the source (37 of the old admin's files answer 404) shows
// the temple's round seal in its frame instead of the browser's torn-page mark (styles:
// img.tlhp-img-missing). Pictures that failed before this ran are found by the first sweep.
function showSeal(img: HTMLImageElement) {
	if (img.classList.contains("tlhp-img-missing") || !img.getAttribute("src")) return;
	img.classList.add("tlhp-img-missing");
	// The address that failed stays readable, for the editors and for the tests.
	img.dataset.tlhpSrc = img.getAttribute("src") ?? "";
	img.removeAttribute("srcset");
	img.src = SEAL;
}

// Bexon starts its smooth scrolling and scroll animations once per page mount. The shell
// now stays mounted while visitors move between pages, so restart them for each page:
// the old instance reverts its animations, the new one finds the new page's elements.
export default function PageEffects() {
	const pathname = usePathname();
	useEffect(() => {
		const onError = (event: Event) => {
			if (event.target instanceof HTMLImageElement) showSeal(event.target);
		};
		document.addEventListener("error", onError, true);
		return () => document.removeEventListener("error", onError, true);
	}, []);
	useEffect(() => {
		for (const img of document.images) if (img.complete && img.naturalWidth === 0) showSeal(img);
	}, [pathname]);
	return <ClientWrapper key={pathname} />;
}
