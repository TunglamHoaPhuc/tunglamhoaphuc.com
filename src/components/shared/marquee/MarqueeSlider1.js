import Marquee from "./Marquee";

/**
 * Bexon's endless line of large outlined words, each followed by a small picture. Pure
 * decoration: screen readers skip it, the pause button stays reachable.
 * @param {{ items: { title: string, img: string }[] }} props
 */
const MarqueeSlider1 = ({ items }) => {
	return (
		<Marquee what="chữ chạy cuối trang" seconds={16} viewClassName="marquee-slider" className="tlhp-marquee-slogan" decorative>
			{items.map(({ img, title }, idx) => (
				<li key={idx} className="marquee-item">
					<span className="marquee-text">{title}</span>
					<span className="marquee-img">
						<img src={img} alt="" loading="lazy" />
					</span>
				</li>
			))}
		</Marquee>
	);
};

export default MarqueeSlider1;
