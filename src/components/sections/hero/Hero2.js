"use client";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import PauseButton from "@/components/shared/sliders/PauseButton";
import { useAutoplay } from "@/hooks/useAutoplay";
import { useState } from "react";
import { A11y, Autoplay, EffectFade, Navigation, Thumbs } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

// Swiper's screen reader messages, in Vietnamese.
const A11Y = {
	prevSlideMessage: "Khung trước",
	nextSlideMessage: "Khung sau",
	slideLabelMessage: "Khung {{index}}/{{slidesLength}}",
	containerRoleDescriptionMessage: "trình chiếu",
	itemRoleDescriptionMessage: "khung",
};

// Phones held upright get the narrow crop of the first picture.
const PORTRAIT = "(orientation: portrait) and (max-width: 767px)";

/**
 * The picture behind a frame, as an <img> rather than Bexon's CSS background so the first
 * one is fetched early, in the size the screen needs.
 * @param {{ image: import("@/libs/home").HeroImage, first: boolean }} props
 */
const HeroPicture = ({ image, first }) => (
	<picture className="slider-bg-image">
		{/* React moves these into <head>, so the first picture is asked for before the CSS and
		    fonts are in; each screen fetches only the one its <source> will pick. */}
		{first && image.portrait ? (
			<link rel="preload" as="image" href={image.portrait} media={PORTRAIT} fetchPriority="high" />
		) : null}
		{first ? (
			<link
				rel="preload"
				as="image"
				href={image.src}
				imageSrcSet={image.srcSet}
				imageSizes={image.srcSet ? "100vw" : undefined}
				media={image.portrait ? `not all and ${PORTRAIT}` : undefined}
				fetchPriority="high"
			/>
		) : null}
		{image.portrait ? <source media={PORTRAIT} srcSet={image.portrait} /> : null}
		<img
			src={image.src}
			srcSet={image.srcSet}
			sizes={image.srcSet ? "100vw" : undefined}
			alt=""
			fetchPriority={first ? "high" : "low"}
			loading={first ? "eager" : "lazy"}
			decoding={first ? "sync" : "async"}
			style={{ objectPosition: image.position }}
		/>
	</picture>
);

/**
 * Bexon's home slider with the temple's frames (plan.md, home block 1): "Nơi để trở về",
 * the next retreat with the days left, and the latest ceremony. Each frame stays 7 seconds, with
 * a pause button; the slider also stops when focus moves into it and holds under the
 * pointer.
 * @param {{ slides: import("@/libs/home").HeroSlide[] }} props
 */
const Hero2 = ({ slides }) => {
	const [thumbs, setThumbs] = useState(null);
	const autoplay = useAutoplay();
	return (
		<section className="tj-slider-section tlhp-hero" aria-label="Trình chiếu đầu trang" onFocus={autoplay.onFocus}>
			<h1 className="visually-hidden">Tùng Lâm Hòa Phúc – Nơi để trở về, chốn thiêng bình yên</h1>
			<Swiper
				onSwiper={autoplay.onSwiper}
				slidesPerView={1}
				spaceBetween={0}
				rewind={true}
				effect="fade"
				fadeEffect={{ crossFade: true }}
				speed={1400}
				autoplay={{ delay: 7000, pauseOnMouseEnter: true, disableOnInteraction: false }}
				modules={[A11y, Autoplay, Navigation, EffectFade, Thumbs]}
				a11y={A11Y}
				thumbs={{ swiper: thumbs && !thumbs.destroyed ? thumbs : null }}
				navigation={{ nextEl: ".tlhp-hero-next", prevEl: ".tlhp-hero-prev" }}
				className="hero-slider"
				style={{ height: "100%" }}
			>
				{slides.map((slide, idx) => (
					<SwiperSlide key={slide.id} className="tj-slider-item" style={{ height: "auto" }}>
						<HeroPicture image={slide.image} first={idx === 0} />
						<div className="container">
							<div className="slider-wrapper">
								<div className="slider-content">
									{slide.overline ? <p className="tlhp-hero-overline">{slide.overline}</p> : null}
									<h2 className={slide.subtitle ? "slider-title" : "slider-title tlhp-hero-post-title"}>
										{slide.accent && slide.title.endsWith(slide.accent) ? (
											<>
												{slide.title.slice(0, -slide.accent.length)}
												<span>{slide.accent}</span>
											</>
										) : (
											slide.title
										)}
										{slide.subtitle ? <span className="tlhp-hero-subtitle">{slide.subtitle}</span> : null}
									</h2>
									{slide.text ? <div className="slider-desc">{slide.text}</div> : null}
									<div className="slider-btn">
										<ButtonPrimary text={slide.link.label} url={slide.link.href} />
									</div>
								</div>
							</div>
						</div>
					</SwiperSlide>
				))}

				{slides.length > 1 ? (
					<div className="hero-navigation d-inline-flex wow fadeIn" data-wow-delay="1.5s">
						<button type="button" className="slider-prev tlhp-hero-prev" aria-label="Khung trước">
							<span className="anim-icon" aria-hidden="true">
								<i className="tji-arrow-left"></i>
								<i className="tji-arrow-left"></i>
							</span>
						</button>
						<button type="button" className="slider-next tlhp-hero-next" aria-label="Khung sau">
							<span className="anim-icon" aria-hidden="true">
								<i className="tji-arrow-right"></i>
								<i className="tji-arrow-right"></i>
							</span>
						</button>
					</div>
				) : null}
			</Swiper>

			{slides.length > 1 ? (
				<div className="tlhp-hero-bar wow fadeIn" data-wow-delay="2s" style={{ "--tlhp-thumbs": slides.length }}>
					{/* Small pictures for the mouse; keyboards and screen readers use the buttons. */}
					<Swiper
						onSwiper={setThumbs}
						slidesPerView="auto"
						spaceBetween={15}
						watchSlidesProgress={true}
						modules={[Thumbs]}
						className="hero-thumb"
						aria-hidden="true"
					>
						{slides.map((slide) => (
							<SwiperSlide key={slide.id} className="thumb-item">
								<img src={slide.image.thumb} alt="" width={80} height={80} loading="lazy" decoding="async" />
							</SwiperSlide>
						))}
					</Swiper>
					<PauseButton paused={autoplay.paused} onClick={autoplay.toggle} what="trình chiếu đầu trang" />
				</div>
			) : null}

			<div className="circle-text-wrap wow fadeInUp" data-wow-delay="1s">
				{/* Bexon's turning ring of words, written out in the temple's slogan. */}
				<svg className="circle-text tlhp-circle-text" viewBox="0 0 160 160" aria-hidden="true">
					<defs>
						<path id="tlhp-hero-ring" d="M80,80 m-64,0 a64,64 0 1,1 128,0 a64,64 0 1,1 -128,0" />
					</defs>
					<text>
						<textPath href="#tlhp-hero-ring" textLength="400" lengthAdjust="spacing">
							NƠI ĐỂ TRỞ VỀ • CHỐN THIÊNG BÌNH YÊN •
						</textPath>
					</text>
				</svg>
				<a className="circle-icon" href="#loi-vao" aria-label="Xem tiếp">
					<i className="tji-arrow-down-big" aria-hidden="true"></i>
				</a>
			</div>
		</section>
	);
};

export default Hero2;
