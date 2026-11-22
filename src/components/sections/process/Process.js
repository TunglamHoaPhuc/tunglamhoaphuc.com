import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import ProcessCard from "@/components/shared/cards/ProcessCard";
import { tongChi } from "@/config/tongChi";
import { nameInGroup, tongChiHref } from "@/libs/tongChiGroups";
import SectionMark from "@/components/shared/others/SectionMark";

/**
 * Bexon's process as Lộ trình tu học (plan.md, home block 8): the articles of the lộ trình
 * group as numbered steps (người mới bắt đầu, người trẻ, người bận rộn, người chuyên tu).
 * @param {{ group: import("@/libs/tongChiGroups").TongChiGroup | undefined }} props
 */
const Process = ({ group }) => {
	if (!group?.articles.length) return null;
	return (
		<section className="tj-working-process section-gap section-gap-x tlhp-paths" aria-labelledby="lo-trinh-tieu-de">
			<div className="container">
				<div className="row">
					<div className="col-12">
						<div className="sec-heading-wrap">
							<SectionMark icon="tong-chi-tu-hoc" />
							<div className="heading-wrap-content">
								<div className="sec-heading style-2">
									<h2 id="lo-trinh-tieu-de" className="sec-title text-anim">
										Lộ trình <span>tu học</span>
									</h2>
								</div>
								<p className="desc wow fadeInUp" data-wow-delay=".5s">
									{tongChi.paths.line}
								</p>
								<div className="btn-wrap wow fadeInUp" data-wow-delay=".6s">
									<ButtonPrimary text="Xem các lộ trình" url={`${tongChi.path}#${group.slug}`} />
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="row">
					<div className="col-12">
						<ol className="working-process-area">
							{group.articles.map((article, idx) => (
								<ProcessCard key={article.id} step={{ title: nameInGroup(article), desc: article.excerpt, href: tongChiHref(article.slug) }} idx={idx} />
							))}
						</ol>
					</div>
				</div>
			</div>
			<div className="bg-shape-1" aria-hidden="true">
				<img src="/images/shape/pattern-2.webp" alt="" loading="lazy" />
			</div>
			<div className="bg-shape-2" aria-hidden="true">
				<img src="/images/shape/pattern-3.webp" alt="" loading="lazy" />
			</div>
		</section>
	);
};

export default Process;
