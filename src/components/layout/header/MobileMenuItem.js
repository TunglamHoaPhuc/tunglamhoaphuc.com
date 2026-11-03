"use client";
import { ariaCurrent, isCurrentLink } from "@/libs/nav";
import Link from "next/link";
import { useId, useState } from "react";

// One accordion row of the mobile menu: the label opens its pages in place.
const MobileMenuItem = ({ item, isCurrent, pathname }) => {
	const [isOpen, setIsOpen] = useState(isCurrent);
	const panelId = useId();

	return (
		<li className={`has-dropdown ${isOpen ? "dropdown-opened" : ""} ${isCurrent ? "current-menu-ancestor" : ""}`}>
			<button
				type="button"
				className="tlhp-mobile-toggle"
				aria-expanded={isOpen}
				aria-controls={panelId}
				onClick={() => setIsOpen((open) => !open)}
			>
				{item.label}
				<span className={`mean-expand ${isOpen ? "mean-clicked" : ""}`} aria-hidden="true">
					<i className="tji-arrow-down"></i>
				</span>
			</button>
			<ul id={panelId} className="sub-menu" hidden={!isOpen}>
				{item.children.map((child) => (
					<li key={child.href} className={isCurrentLink(pathname, child) ? "current-menu-item" : ""}>
						<Link href={child.href} aria-current={ariaCurrent(pathname, child)}>
							{child.label}
						</Link>
					</li>
				))}
			</ul>
		</li>
	);
};

export default MobileMenuItem;
