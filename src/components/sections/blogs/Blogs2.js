"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import BlogCard2 from "@/components/shared/cards/BlogCard2";
import PauseButton from "@/components/shared/sliders/PauseButton";
import { useAutoplay } from "@/hooks/useAutoplay";
import { useRef, useState } from "react";
import { A11y, Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const A11Y = {
	prevSlideMessage: "Bài trước",
	nextSlideMessage: "Bài sau",
	paginationBulletMessage: "Tới bài {{index}}",
	slideLabelMessage: "Bài {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "danh sách trượt",
	itemRoleDescriptionMessage: "bài",
};

/**
 * Bexon's blog slider as the home news block (plan.md, home block 4): two tabs, Tin mới
 * nhất and Dấu ấn hoằng pháp (most read), over one self-moving slider with a pause button.
 * @param {{ latest: import("@/libs/content/types").PostSummary[], popular: import("@/libs/content/types").PostSummary[] }} props
 */
const Blogs2 = ({ latest, popular }) => {
	const tabs = [
		{ id: "tin-moi-nhat", label: "Tin mới nhất", icon: "/brand/icons/icon-tin-moi-nhat.webp", posts: latest },
		{ id: "dau-an-hoang-phap", label: "Dấu ấn hoằng pháp", icon: "/brand/icons/icon-dau-an-hoang-phap.webp", posts: popular },
	].filter((tab) => tab.posts.length);
	const [selected, setSelected] = useState(0);
	const tabRefs = useRef([]);
	const autoplay = useAutoplay();
	if (!tabs.length) return null;
	const current = tabs[Math.min(selected, tabs.length - 1)];

	// Arrow keys, Home and End move between tabs (WAI tabs pattern, selection follows focus).
	const onTabKeyDown = (event) => {
		const last = tabs.length - 1;
		const next = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: last }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		const index = next < 0 ? last : next > last ? 0 : next;
		setSelected(index);
		tabRefs.current[index]?.focus();
	};

	return (
		<section className="tj-blog-section-2 section-gap tlhp-news" aria-labelledby="tin-tuc-title" onFocus={autoplay.onFocus}>
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading-wrap">
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								Dòng Chảy Hoằng Pháp
							</span>
							<div className="heading-wrap-content">
								<div className="sec-heading style-2">
									<h2 id="tin-tuc-title" className="sec-title text-anim">
										Tin tức <span>hoằng pháp.</span>
									</h2>
								</div>
								<div className="wow fadeInUp" data-wow-delay=".5s">
									<p className="desc">Pháp sự, khóa lễ, cộng tu và các đại lễ tại Tùng Lâm Hòa Phúc.</p>
								</div>
								<div className="slider-navigation d-none d-md-inline-flex wow fadeInUp" data-wow-delay=".7s">
									<button type="button" className="slider-prev tlhp-news-prev" aria-label="Bài trước">
										<span className="anim-icon" aria-hidden="true">
											<i className="tji-arrow-left"></i>
											<i className="tji-arrow-left"></i>
										</span>
									</button>
									<button type="button" className="slider-next tlhp-news-next" aria-label="Bài sau">
										<span className="anim-icon" aria-hidden="true">
											<i className="tji-arrow-right"></i>
											<i className="tji-arrow-right"></i>
										</span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="tlhp-news-bar">
					<div className="tlhp-news-tabs" role="tablist" aria-label="Chọn danh sách bài">
						{tabs.map((tab, idx) => (
							<button
								key={tab.id}
								ref={(el) => {
									tabRefs.current[idx] = el;
								}}
								type="button"
								role="tab"
								id={`tab-${tab.id}`}
								className="tlhp-news-tab"
								aria-selected={tab === current}
								aria-controls="tin-tuc-bai"
								tabIndex={tab === current ? 0 : -1}
								onClick={() => setSelected(idx)}
								onKeyDown={onTabKeyDown}
							>
								<span className="tlhp-brand-icon" aria-hidden="true">
									<img src={tab.icon} alt="" width={128} height={128} loading="lazy" decoding="async" />
								</span>
								{tab.label}
							</button>
						))}
					</div>
					<PauseButton paused={autoplay.paused} onClick={autoplay.toggle} what="danh sách bài" />
				</div>
				<div className="row">
					<div className="col-12">
						<div id="tin-tuc-bai" className="blog-wrapper" role="tabpanel" aria-labelledby={`tab-${current.id}`}>
							{/* A new slider for each tab, so it starts from the first post. */}
							<Swiper
								key={current.id}
								onSwiper={autoplay.onSwiper}
								slidesPerView={1}
								spaceBetween={15}
								loop={current.posts.length > 3}
								speed={1500}
								autoplay={{ delay: 7000, pauseOnMouseEnter: true, disableOnInteraction: false }}
								pagination={{ el: ".tlhp-news-pagination", clickable: true }}
								navigation={{ nextEl: ".tlhp-news-next", prevEl: ".tlhp-news-prev" }}
								a11y={A11Y}
								breakpoints={{
									768: { spaceBetween: 20, slidesPerView: 1 },
									992: { slidesPerView: 2, spaceBetween: 20 },
									1200: { slidesPerView: 2, spaceBetween: 30 },
								}}
								modules={[A11y, Pagination, Autoplay, Navigation]}
								className="blog-slider"
							>
								{current.posts.map((post) => (
									<SwiperSlide key={post.id}>
										<BlogCard2 post={post} />
									</SwiperSlide>
								))}
								<div className="swiper-pagination-area tlhp-news-pagination"></div>
							</Swiper>
						</div>
						<div className="tlhp-news-more">
							<ButtonPrimary text="Xem tất cả bài viết" url="/dong-chay-hoang-phap" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Blogs2;
