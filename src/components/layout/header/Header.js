"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import { formatPhone, site } from "@/config/site";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import useIsSticky from "@/hooks/useIsSticky";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";
import Navbar from "./Navbar";

// Each page renders this twice, like Bexon: the header floating over the hero and a copy
// that slides down when the visitor scrolls back up. Whichever copy is out of view is
// `inert`, so keyboard and screen reader users meet one header, never two.
// `showSearch` lets /styleguide preview the search popup before /tim-kiem exists.
// Built later rather than with the page (T41a), as every page hydrated them though they are not
// seen at first: the sticky copy (103 elements) once the browser is idle or the visitor has
// scrolled 300px (it shows past 500px), and each offcanvas menu (69) on its first opening.
const STICKY_MOUNT_SCROLL = 300;
const whenIdle = (callback) =>
	"requestIdleCallback" in window ? window.requestIdleCallback(callback, { timeout: 3000 }) : window.setTimeout(callback, 1500);

const Header = ({ headerType = 1, isStickyHeader = false, showSearch = site.features.search }) => {
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isMobileMenuMounted, setIsMobileMenuMounted] = useState(false);
	const [isStickyMounted, setIsStickyMounted] = useState(false);
	const mobileToggleRef = useRef(null);
	const searchToggleRef = useRef(null);
	const searchPopupRef = useRef(null);
	const mobileMenuId = useId();
	const searchPopupId = useId();
	const isStickyShown = useIsSticky(true);
	const isHidden = isStickyHeader ? !isStickyShown : isStickyShown;

	useEffect(() => {
		if (!isStickyHeader) return;
		const mount = () => setIsStickyMounted(true);
		const onScroll = () => window.scrollY > STICKY_MOUNT_SCROLL && mount();
		whenIdle(mount);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [isStickyHeader]);

	// The menu slides in from its closed place, so it opens a frame after it is first built.
	const openMobileMenu = () => {
		if (isMobileMenuMounted) {
			setIsMobileMenuOpen(true);
			return;
		}
		setIsMobileMenuMounted(true);
		requestAnimationFrame(() => requestAnimationFrame(() => setIsMobileMenuOpen(true)));
	};
	const closeMobileMenu = () => {
		setIsMobileMenuOpen(false);
		mobileToggleRef.current?.focus();
	};
	const closeSearch = useCallback(() => {
		setIsSearchOpen(false);
		searchToggleRef.current?.focus();
	}, []);
	useFocusTrap(searchPopupRef, isSearchOpen, closeSearch);

	// Bexon's backdrop takes 0.4 s to slide in, so also close on any press outside the popup.
	useEffect(() => {
		if (!isSearchOpen) return;
		const closeOnOutsidePress = (event) => {
			if (!searchPopupRef.current?.contains(event.target) && !searchToggleRef.current?.contains(event.target)) closeSearch();
		};
		document.addEventListener("pointerdown", closeOnOutsidePress);
		return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
	}, [isSearchOpen, closeSearch]);

	if (isStickyHeader && !isStickyMounted) return null;

	return (
		<>
			{isMobileMenuMounted ? <MobileMenu id={mobileMenuId} isOpen={isMobileMenuOpen} onClose={closeMobileMenu} showSearch={showSearch} /> : null}

			{showSearch ? (
				<div
					className={`search-popup-overlay ${isSearchOpen ? "search-popup-overlay-open" : ""}`}
					onClick={closeSearch}
				></div>
			) : null}
			<header
				className={`header-area ${headerType === 2 ? "header-2" : "header-1"} section-gap-x ${
					isStickyHeader ? `header-duplicate header-sticky ${isStickyShown ? "sticky" : ""}` : "header-absolute"
				}`}
				inert={isHidden}
			>
				<div className="container-fluid">
					<div className="row">
						<div className="col-12">
							<div className="header-wrapper">
								<Logo />
								<Navbar />
								<div className={`header-right-item tlhp-header-actions ${showSearch ? "has-search" : ""}`}>
									{showSearch ? (
										<div className="header-search tlhp-from-sm">
											<button
												ref={searchToggleRef}
												type="button"
												className="search"
												aria-label="Tìm kiếm"
												aria-expanded={isSearchOpen}
												aria-controls={searchPopupId}
												onClick={() => setIsSearchOpen(true)}
											>
												<i className="tji-search" aria-hidden="true"></i>
											</button>
										</div>
									) : null}
									<a className="tlhp-header-icon-btn" href={`tel:${site.phone}`} aria-label={`Gọi điện ${formatPhone(site.phone)}`}>
										<i className="tji-phone" aria-hidden="true"></i>
									</a>
									<a
										className="tlhp-header-icon-btn tlhp-from-md"
										href={site.mapsUrl}
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Chỉ đường đến chùa (mở Google Maps)"
									>
										<i className="tji-location" aria-hidden="true"></i>
									</a>
									<div className="header-button tlhp-from-md tlhp-header-cta">
										<ButtonPrimary text={site.register.label} url={site.register.href} />
									</div>
									<button
										ref={mobileToggleRef}
										type="button"
										className="menu_bar mobile_menu_bar tlhp-below-desktop"
										aria-label="Mở menu"
										aria-expanded={isMobileMenuOpen}
										aria-controls={isMobileMenuMounted ? mobileMenuId : undefined}
										onClick={openMobileMenu}
									>
										<span></span>
										<span></span>
										<span></span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{showSearch ? (
					<div
						ref={searchPopupRef}
						id={searchPopupId}
						className={`search_popup ${isSearchOpen ? "search-opened" : ""}`}
						role="dialog"
						aria-modal="true"
						aria-label="Tìm kiếm"
						inert={!isSearchOpen}
					>
						<div className="container">
							<div className="row justify-content-center">
								<div className="col-12 col-lg-8">
									<div className="tj_search_wrapper">
										<div className="search_form">
											<form action="/tim-kiem" method="get" role="search">
												<div className="search_input">
													<div className="search-box">
														<input
															className="search-form-input"
															type="search"
															name="q"
															aria-label="Từ khóa tìm kiếm"
															placeholder="Nhập từ khóa rồi bấm Enter"
															autoComplete="off"
															enterKeyHint="search"
															required
														/>
														<button type="submit" aria-label="Tìm">
															<i className="tji-search" aria-hidden="true"></i>
														</button>
													</div>
												</div>
											</form>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="search_close">
							<button type="button" className="search_close_btn" aria-label="Đóng tìm kiếm" onClick={closeSearch}>
								<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
									<path d="M17 1L1 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
									<path d="M1 1L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
								</svg>
							</button>
						</div>
					</div>
				) : null}
			</header>
		</>
	);
};

export default Header;
