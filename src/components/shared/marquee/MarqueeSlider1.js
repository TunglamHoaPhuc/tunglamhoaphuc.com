"use client";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

/**
 * Bexon's endless line of large outlined words, each followed by a small picture.
 * @param {{ items: { title: string, img: string }[] }} props
 */
const MarqueeSlider1 = ({ items }) => {
	return (
		<Swiper
			slidesPerView="auto"
			spaceBetween={0}
			freeMode={true}
			centeredSlides={true}
			loop={true}
			speed={7000}
			allowTouchMove={false}
			autoplay={{
				delay: 0,
				disableOnInteraction: false,
			}}
			className="marquee-slider"
			modules={[Autoplay]}
		>
			{items.map(({ img, title }, idx) => (
				<SwiperSlide key={idx} className="marquee-item">
					<h4 className="marquee-text">{title}</h4>
					<div className="marquee-img">
						<img src={img} alt="" />
					</div>
				</SwiperSlide>
			))}
		</Swiper>
	);
};

export default MarqueeSlider1;
