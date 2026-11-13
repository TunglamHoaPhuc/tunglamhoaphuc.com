import type { Metadata } from "next";
import Link from "next/link";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { contactGroups, formatPhone, site } from "@/config/site";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

const TITLE = "Liên hệ";

export const metadata: Metadata = {
	title: `${TITLE} – ${site.name}`,
	description: `Địa chỉ, số điện thoại và giờ mở cửa của ${site.name}: ${site.address}.`,
};

// Bexon's contact page (ContactTop + Contact3) from the site's own details: where the temple
// is, whom to call, when it is open. Contact3's form is left out until it has somewhere to
// send to, and its embedded Google map too (heavy, and it sets cookies): a picture of the
// temple and the way to Google Maps stand in its place.
export default function LienHe() {
	const main = site.contacts.find((contact) => contact.phone === site.phone);
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={TITLE} text={TITLE} />
			<section className="tj-contact-area section-gap tlhp-contact" aria-labelledby="thong-tin-lien-he">
				<div className="container">
					<h2 id="thong-tin-lien-he" className="visually-hidden">
						Thông tin liên hệ
					</h2>
					<ul className="row row-gap-4 tlhp-contact-grid">
						<li className="col-xl-3 col-lg-6 col-sm-6">
							<div className="contact-item style-2">
								<div className="contact-icon">
									<i className="tji-location-3" aria-hidden="true"></i>
								</div>
								<h3 className="contact-title">Địa chỉ</h3>
								<p>{site.address}</p>
								<a className="tlhp-text-link" href={site.mapsUrl} target="_blank" rel="noopener noreferrer">
									Chỉ đường<span className="visually-hidden"> (mở Google Maps trong thẻ mới)</span>
								</a>
							</div>
						</li>
						<li className="col-xl-3 col-lg-6 col-sm-6">
							<div className="contact-item style-2">
								<div className="contact-icon">
									<i className="tji-phone" aria-hidden="true"></i>
								</div>
								<h3 className="contact-title">Gọi điện</h3>
								{main ? <p>{`${main.role}: ${main.name}`}</p> : null}
								<a className="tlhp-text-link" href={`tel:${site.phone}`}>
									{formatPhone(site.phone)}
								</a>
							</div>
						</li>
						<li className="col-xl-3 col-lg-6 col-sm-6">
							<div className="contact-item style-2">
								<div className="contact-icon">
									<i className="tji-clock" aria-hidden="true"></i>
								</div>
								<h3 className="contact-title">Giờ mở cửa</h3>
								<p>{site.openingHours}</p>
							</div>
						</li>
						<li className="col-xl-3 col-lg-6 col-sm-6">
							<div className="contact-item style-2">
								<div className="contact-icon">
									<i className="tji-calendar" aria-hidden="true"></i>
								</div>
								<h3 className="contact-title">Khóa tu, cộng tu</h3>
								<p>Lịch khóa tu, cộng tu và đại lễ trong năm.</p>
								<Link className="tlhp-text-link" href={site.register.href}>
									{site.register.label}
								</Link>
							</div>
						</li>
					</ul>
				</div>
			</section>

			<section className="tj-contact-section-2 section-bottom-gap tlhp-contact-more" aria-labelledby="danh-ba">
				<div className="container">
					<div className="row row-gap-4">
						<div className="col-lg-6">
							<div className="tlhp-contact-book">
								<h2 id="danh-ba" className="title h3">
									Danh bạ
								</h2>
								{contactGroups(site.contacts).map(({ role, people }) => (
									<div key={role} className="tlhp-contact-group">
										<h3 className="tlhp-contact-role">{role}</h3>
										<ul>
											{people.map(({ name, phone }) => (
												<li key={phone}>
													<a className="tlhp-contact-phone" href={`tel:${phone}`}>
														<span>{name}</span>
														<span className="tlhp-contact-number">{formatPhone(phone)}</span>
													</a>
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						</div>
						<div className="col-lg-6">
							<div className="tlhp-contact-map">
								{site.mapImage ? (
									<img src={site.mapImage.src} alt={`Bản đồ đường đến chùa: ${site.address}`} width={site.mapImage.width} height={site.mapImage.height} loading="lazy" decoding="async" />
								) : (
									// Until the map picture exists (GD-06): the temple itself.
									<img
										src={site.hero.image.src}
										srcSet={site.hero.image.srcSet}
										sizes="(min-width: 992px) 50vw, 100vw"
										alt={`Toàn cảnh chùa ${site.name}`}
										width={1280}
										height={720}
										loading="lazy"
										decoding="async"
										style={{ objectPosition: site.hero.image.position }}
									/>
								)}
								<div className="tlhp-contact-map-card">
									<p className="tlhp-contact-map-name">Chùa {site.name}</p>
									<p>{site.address}</p>
									<ButtonPrimary text="Mở Google Maps" url={site.mapsUrl} newTab />
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{site.social.length ? (
				<section className="section-bottom-gap tlhp-contact-social" aria-labelledby="mang-xa-hoi">
					<div className="container">
						<h2 id="mang-xa-hoi" className="tlhp-section-title">
							Trang chính thức
						</h2>
						<ul className="tlhp-pills">
							{site.social.map((link) => (
								<li key={link.href}>
									<a href={link.href} target="_blank" rel="noopener noreferrer">
										<i className={link.icon} aria-hidden="true"></i> {link.label}
										<span className="visually-hidden"> (mở trong thẻ mới)</span>
									</a>
								</li>
							))}
						</ul>
					</div>
				</section>
			) : null}
			<Cta />
		</main>
	);
}
