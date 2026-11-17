"use client";
import { site } from "@/config/site";
import { ariaCurrent, isCurrentItem, isCurrentLink } from "@/libs/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

// Desktop menu (from 1280px). Dropdowns follow the disclosure pattern: the parent is a
// button, Enter/Space/click or a tap opens it, Esc closes and returns focus to it, and the
// panel closes when focus or a click moves elsewhere. Under a mouse it also unfolds on hover
// (asked for 17/11/2026, as on the old site) and stays a moment after the pointer leaves, so
// a diagonal move to the panel does not close it. aria-expanded follows what is shown.
const HOVER_CLOSE_MS = 180;

const Navbar = () => {
	const pathname = usePathname();
	const [openIndex, setOpenIndex] = useState(null);
	const navRef = useRef(null);
	const toggleRefs = useRef([]);
	const baseId = useId();
	const hoverTimer = useRef(null);
	const openedByHover = useRef(false);

	const openUnderPointer = (index, event) => {
		if (event.pointerType !== "mouse") return;
		clearTimeout(hoverTimer.current);
		openedByHover.current = true;
		setOpenIndex(index);
	};
	const closeAfterPointer = (index, event) => {
		if (event.pointerType !== "mouse") return;
		clearTimeout(hoverTimer.current);
		hoverTimer.current = setTimeout(() => {
			openedByHover.current = false;
			setOpenIndex((current) => (current === index ? null : current));
		}, HOVER_CLOSE_MS);
	};
	useEffect(() => () => clearTimeout(hoverTimer.current), []);

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
								onPointerEnter={(event) => openUnderPointer(index, event)}
								onPointerLeave={(event) => closeAfterPointer(index, event)}
							>
								<button
									ref={(el) => {
										toggleRefs.current[index] = el;
									}}
									type="button"
									className="tlhp-menu-toggle"
									aria-expanded={isOpen}
									aria-controls={panelId}
									onClick={() => {
										// A click on a menu the pointer has just opened keeps it open; the next one closes it.
										if (isOpen && openedByHover.current) {
											openedByHover.current = false;
											return;
										}
										setOpenIndex(isOpen ? null : index);
									}}
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
													<span className={`mega-menu-service-icon tlhp-brand-icon ${child.image ? "" : "tlhp-brand-dot"}`} aria-hidden="true">
														{child.image ? <img src={child.image} alt="" width={128} height={128} loading="lazy" /> : null}
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
