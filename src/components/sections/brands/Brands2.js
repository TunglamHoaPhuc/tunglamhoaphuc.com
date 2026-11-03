import Marquee from "@/components/shared/marquee/Marquee";
import { site } from "@/config/site";
import Link from "next/link";

/**
 * Bexon's sliding row of client logos as the six ways into the site (plan.md, home block 2):
 * one card per section with its gold icon. The row stops under the pointer, while focus
 * is on a card and with its pause button; with reduced motion it lies still as a grid.
 */
const Brands2 = () => {
	const entrances = site.entrances;
	return (
		<section id="loi-vao" className="tj-client-section section-top-gap tlhp-entrances" aria-labelledby="loi-vao-title">
			<div className="container-fluid client-container">
				<div className="row">
					<div className="col-12">
						<div className="client-content style-2 wow fadeIn" data-wow-delay=".3s">
							<h2 id="loi-vao-title" className="sec-title h5">
								Khám phá <span className="client-numbers">{entrances.length}</span> chuyên mục của{" "}
								<span className="client-text">Bổn tự</span>
							</h2>
						</div>
						<Marquee what="dải chuyên mục" seconds={32} viewClassName="client-slider client-slider-1">
							{entrances.map(({ label, href, image }) => (
								<li key={href} className="client-item">
									<Link className="client-logo tlhp-entry" href={href}>
										<span className="tlhp-brand-icon tlhp-entry-icon" aria-hidden="true">
											<img src={image} alt="" width={128} height={128} loading="lazy" decoding="async" />
										</span>
										<span className="tlhp-entry-label">{label}</span>
									</Link>
								</li>
							))}
						</Marquee>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Brands2;
