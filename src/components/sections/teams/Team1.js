import AboutCard from "@/components/sections/about/AboutCard";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import SectionMark from "@/components/shared/others/SectionMark";

/**
 * Bexon's team section as Chư Tôn Đức (plan.md, home block 10): the teachers of the
 * "nguoi-lien-quan" group of Giới thiệu, each card leading to its topic page. The cards
 * swing in from the left when scrolled to (tjLeftSwipeAnimation; off under reduced motion).
 * @param {{ members?: import("@/libs/content/types").AboutTopic[] }} props
 */
const Team1 = ({ members = [] }) => {
	if (!members.length) return null;
	return (
		<section className="tj-team-section section-separator tlhp-teachers" aria-labelledby="chu-ton-duc">
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading text-center style-2">
							<SectionMark icon="phap-am" />
							<span className="sub-title wow fadeInUp" data-wow-delay=".3s">
								Giới thiệu
							</span>
							<h2 id="chu-ton-duc" className="sec-title text-anim">
								Chư Tôn <span>Đức.</span>
							</h2>
						</div>
					</div>
				</div>
				<ul className="row row-gap-4 leftSwipeWrap">
					{members.map((topic) => (
						<li key={topic.id} className="col-lg-3 col-sm-6">
							<AboutCard topic={topic} className="left-swipe" />
						</li>
					))}
				</ul>
				<div className="team-btn mt-40 text-center wow fadeInUp" data-wow-delay="0.9s">
					<ButtonPrimary text="Xem thêm về Bổn tự" url="/gioi-thieu" />
				</div>
			</div>
		</section>
	);
};

export default Team1;
