import { dateBadge, formatDate, formatNumber } from "@/libs/format";
import { categoryHref, postHref } from "@/libs/postList";
import Link from "next/link";

/**
 * Bexon's wide blog card (picture beside the text) for a TLHP post: date badge, category
 * chip, title, date and views.
 * @param {{ post: import("@/libs/content/types").PostSummary }} props
 */
const BlogCard2 = ({ post }) => {
	const href = postHref(post);
	const badge = dateBadge(post.publishedDate);
	const picture = post.thumbnail ?? post.banner;
	return (
		<article className="blog-item style-2 tlhp-news-card">
			<div className="blog-thumb">
				{/* Same target as the title link below, so keep it out of the tab order and screen readers. */}
				<Link href={href} tabIndex={-1} aria-hidden="true">
					{picture ? (
						<img
							src={picture.src}
							alt=""
							width={480}
							height={540}
							loading="lazy"
							decoding="async"
							style={{ objectPosition: picture.position }}
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
				<div className="title-area">
					{post.category.name ? (
						<Link className="tlhp-chip" href={categoryHref(post)}>
							{post.category.name}
						</Link>
					) : null}
					<h3 className="title h4">
						<Link href={href}>{post.title}</Link>
					</h3>
				</div>
				<p className="tlhp-post-card-meta">
					<time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
					{post.views ? <span>{formatNumber(post.views)} lượt xem</span> : null}
				</p>
				{/* Bexon's "Read more"; the title is the link keyboards and screen readers use. */}
				<Link href={href} className="text-btn" tabIndex={-1} aria-hidden="true">
					<span className="btn-text">
						<span>Đọc bài</span>
					</span>
					<span className="btn-icon">
						<i className="tji-arrow-right-long"></i>
					</span>
				</Link>
			</div>
		</article>
	);
};

export default BlogCard2;
