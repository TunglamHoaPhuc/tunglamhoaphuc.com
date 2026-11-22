"use client";
import TestimonialsCard2 from "@/components/shared/cards/TestimonialsCard2";
import SectionMark from "@/components/shared/others/SectionMark";
import SliderArrows from "@/components/shared/sliders/SliderArrows";
import QuoteCard from "@/components/home/QuoteCard";
import { shuffled } from "@/components/home/quoteOrder";
import { useAutoplay } from "@/hooks/useAutoplay";
import { useEffect, useState } from "react";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { A11y, Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const A11Y = {
	prevSlideMessage: "Câu kệ trước",
	nextSlideMessage: "Câu kệ kế tiếp",
	paginationBulletMessage: "Tới câu kệ {{index}}",
	slideLabelMessage: "Câu kệ {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "trình chiếu",
	itemRoleDescriptionMessage: "câu kệ",
};

/**
 * Bexon's testimonials as Lời Thầy dạy (plan.md, home block 9): the verses of the month
 * themes, this month's first, sliding by themselves (held under the pointer or keyboard focus, with arrows); beside them this
 * month's poster. The poster carries its own words ("Ân Đức Tổ Thầy"), so it shows whole,
 * with nothing laid over it: the title stands over the block and the month's theme is the
 * poster's caption (17/11/2026; Bexon's heading and rating box covered the poster's words).
 * When the admin chose its own quotations as the source (`quotes`), they take the place of the verses in
 * the slider: in the admin's order, or shuffled once the page is in the browser (so the page itself stays cacheable).
 * @param {{ verses: import("@/libs/content/types").MonthTheme[], quotes?: import("@/libs/home").HomeQuotes | null }} props
 */
const Testimonials2 = ({ verses, quotes }) => {
	const autoplay = useAutoplay();
	const [order, setOrder] = useState(null);
	useEffect(() => {
		// The shuffle can only happen in the browser: the server's copy keeps the admin's order, so both agree on first render.
		if (quotes?.mode === "ngau-nhien" && quotes.items.length > 1) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setOrder(shuffled(quotes.items));
		}
	}, [quotes]);
	const quoteItems = quotes?.items?.length ? (order ?? quotes.items) : null;
	if (!verses?.length && !quoteItems) return null;
	const current = verses?.[0];
	return (
		<section className="tj-testimonial-section-2 section-gap tlhp-verses" aria-labelledby="loi-thay-day" onFocus={autoplay.onFocus} onBlur={autoplay.onBlur}>
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading text-center style-2">
							<SectionMark icon="quote-chu-de" />
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								{quoteItems || !current ? "Lời dạy của Thầy" : `Chủ đề tháng ${current.month}`}
							</span>
							<h2 id="loi-thay-day" className="sec-title text-anim">
								Lời Thầy <span>dạy.</span>
							</h2>
						</div>
					</div>
				</div>
				<div className="row row-gap-3">
					{current ? (
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
					) : null}
					<div className={current ? "col-lg-6" : "col-lg-8 offset-lg-2"}>
						<div className="testimonial-wrapper wow fadeInUp" data-wow-delay=".5s">
							<Swiper
								key={order ? "shuffled" : "fixed"}
								onSwiper={autoplay.onSwiper}
								spaceBetween={28}
								slidesPerView={1}
								loop={(quoteItems ?? verses).length > 1}
								speed={1500}
								autoplay={{ delay: 9000, pauseOnMouseEnter: true, disableOnInteraction: false }}
								pagination={{ el: ".tlhp-verses-pagination", clickable: true }}
								navigation={{ prevEl: ".tlhp-verses-prev", nextEl: ".tlhp-verses-next" }}
								a11y={A11Y}
								modules={[A11y, Pagination, Autoplay, Navigation]}
								className="testimonial-slider-2"
							>
								{quoteItems
									? quoteItems.map((quote) => (
											<SwiperSlide key={quote.id}>
												<QuoteCard quote={quote} />
											</SwiperSlide>
										))
									: verses.map((verse) => (
											<SwiperSlide key={verse.month}>
												<TestimonialsCard2 verse={verse} />
											</SwiperSlide>
										))}
								<div className="swiper-pagination-area tlhp-verses-pagination"></div>
							</Swiper>
							<SliderArrows prevClass="tlhp-verses-prev" nextClass="tlhp-verses-next" prevLabel="Câu kệ trước" nextLabel="Câu kệ kế tiếp" className="tlhp-verses-arrows" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Testimonials2;
