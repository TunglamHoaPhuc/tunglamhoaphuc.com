"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import { formatPhone, site } from "@/config/site";
import useIsSticky from "@/hooks/useIsSticky";
import { useId, useRef, useState } from "react";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";
import Navbar from "./Navbar";

// Each page renders this twice, like Bexon: the header floating over the hero and a copy
// that slides down when the visitor scrolls back up. Whichever copy is out of view is
// `inert`, so keyboard and screen reader users meet one header, never two.
const Header = ({ headerType = 1, isStickyHeader = false }) => {
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const mobileToggleRef = useRef(null);
	const mobileMenuId = useId();
	const isStickyShown = useIsSticky(true);
	const isHidden = isStickyHeader ? !isStickyShown : isStickyShown;

	const closeMobileMenu = () => {
		setIsMobileMenuOpen(false);
		mobileToggleRef.current?.focus();
	};

	return (
		<>
			<MobileMenu id={mobileMenuId} isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />

			{site.features.search ? (
				<div
					className={`search-popup-overlay ${isSearchOpen ? "search-popup-overlay-open" : ""}`}
					onClick={() => setIsSearchOpen(false)}
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
								<div className="header-right-item tlhp-header-actions">
									{site.features.search ? (
										<div className="header-search">
											<button
												type="button"
												className={`search ${isSearchOpen ? "search-hide" : ""}`}
												aria-label="Tìm kiếm"
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
										aria-controls={mobileMenuId}
										onClick={() => setIsMobileMenuOpen(true)}
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

				{site.features.search ? (
					<div className={`search_popup ${isSearchOpen ? "search-opened" : ""}`}>
						<div className="container">
							<div className="row justify-content-center">
								<div className="col-8">
									<div className="tj_search_wrapper">
										<div className="search_form">
											<form action="/tim-kiem" role="search">
												<div className="search_input">
													<div className="search-box">
														<input
															className="search-form-input"
															type="search"
															name="q"
															aria-label="Từ khóa tìm kiếm"
															placeholder="Nhập từ khóa rồi bấm Enter"
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
					</div>
				) : null}
			</header>
		</>
	);
};

export default Header;
