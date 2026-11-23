import "./PostExtras.css";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import type { PostExtra } from "@/libs/content/types";

/** A link an editor typed for a book: the site's own address or a web address, nothing else (no javascript:, no data:). */
export function safeBookLink(link: string | null): { href: string; external: boolean } | null {
	const value = (link ?? "").trim();
	if (/^\/(?!\/)/.test(value)) return { href: value, external: false };
	if (/^https?:\/\//i.test(value)) return { href: value, external: true };
	return null;
}

/**
 * What the post's category added to it, shown under its opening: the Pháp Âm sound with a player, the Ấn Phẩm & Sách book
 * with its cover, title and author. Video Phật Pháp needs nothing here: its video is in the post's videos.
 */
export default function PostExtras({ extra }: { extra: PostExtra }) {
	const { audio, book } = extra;
	if (!audio && !book) return null;
	const link = book ? safeBookLink(book.link) : null;
	return (
		<div className="tlhp-post-extras">
			{audio ? (
				<figure className="tlhp-post-audio">
					<figcaption>Nghe Pháp Âm{audio.duration ? ` · ${audio.duration}` : ""}</figcaption>
					<audio controls preload="none" src={audio.src}>
						Trình duyệt của bạn chưa phát được âm thanh này.
					</audio>
				</figure>
			) : null}
			{book ? (
				<aside className="tlhp-post-book" aria-label="Sách giới thiệu trong bài">
					{book.cover ? <img src={imageAt(book.cover, IMAGE_WIDTH.card)} alt="" width={120} height={170} loading="lazy" decoding="async" /> : null}
					<div className="tlhp-post-book-text">
						<p className="tlhp-post-book-label">Ấn phẩm &amp; Sách</p>
						{book.title ? <p className="tlhp-post-book-title">{book.title}</p> : null}
						{book.author ? <p className="tlhp-post-book-author">Tác giả: {book.author}</p> : null}
						{link ? (
							<a className="tlhp-chip" href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
								Xem sách
							</a>
						) : null}
					</div>
				</aside>
			) : null}
		</div>
	);
}
