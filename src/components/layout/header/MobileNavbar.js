"use client";
import { site } from "@/config/site";
import { ariaCurrent, isCurrentItem, isCurrentLink } from "@/libs/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileMenuItem from "./MobileMenuItem";

const MobileNavbar = () => {
	const pathname = usePathname();
	return (
		<div className="hamburger_menu">
			<div className="mobile_menu mean-container">
				<div className="mean-bar">
					<nav className="mean-nav" aria-label="Menu chính">
						<ul>
							{site.nav.map((item) =>
								item.children ? (
									<MobileMenuItem key={item.href} item={item} isCurrent={isCurrentItem(pathname, item)} pathname={pathname} />
								) : (
									<li key={item.href} className={isCurrentLink(pathname, item) ? "current-menu-item" : ""}>
										<Link href={item.href} aria-current={ariaCurrent(pathname, item)}>
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
