"use client";
import TestimonialsCard2 from "@/components/shared/cards/TestimonialsCard2";
import SectionMark from "@/components/shared/others/SectionMark";
import PauseButton from "@/components/shared/sliders/PauseButton";
import { useAutoplay } from "@/hooks/useAutoplay";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { A11y, Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const A11Y = {
	paginationBulletMessage: "Tới câu kệ {{index}}",
	slideLabelMessage: "Câu kệ {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "trình chiếu",
	itemRoleDescriptionMessage: "câu kệ",
};

/**
 * Bexon's testimonials as Lời Thầy dạy (plan.md, home block 9): the verses of the month
 * themes, this month's first, sliding by themselves with a pause button; beside them this
 * month's poster. The poster carries its own words ("Ân Đức Tổ Thầy"), so it shows whole,
 * with nothing laid over it: the title stands over the block and the month's theme is the
 * poster's caption (17/11/2026; Bexon's heading and rating box covered the poster's words).
 * @param {{ verses: import("@/libs/content/types").MonthTheme[] }} props
 */
const Testimonials2 = ({ verses }) => {
	const autoplay = useAutoplay();
	if (!verses?.length) return null;
	const current = verses[0];
	return (
		<section className="tj-testimonial-section-2 section-gap tlhp-verses" aria-labelledby="loi-thay-day" onFocus={autoplay.onFocus}>
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading text-center style-2">
							<SectionMark icon="quote-chu-de" />
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								Chủ đề tháng {current.month}
							</span>
							<h2 id="loi-thay-day" className="sec-title text-anim">
								Lời Thầy <span>dạy.</span>
							</h2>
						</div>
					</div>
				</div>
				<div className="row row-gap-3">
					<div className="col-lg-6">
						<figure className="tlhp-verses-poster wow fadeInUp" data-wow-delay=".3s">
							{current.poster ? <img src={imageAt(current.poster, IMAGE_WIDTH.wide)} alt="" width={1200} height={1015} loading="lazy" decoding="async" /> : null}
							<figcaption>
								<span className="tlhp-verses-month" aria-hidden="true">
									{String(current.month).padStart(2, "0")}
								</span>
								<span className="tlhp-verses-theme">
									Chủ đề tháng {current.month}
									{current.title ? `: ${current.title}` : ""}
								</span>
							</figcaption>
						</figure>
					</div>
					<div className="col-lg-6">
						<div className="testimonial-wrapper wow fadeInUp" data-wow-delay=".5s">
							<Swiper
								onSwiper={autoplay.onSwiper}
								spaceBetween={28}
								slidesPerView={1}
								loop={verses.length > 1}
								speed={1500}
								autoplay={{ delay: 9000, pauseOnMouseEnter: true, disableOnInteraction: false }}
								pagination={{ el: ".tlhp-verses-pagination", clickable: true }}
								a11y={A11Y}
								modules={[A11y, Pagination, Autoplay]}
								className="testimonial-slider-2"
							>
								{verses.map((verse) => (
									<SwiperSlide key={verse.month}>
										<TestimonialsCard2 verse={verse} />
									</SwiperSlide>
								))}
								<div className="swiper-pagination-area tlhp-verses-pagination"></div>
							</Swiper>
							<PauseButton paused={autoplay.paused} onClick={autoplay.toggle} what="lời Thầy dạy" className="tlhp-verses-pause" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Testimonials2;
