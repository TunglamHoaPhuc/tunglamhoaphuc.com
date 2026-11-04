import Link from "next/link";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { areaHref } from "@/libs/vuTru";

/**
 * Bexon's large project slide as an area of the temple: its picture, then on hover or focus
 * its number, name and arrow (on phones these show at once).
 * @param {{ area: import("@/libs/vuTru").AreaTeaser }} props
 */
const PortfolioCard2 = ({ area }) => {
	const href = areaHref(area.slug);
	return (
		<article className="project-item tlhp-area-slide">
			<div className="project-img">
				{area.cover ? (
					<img src={imageAt(area.cover.src, IMAGE_WIDTH.card)} alt="" width={900} height={600} loading="lazy" decoding="async" style={{ objectPosition: area.cover.position }} />
				) : null}
			</div>
			<div className="project-content">
				<span className="categories">
					<span className="tlhp-chip">Khu vực {area.number}</span>
				</span>
				<div className="project-text">
					<h3 className="title">
						<Link href={href}>{area.name}</Link>
					</h3>
					{area.subtitle ? <p className="tlhp-area-subtitle">{area.subtitle}</p> : null}
					<Link className="project-btn" href={href} tabIndex={-1} aria-hidden="true">
						<i className="tji-arrow-right-big"></i>
					</Link>
				</div>
			</div>
		</article>
	);
};

export default PortfolioCard2;
