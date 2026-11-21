"use client";
import { ariaCurrent, isCurrentItem, isCurrentLink } from "@/libs/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeaderNav } from "./HeaderMenuContext";
import MobileMenuItem from "./MobileMenuItem";

const MobileNavbar = () => {
	const pathname = usePathname();
	const nav = useHeaderNav();
	return (
		<div className="hamburger_menu">
			<div className="mobile_menu mean-container">
				<div className="mean-bar">
					<nav className="mean-nav" aria-label="Menu chính">
						<ul>
							{nav.map((item) =>
								item.children ? (
									<MobileMenuItem key={item.id ?? item.href} item={item} isCurrent={isCurrentItem(pathname, item)} pathname={pathname} />
								) : (
									<li key={item.id ?? item.href} className={isCurrentLink(pathname, item) ? "current-menu-item" : ""}>
										<Link href={item.href} aria-current={ariaCurrent(pathname, item)} {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
											{item.label}
										</Link>
									</li>
								),
							)}
						</ul>
					</nav>
				</div>
			</div>
		</div>
	);
};

export default MobileNavbar;
