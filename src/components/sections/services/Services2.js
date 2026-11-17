import RevealLinks from "@/components/sections/calendar/RevealLinks";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import ServiceCard2 from "@/components/shared/cards/ServiceCard2";
import { tongChi } from "@/config/tongChi";
import SectionMark from "@/components/shared/others/SectionMark";

/**
 * Bexon's dark services section as Tông Chỉ Tu Học (plan.md, home block 6, and the
 * /tong-chi-tu-hoc page): the five groups as cards that slide in from the right while the
 * heading stays in place (sidebarSticky from 992px, fadeInRightOnScrollAnim; both off under
 * reduced motion, where the cards are a plain list). On the page each card is a stop the
 * heading's links lead to; on the home page the heading leads to the page.
 * @param {{ groups: import("@/libs/tongChiGroups").TongChiGroup[], page?: boolean }} props
 */
const Services2 = ({ groups, page = false }) => {
	if (!groups?.length) return null;
	return (
		<section
			className={`tj-service-section service-2 section-gap section-gap-x slidebar-stickiy-container tlhp-tong-chi${page ? "" : " tlhp-tong-chi-home"}`}
			aria-labelledby="tong-chi-tieu-de"
		>
			<div className="container">
				<div className="row">
					<div className="col-lg-4">
						<div className="content-wrap slidebar-stickiy">
							<div className="sec-heading style-2">
								<SectionMark icon="tong-chi-tu-hoc" />
								<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
									{tongChi.title}
								</span>
								<h2 id="tong-chi-tieu-de" className="sec-title text-white text-anim">
									Con đường <span>tu học.</span>
								</h2>
							</div>
							{page ? (
								<RevealLinks>
									<nav aria-label="Các nhóm Tông Chỉ Tu Học">
										<ul className="tlhp-tong-chi-nav">
											{groups.map((group) => (
												<li key={group.slug}>
													<a href={`${tongChi.path}#${group.slug}`}>
														{group.name}
													</a>
												</li>
											))}
										</ul>
									</nav>
								</RevealLinks>
							) : (
								<>
									<p className="tlhp-tong-chi-lead wow fadeInUp" data-wow-delay=".5s">
										{tongChi.intro[2]}
									</p>
									<div className="wow fadeInUp" data-wow-delay=".6s">
										<ButtonPrimary text="Xem Tông Chỉ Tu Học" url={tongChi.path} />
									</div>
								</>
							)}
						</div>
					</div>
					<div className="col-lg-8">
						<ul className="service-wrapper-2">
							{groups.map((group) => (
								<li key={group.slug} id={page ? group.slug : undefined} tabIndex={page ? -1 : undefined}>
									<ServiceCard2 group={group} />
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
			<div className="bg-shape-1" aria-hidden="true">
				<img src="/images/shape/pattern-2.webp" alt="" loading="lazy" />
			</div>
			<div className="bg-shape-2" aria-hidden="true">
				<img src="/images/shape/pattern-3.webp" alt="" loading="lazy" />
			</div>
			<div className="bg-shape-3" aria-hidden="true">
				<img src="/images/shape/shape-blur.svg" alt="" loading="lazy" />
			</div>
		</section>
	);
};

export default Services2;
