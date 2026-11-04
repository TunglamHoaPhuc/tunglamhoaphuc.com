"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import PortfolioCard2 from "@/components/shared/cards/PortfolioCard2";
import PauseButton from "@/components/shared/sliders/PauseButton";
import { vuTru } from "@/config/vuTru";
import { useAutoplay } from "@/hooks/useAutoplay";
import { A11y, Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const A11Y = {
	paginationBulletMessage: "Tới khu vực {{index}}",
	slideLabelMessage: "Khu vực {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "danh sách trượt",
	itemRoleDescriptionMessage: "khu vực",
};

/**
 * Bexon's project slider as Khu vực nổi bật (plan.md, home block 7): the areas of the temple
 * in map order, the centre slide large, moving by itself every 7 seconds with a pause button.
 * @param {{ areas: import("@/libs/vuTru").AreaTeaser[] }} props
 */
const Portfolios2 = ({ areas }) => {
	const autoplay = useAutoplay();
	if (!areas?.length) return null;
	return (
		<section className="tj-project-section-2 section-gap tlhp-area-slider" aria-labelledby="khu-vuc-noi-bat" onFocus={autoplay.onFocus}>
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading style-2 text-center">
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
								slidesPerView={1.2}
								spaceBetween={15}
								loop={areas.length > 3}
								speed={1500}
								centeredSlides={true}
								autoplay={{ delay: 7000, pauseOnMouseEnter: true, disableOnInteraction: false }}
								pagination={{ el: ".tlhp-area-pagination", clickable: true }}
								a11y={A11Y}
								breakpoints={{
									576: { slidesPerView: 1.7, spaceBetween: 20 },
									768: { slidesPerView: 2, spaceBetween: 20 },
									992: { slidesPerView: 2, spaceBetween: 30 },
									1024: { slidesPerView: 2.2, spaceBetween: 30 },
									1400: { slidesPerView: 2.31, spaceBetween: 30 },
								}}
								modules={[A11y, Pagination, Autoplay]}
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
					<ButtonPrimary text="Xem sơ đồ 2D" url={vuTru.path} />
					<PauseButton paused={autoplay.paused} onClick={autoplay.toggle} what="danh sách khu vực" />
				</div>
			</div>
		</section>
	);
};

export default Portfolios2;
