"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import { formatPhone, site } from "@/config/site";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import MobileNavbar from "./MobileNavbar";

// Bexon's hamburger offcanvas, used below 1280px. A modal dialog while open (focus stays
// inside, Esc closes); `inert` while closed, since it only slides off-screen.
const MobileMenu = ({ id, isOpen, onClose, showSearch = false }) => {
	const panelRef = useRef(null);
	const pathname = usePathname();
	useFocusTrap(panelRef, isOpen, onClose);

	const lastPathname = useRef(pathname);
	useEffect(() => {
		if (pathname !== lastPathname.current && isOpen) onClose();
		lastPathname.current = pathname;
	}, [pathname, isOpen, onClose]);

	return (
		<>
			<div className={`body-overlay ${isOpen ? "opened" : ""}`} onClick={onClose}></div>
			<div
				ref={panelRef}
				id={id}
				className={`hamburger-area tlhp-below-desktop ${isOpen ? "opened" : ""}`}
				role="dialog"
				aria-modal="true"
				aria-label="Menu"
				inert={!isOpen}
			>
				<div className="hamburger_bg"></div>
				<div className="hamburger_wrapper">
					<div className="hamburger_inner">
						<div className="hamburger_top d-flex align-items-center justify-content-between">
							<div className="hamburger_logo">
								<Link href="/" className="mobile_logo tlhp-logo">
									<img
										src={site.logo.src}
										srcSet={site.logo.srcSet}
										sizes="(max-width: 767.98px) 54px, 65px"
										alt=""
										width={site.logo.width}
										height={site.logo.height}
										className="tlhp-logo-seal"
										loading="lazy"
									/>
									<span className="tlhp-logo-name">{site.name}</span>
								</Link>
							</div>
							<div className="hamburger_close">
								<button type="button" className="hamburger_close_btn" aria-label="Đóng menu" onClick={onClose}>
									{/* Drawn here: Font Awesome's thin × cost phones a 456 KB font at top priority. */}
									<svg width="1em" height="1em" viewBox="0 0 18 18" fill="none" aria-hidden="true">
										<path d="M17 1L1 17" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
										<path d="M1 1L17 17" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
									</svg>
								</button>
							</div>
						</div>
						{showSearch ? (
							// On phones the header has no room for a search button; search sits here instead.
							<form className="hamburger_search tlhp-below-sm" action="/tim-kiem" method="get" role="search">
								<input type="search" name="q" aria-label="Từ khóa tìm kiếm" placeholder="Tìm kiếm" autoComplete="off" enterKeyHint="search" required />
								<button type="submit" aria-label="Tìm">
									<i className="tji-search" aria-hidden="true"></i>
								</button>
							</form>
						) : null}
						<MobileNavbar />
						<div className="tlhp-mobile-actions">
							<ButtonPrimary text={site.register.label} url={site.register.href} />
						</div>
						<div className="hamburger-infos">
							<h2 className="hamburger-title">Liên hệ</h2>
							<div className="contact-info">
								<div className="contact-item">
									<span className="subtitle">Điện thoại</span>
									<a className="contact-link" href={`tel:${site.phone}`}>
										{formatPhone(site.phone)}
									</a>
								</div>
								<div className="contact-item">
									<span className="subtitle">Giờ mở cửa</span>
									<span className="contact-link">{site.openingHours}</span>
								</div>
								<div className="contact-item">
									<span className="subtitle">Địa chỉ</span>
									<a className="contact-link" href={site.mapsUrl} target="_blank" rel="noopener noreferrer">
										{site.address}
									</a>
								</div>
							</div>
						</div>
					</div>
					{site.social.length ? (
						<div className="hamburger-socials">
							<h2 className="hamburger-title">Theo dõi</h2>
							<div className="social-links style-3">
								<ul>
									{site.social.map((link) => (
										<li key={link.href}>
											<a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
												<i className={link.icon} aria-hidden="true"></i>
											</a>
										</li>
									))}
								</ul>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</>
	);
};

export default MobileMenu;
