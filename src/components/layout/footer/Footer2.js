import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import MarqueeSlider1 from "@/components/shared/marquee/MarqueeSlider1";
import { formatPhone, site } from "@/config/site";
import Link from "next/link";
import { Fragment } from "react";
import ScrollTopLink from "./ScrollTopLink";

// "Nơi để trở về", seal, "Chốn thiêng bình yên", seal; the marquee repeats it.
const MARQUEE_ITEMS = site.slogan.split(" – ").map((title) => ({ title, img: site.sealLight.src }));

// "Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội", breaking only between its parts.
const ADDRESS = site.address.split(" – ").map((part, idx) => (
	<Fragment key={part}>
		{idx ? " – " : null}
		<span className="text-nowrap">{part}</span>
	</Fragment>
));

// Contacts grouped under their role, in the order the roles first appear.
const CONTACT_GROUPS = site.contacts.reduce((groups, contact) => {
	const group = groups.find(({ role }) => role === contact.role);
	if (group) group.people.push(contact);
	else groups.push({ role: contact.role, people: [contact] });
	return groups;
}, /** @type {{ role: string, people: import("@/config/site").Contact[] }[]} */ ([]));

// Bexon's dark Footer2 with the TLHP columns (BRAND-GUIDELINES 5.4): Bổn tự, Thời khóa tu
// học, Liên hệ, Bản đồ. One column on phones, two from md, four from xl. `.tlhp-dark` gives
// links, icons and the focus ring their colours for a dark ground.
const Footer2 = () => {
	return (
		<footer className="tj-footer-section footer-2 section-gap-x tlhp-footer tlhp-dark">
			<div className="footer-main-area">
				<div className="container">
					<div className="row gy-5">
						<div className="col-12 col-md-6 col-xl-3">
							<div className="footer-widget footer-col-1 wow fadeInUp" data-wow-delay=".1s">
								<h2 className="visually-hidden">Bổn tự</h2>
								<div className="footer-logo tlhp-footer-seal">
									<Link href="/">
										<img
											src={site.sealLight.src}
											alt={`${site.name} – về trang chủ`}
											width={site.sealLight.width}
											height={site.sealLight.height}
											loading="lazy"
										/>
									</Link>
								</div>
								<div className="footer-text">
									<p>{site.intro}</p>
								</div>
								<p className="tlhp-footer-address">
									<i className="tji-location" aria-hidden="true"></i>
									<span>{ADDRESS}</span>
								</p>
								{site.social.length ? (
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
								) : null}
							</div>
						</div>
						<div className="col-12 col-md-6 col-xl-3">
							<div className="footer-widget tlhp-footer-col wow fadeInUp" data-wow-delay=".3s">
								<h2 className="title">Thời khóa tu học</h2>
								<p className="tlhp-footer-label">Giờ mở cửa</p>
								<p className="tlhp-footer-value">{site.openingHours}</p>
								{/* Regular cộng tu sessions join here once the schedule data arrives (T12). */}
								<ButtonPrimary text="Xem lịch tu học" url="/lich-tu-hoc" isTextBtn className="tlhp-footer-more" />
							</div>
						</div>
						<div className="col-12 col-md-6 col-xl-3">
							<div className="footer-widget tlhp-footer-col wow fadeInUp" data-wow-delay=".5s">
								<h2 className="title">Liên hệ</h2>
								{CONTACT_GROUPS.map(({ role, people }) => (
									<div key={role} className="tlhp-footer-contacts">
										<p className="tlhp-footer-label">{role}</p>
										<ul>
											{people.map(({ name, phone }) => (
												<li key={phone}>
													<a className="tlhp-footer-phone" href={`tel:${phone}`}>
														<span className="tlhp-footer-phone-name">{name}</span>
														<span className="tlhp-footer-phone-number">{formatPhone(phone)}</span>
													</a>
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						</div>
						<div className="col-12 col-md-6 col-xl-3">
							<div className="footer-widget tlhp-footer-col wow fadeInUp" data-wow-delay=".7s">
								<h2 className="title">Bản đồ chùa</h2>
								{site.mapImage ? (
									<img
										className="tlhp-footer-map"
										src={site.mapImage.src}
										alt={`Bản đồ đường đến chùa: ${site.address}`}
										width={site.mapImage.width}
										height={site.mapImage.height}
										loading="lazy"
									/>
								) : (
									// Until the map picture exists (GD-06): the address in the map's place.
									<div className="tlhp-footer-map tlhp-footer-map-empty">
										<i className="tji-location" aria-hidden="true"></i>
										<span>{ADDRESS}</span>
									</div>
								)}
								<ButtonPrimary text="Mở Google Maps" url={site.mapsUrl} newTab className="tlhp-footer-map-btn" />
							</div>
						</div>
					</div>
				</div>
			</div>
			{/* Decoration only: the slogan is also written out in the strip below. */}
			<div className="footer-marquee">
				<MarqueeSlider1 items={MARQUEE_ITEMS} />
			</div>
			<div className="tj-copyright-area-2 tlhp-footer-end">
				<div className="container">
					<div className="row">
						<div className="col-12">
							<div className="copyright-content-area">
								<div className="copyright-text">
									<p>{site.copyright}</p>
								</div>
								<p className="tlhp-footer-slogan">{site.slogan}</p>
								<ScrollTopLink />
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="bg-shape-1">
				<img src="/images/shape/pattern-2.svg" alt="" loading="lazy" decoding="async" />
			</div>
			<div className="bg-shape-2">
				<img src="/images/shape/pattern-3.svg" alt="" loading="lazy" decoding="async" />
			</div>
		</footer>
	);
};

export default Footer2;
