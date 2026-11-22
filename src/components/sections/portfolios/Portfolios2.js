"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import PortfolioCard2 from "@/components/shared/cards/PortfolioCard2";
import SliderArrows from "@/components/shared/sliders/SliderArrows";
import { vuTru } from "@/config/vuTru";
import { useAutoplay } from "@/hooks/useAutoplay";
import { A11y, Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import SectionMark from "@/components/shared/others/SectionMark";

const A11Y = {
	prevSlideMessage: "Khu vực trước",
	nextSlideMessage: "Khu vực kế tiếp",
	paginationBulletMessage: "Tới khu vực {{index}}",
	slideLabelMessage: "Khu vực {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "danh sách trượt",
	itemRoleDescriptionMessage: "khu vực",
};

/**
 * Bexon's project slider as Khu vực nổi bật (plan.md, home block 7): the areas of the temple
 * in map order, every slide in one frame (620x550, narrower on a phone), moving by itself every 7 seconds (held under the
 * pointer or keyboard focus), with its arrows beside the button to the map.
 * @param {{ areas: import("@/libs/vuTru").AreaTeaser[] }} props
 */
const Portfolios2 = ({ areas }) => {
	const autoplay = useAutoplay();
	if (!areas?.length) return null;
	return (
		<section className="tj-project-section-2 section-gap tlhp-area-slider" aria-labelledby="khu-vuc-noi-bat" onFocus={autoplay.onFocus} onBlur={autoplay.onBlur}>
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading style-2 text-center">
							<SectionMark icon="cac-khu-vuc-noi-bat" />
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								{vuTru.title}
							</span>
							<h2 id="khu-vuc-noi-bat" className="sec-title text-anim">
								Khu vực <span>nổi bật.</span>
							</h2>
						</div>
					</div>
				</div>
			</div>
			<div className="container-fluid">
				<div className="row">
					<div className="col-12">
						<div className="project-wrapper wow fadeInUp" data-wow-delay=".5s">
							<Swiper
								onSwiper={autoplay.onSwiper}
								slidesPerView="auto"
								spaceBetween={15}
								loop={areas.length > 3}
								speed={1500}
								centeredSlides={true}
								autoplay={{ delay: 7000, pauseOnMouseEnter: true, disableOnInteraction: false }}
								pagination={{ el: ".tlhp-area-pagination", clickable: true }}
								navigation={{ prevEl: ".tlhp-area-prev", nextEl: ".tlhp-area-next" }}
								a11y={A11Y}
								breakpoints={{
									576: { spaceBetween: 20 },
									992: { spaceBetween: 30 },
								}}
								modules={[A11y, Pagination, Autoplay, Navigation]}
								className="project-slider"
							>
								{areas.map((area) => (
									<SwiperSlide key={area.slug}>
										<PortfolioCard2 area={area} />
									</SwiperSlide>
								))}
								<div className="swiper-pagination-area tlhp-area-pagination"></div>
							</Swiper>
						</div>
					</div>
				</div>
			</div>
			<div className="container">
				<div className="tlhp-area-slider-bar">
					<SliderArrows prevClass="tlhp-area-prev" nextClass="tlhp-area-next" prevLabel="Khu vực trước" nextLabel="Khu vực kế tiếp" />
					<ButtonPrimary text="Xem sơ đồ 2D" url={vuTru.path} />
				</div>
			</div>
		</section>
	);
};

export default Portfolios2;
