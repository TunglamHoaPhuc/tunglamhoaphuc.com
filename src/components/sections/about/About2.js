import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import FunfactSingle from "@/components/shared/funfact/FunfactSingle";
import PopupVideo from "@/components/shared/popup-video/PopupVideo";
import { site } from "@/config/site";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { youtubeEmbed } from "@/libs/video";

// What each figure counts, by the temple's own icon for it: posts of Dòng Chảy, works of Trí Tuệ, the Buddhist year.
const ICONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap", "lich-tu-hoc"];
// Bexon's grid places the figures around the greeting: one before it, two after the faces.
const ORDERS = ["order-lg-1 order-3", "order-lg-4 order-4", "order-lg-5 order-5"];

/**
 * One figure of Lời chào in Bexon's count-up box.
 * @param {{ stat: import("@/libs/home").HomeStat, index: number }} props
 */
const Figure = ({ stat, index }) => (
	<div className={`col-lg-4 col-md-6 ${ORDERS[index]}`}>
		<div className="countup-item style-2 wow fadeInUp" data-wow-delay={`.${1 + index * 2}s`}>
			<span className="count-icon" aria-hidden="true">
				<img src={`/brand/icons/icon-${ICONS[index]}.webp`} alt="" width={128} height={128} loading="lazy" decoding="async" />
			</span>
			<span className="steps" aria-hidden="true">
				0{index + 1}.
			</span>
			<div className="count-inner">
				<span className="count-text">{stat.label}</span>
				<FunfactSingle currentValue={stat.value} grouped={!stat.year} />
			</div>
		</div>
	</div>
);

/**
 * Bexon's about section as Lời chào (plan.md, home block 5): the teaching of the history
 * topic as the heading, its overview and link, the temple's own video, the teachers' faces,
 * and the figures counted up by the odometer (the real numbers are in the page).
 * @param {{ welcome: import("@/libs/home").Welcome | null }} props
 */
const About2 = ({ welcome }) => {
	if (!welcome) return null;
	const [first, ...rest] = welcome.stats;
	return (
		<section className="tj-about-section section-gap tlhp-welcome" aria-labelledby="loi-chao">
			<div className="container">
				<div className="row row-gap-4">
					{first ? <Figure stat={first} index={0} /> : null}
					<div className="col-lg-8 col-sm-12 order-lg-2 order-1">
						<div className="about-content-area-2 wow fadeInUp" data-wow-delay=".3s">
							<div className="about-content">
								<div className="sec-heading style-2">
									<span className="sub-title">Lời chào</span>
									<h2 id="loi-chao" className="sec-title title-highlight">
										{welcome.title}
									</h2>
									{welcome.author ? <p className="tlhp-welcome-author">— {welcome.author}</p> : null}
								</div>
								{welcome.text ? <p className="tlhp-welcome-text">{welcome.text}</p> : null}
								<div className="wow fadeInUp" data-wow-delay=".3s">
									<ButtonPrimary text={welcome.linkLabel || "Tìm hiểu Bổn tự"} url={welcome.href} isTextBtn={true} />
								</div>
							</div>
							<div className="video-img wow fadeInRight" data-wow-delay=".7s">
								{welcome.image ? (
									<img src={imageAt(welcome.image.src, IMAGE_WIDTH.card)} alt="" width={120} height={320} loading="lazy" decoding="async" style={{ objectPosition: welcome.image.position }} />
								) : null}
								<PopupVideo>
									<a className="video-btn video-popup glightbox" href={youtubeEmbed(welcome.videoId || site.introVideo.id)} data-type="external">
										<span aria-hidden="true">
											<i className="tji-play"></i>
										</span>
										<span className="visually-hidden">Xem video: {site.introVideo.title}</span>
									</a>
								</PopupVideo>
							</div>
						</div>
					</div>
					<div className="col-lg-4 col-md-6 order-lg-3 order-2">
						<div className="customers-box style-2 wow fadeInUp" data-wow-delay=".3s">
							{/* A lazy picture instead of Bexon's background, so the page does not fetch it up front;
							    phones already hold this crop from the hero. */}
							<div className="customers-bg">
								<img src={site.hero.image.portrait} alt="" width={760} height={1080} loading="lazy" decoding="async" />
							</div>
							<div className="customers" aria-hidden="true">
								<ul>
									{welcome.faces.map((face, idx) => (
										<li key={face.src} className="wow fadeInLeft" data-wow-delay={`.${3 + idx}s`}>
											<img src={imageAt(face.src, IMAGE_WIDTH.card)} alt="" width={60} height={60} loading="lazy" decoding="async" style={{ objectPosition: face.position }} />
										</li>
									))}
									<li className="wow fadeInLeft" data-wow-delay=".6s">
										<span>
											<i className="tji-plus"></i>
										</span>
									</li>
								</ul>
							</div>
							<p className="customers-text h6 wow fadeInLeft" data-wow-delay=".6s">
								Chư Tôn Đức dẫn dắt đạo tràng tu học Tịnh Độ.
							</p>
							<div className="star-icon zoomInOut" aria-hidden="true">
								<img src="/images/shape/star.svg" alt="" />
							</div>
						</div>
					</div>
					{rest.map((stat, idx) => (
						<Figure key={stat.label} stat={stat} index={idx + 1} />
					))}
				</div>
			</div>
		</section>
	);
};

export default About2;
