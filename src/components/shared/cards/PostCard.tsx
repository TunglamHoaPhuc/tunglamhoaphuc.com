import Link from "next/link";
import type { PostSummary } from "@/libs/content/types";
import { dateBadge, formatDate, formatNumber } from "@/libs/format";

type Props = {
	post: PostSummary;
	href: string;
	/** Link of the category chip (the list filtered to that category). */
	categoryHref: string;
};

// Bexon's blog card (`.blog-item`) as the TLHP post card (BRAND-GUIDELINES 5.2): 4:3
// picture with the date badge, then category chip, title and summary (3 lines each) and
// the date and views.
export default function PostCard({ post, href, categoryHref }: Props) {
	const badge = dateBadge(post.publishedDate);
	return (
		<article className="blog-item tlhp-post-card">
			<div className="blog-thumb">
				{/* Same target as the title link, so out of the tab order and screen readers. */}
				<Link href={href} tabIndex={-1} aria-hidden="true">
					{post.thumbnail ? (
						<img
							src={post.thumbnail.src}
							alt=""
							width={480}
							height={360}
							loading="lazy"
							decoding="async"
							style={{ objectPosition: post.thumbnail.position }}
						/>
					) : (
						<span className="tlhp-post-card-noimage" />
					)}
				</Link>
				<div className="blog-date" aria-hidden="true">
					<span className="date">{badge.day}</span>
					<span className="month">{badge.month}</span>
				</div>
			</div>
			<div className="blog-content">
				{post.category.name ? (
					<Link className="tlhp-chip" href={categoryHref}>
						{post.category.name}
					</Link>
				) : null}
				<h3 className="title h4">
					<Link href={href}>{post.title}</Link>
				</h3>
				{post.summary ? <p className="desc">{post.summary}</p> : null}
				<p className="tlhp-post-card-meta">
					<time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
					{post.views ? <span>{formatNumber(post.views)} lượt xem</span> : null}
				</p>
			</div>
		</article>
	);
}
