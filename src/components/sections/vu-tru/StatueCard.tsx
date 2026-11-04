import Link from "next/link";
import type { StatueSummary } from "@/libs/content/types";
import { liveHref } from "@/libs/livePaths";

type Props = { statue: StatueSummary };

// A statue, in the look of the Giới thiệu cards (Bexon's team card): the upright picture,
// the name and the second name, leading to the statue's page.
export default function StatueCard({ statue }: Props) {
	const href = liveHref(statue.href);
	const picture = statue.image ? (
		<img src={statue.image.src} alt="" width={360} height={480} loading="lazy" decoding="async" style={{ objectPosition: statue.image.position }} />
	) : (
		<span className="tlhp-post-card-noimage" />
	);
	return (
		<article className="team-item tlhp-about-card tlhp-statue-card">
			<div className="team-img">
				<div className="team-img-inner">
					{href ? (
						<Link href={href} tabIndex={-1} aria-hidden="true">
							{picture}
						</Link>
					) : (
						picture
					)}
				</div>
			</div>
			<div className="team-content">
				<h3 className="title h5">{href ? <Link href={href}>{statue.name}</Link> : statue.name}</h3>
				{statue.subtitle ? <p className="designation">{statue.subtitle}</p> : null}
			</div>
		</article>
	);
}
