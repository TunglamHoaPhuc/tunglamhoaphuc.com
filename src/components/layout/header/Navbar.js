"use client";
import { site } from "@/config/site";
import { ariaCurrent, isCurrentItem, isCurrentLink } from "@/libs/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

// Desktop menu (from 1280px). Dropdowns follow the disclosure pattern: the parent is a
// button that opens on click (not hover), Esc closes and returns focus to it, and the
// panel closes when focus or a click moves elsewhere.
const Navbar = () => {
	const pathname = usePathname();
	const [openIndex, setOpenIndex] = useState(null);
	const navRef = useRef(null);
	const toggleRefs = useRef([]);
	const baseId = useId();

	useEffect(() => setOpenIndex(null), [pathname]);

	useEffect(() => {
		if (openIndex === null) return;
		const closeOnOutsideClick = (event) => {
			if (!navRef.current?.contains(event.target)) setOpenIndex(null);
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
	}, [openIndex]);

	const closeAndRefocus = (index) => {
		setOpenIndex(null);
		toggleRefs.current[index]?.focus();
	};

	return (
		<div className="menu-area tlhp-desktop-only align-items-center">
			<nav ref={navRef} className="mainmenu" aria-label="Menu chính">
				<ul>
					{site.nav.map((item, index) => {
						const isCurrent = isCurrentItem(pathname, item);
						if (!item.children) {
							return (
								<li key={item.href} className={isCurrent ? "current-menu-ancestor" : ""}>
									<Link href={item.href} aria-current={ariaCurrent(pathname, item)}>
										{item.label}
									</Link>
								</li>
							);
						}
						const isOpen = openIndex === index;
						const panelId = `${baseId}-menu-${index}`;
						return (
							<li
								key={item.href}
								className={`has-dropdown tlhp-dropdown ${isOpen ? "is-open" : ""} ${isCurrent ? "current-menu-ancestor" : ""}`}
								onKeyDown={(event) => {
									if (event.key === "Escape" && isOpen) {
										event.stopPropagation();
										closeAndRefocus(index);
									}
								}}
								onBlur={(event) => {
									if (isOpen && !event.currentTarget.contains(event.relatedTarget)) setOpenIndex(null);
								}}
							>
								<button
									ref={(el) => {
										toggleRefs.current[index] = el;
									}}
									type="button"
									className="tlhp-menu-toggle"
									aria-expanded={isOpen}
									aria-controls={panelId}
									onClick={() => setOpenIndex(isOpen ? null : index)}
								>
									{item.label}
								</button>
								<ul id={panelId} className="sub-menu mega-menu-service">
									{item.children.map((child) => {
										const isChildCurrent = isCurrentLink(pathname, child);
										return (
											<li key={child.href} className={isChildCurrent ? "current-menu-item" : ""}>
												<Link
													className="mega-menu-service-single"
													href={child.href}
													aria-current={ariaCurrent(pathname, child)}
												>
													<span className="mega-menu-service-icon tlhp-brand-icon" aria-hidden="true">
														{child.image ? <img src={child.image} alt="" width={128} height={128} /> : null}
													</span>
													<span className="mega-menu-service-title">{child.label}</span>
													<span className="mega-menu-service-nav" aria-hidden="true">
														<i className="tji-arrow-right-long"></i>
														<i className="tji-arrow-right-long"></i>
													</span>
												</Link>
											</li>
										);
									})}
								</ul>
							</li>
						);
					})}
				</ul>
			</nav>
		</div>
	);
};

export default Navbar;
