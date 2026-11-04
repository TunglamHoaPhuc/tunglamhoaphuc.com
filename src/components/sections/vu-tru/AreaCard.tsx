import Link from "next/link";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { type AreaTeaser, areaHref } from "@/libs/vuTru";

type Props = { area: AreaTeaser };

// Bexon's project card (PortfolioCard3) as an area of the temple: its picture, its number on
// the map, its name and second name. Picture and arrow lead to the same page as the name;
// only the name is in the tab order.
export default function AreaCard({ area }: Props) {
	const href = areaHref(area.slug);
	return (
		<article className="project-item tlhp-area-card">
			<div className="project-img">
				<Link href={href} tabIndex={-1} aria-hidden="true">
					{area.cover ? (
						<img src={imageAt(area.cover.src, IMAGE_WIDTH.card)} alt="" width={640} height={420} loading="lazy" decoding="async" style={{ objectPosition: area.cover.position }} />
					) : (
						<span className="tlhp-post-card-noimage" />
					)}
				</Link>
			</div>
			<div className="project-content">
				<p className="tlhp-chip">Khu vực {area.number}</p>
				<div className="project-text">
					<h3 className="title h4">
						<Link href={href}>{area.name}</Link>
					</h3>
					<Link className="project-btn" href={href} tabIndex={-1} aria-hidden="true">
						<i className="tji-arrow-right-big"></i>
					</Link>
				</div>
				{area.subtitle ? <p className="tlhp-area-subtitle">{area.subtitle}</p> : null}
			</div>
		</article>
	);
}
