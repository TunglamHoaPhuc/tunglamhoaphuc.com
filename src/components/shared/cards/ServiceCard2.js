import Link from "next/link";
import { nameInGroup, tongChiHref } from "@/libs/tongChiGroups";

/**
 * Bexon's dark service card as one group of Tông Chỉ Tu Học: its icon, name and line, and
 * its articles as links. It slides in from the right while scrolled past
 * (tj-fadein-right-on-scroll; off under reduced motion).
 * @param {{ group: import("@/libs/tongChiGroups").TongChiGroup, headingLevel?: "h3" | "h2" }} props
 */
const ServiceCard2 = ({ group, headingLevel: Heading = "h3" }) => {
	const { name, line, icon, articles } = group;
	return (
		<div className="service-item-wrapper tj-fadein-right-on-scroll">
			<div className="service-item style-2">
				<div className="title-area">
					<div className="service-icon" aria-hidden="true">
						<i className={icon}></i>
					</div>
					<Heading className="title h4">{name}</Heading>
				</div>
				<div className="service-content">
					{line ? <p className="desc">{line}</p> : null}
					<ul className="list-items">
						{articles.map((article) => (
							<li key={article.id}>
								<i className="tji-list" aria-hidden="true"></i>
								<Link href={tongChiHref(article.slug)}>{nameInGroup(article)}</Link>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
};

export default ServiceCard2;
