import Link from "next/link";
import type { AboutTopic } from "@/libs/content/types";

type Props = { topic: AboutTopic; headingLevel?: "h2" | "h3"; /** Extra classes, such as "left-swipe" inside Bexon's swing-in row. */ className?: string };

// Bexon's team card (TeamCard) as a topic of Giới thiệu: the upright 3:4 picture with its
// hover veil, the label, the title and the subtitle. Picture and title lead to the same page;
// only the title is in the tab order.
export default function AboutCard({ topic, headingLevel: Heading = "h3", className }: Props) {
	const href = `/gioi-thieu/${topic.slug}`;
	const picture = topic.portrait ?? topic.banner;
	return (
		<article className={className ? `team-item tlhp-about-card ${className}` : "team-item tlhp-about-card"}>
			<div className="team-img">
				<div className="team-img-inner">
					<Link href={href} tabIndex={-1} aria-hidden="true">
						{picture ? (
							<img
								src={picture.src}
								alt=""
								width={480}
								height={640}
								loading="lazy"
								decoding="async"
								style={{ objectPosition: picture.position }}
							/>
						) : (
							<span className="tlhp-post-card-noimage" />
						)}
					</Link>
				</div>
			</div>
			<div className="team-content">
				{topic.tag ? <p className="tlhp-chip">{topic.tag}</p> : null}
				<Heading className="title h4">
					<Link href={href}>{topic.title}</Link>
				</Heading>
				{topic.subtitle ? <p className="designation">{topic.subtitle}</p> : null}
			</div>
		</article>
	);
}
