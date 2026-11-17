import type { Metadata } from "next";
import Link from "next/link";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { TRI_TUE } from "@/config/sections";
import { site } from "@/config/site";
import { book, bookText, type BookSection } from "@/config/triTue";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { formatNumber } from "@/libs/format";
import { bookDetails, chapterAnchor, textBlocks } from "@/libs/triTue";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

const TITLE = `${book.title} (${book.volume})`;

export async function generateMetadata(): Promise<Metadata> {
	const { description } = await bookDetails();
	return { title: `${TITLE} – ${TRI_TUE.name} – ${site.name}`, description: description || undefined };
}

// The book at its old address, made on the server: its cover, who wrote it, what it is, its
// contents and its whole text as the old reader showed it (T17b), readable without JavaScript.
// The old page drew all of it in the browser.

/** One piece of the book: its title, page and author, then its paragraphs (a poem keeps its lines). */
function Piece({ section }: { section: BookSection }) {
	return (
		<section className={`tlhp-book-piece tlhp-book-piece--${section.type}`}>
			<h4 className="tlhp-book-piece-title">{section.title}</h4>
			<p className="tlhp-book-piece-meta">
				Trang {section.pageNumber}
				{section.author ? ` · ${section.author}` : ""}
			</p>
			{textBlocks(section.content).map((lines, index) => (
				<p key={index}>
					{lines.map((line, at) => (
						<span key={at}>
							{at > 0 ? <br /> : null}
							{line}
						</span>
					))}
				</p>
			))}
		</section>
	);
}
export default async function BookPage() {
	const details = await bookDetails();
	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={TITLE} text={TITLE} breadcrums={[{ name: TRI_TUE.name, path: TRI_TUE.path }]} />
			<article className="section-gap tlhp-article tlhp-book">
				<div className="container">
					<Link className="tlhp-back-link" href={TRI_TUE.path}>
						<i className="tji-arrow-left-long" aria-hidden="true"></i> Quay lại {TRI_TUE.name}
					</Link>
					<section className="row row-gap-4 tlhp-book-overview" aria-labelledby="ve-cuon-sach">
						<div className="col-8 col-sm-5 col-lg-4">
							{details.cover ? (
								<img
									className="tlhp-book-cover"
									src={imageAt(details.cover, IMAGE_WIDTH.card)}
									alt={`Bìa sách ${book.title}`}
									width={480}
									height={640}
									fetchPriority={topImagePriority(imageAt(details.cover, IMAGE_WIDTH.card))}
								/>
							) : null}
						</div>
						<div className="col-12 col-sm-7 col-lg-8">
							<p className="tlhp-about-book-label">Sách · {book.volume}</p>
							<h2 id="ve-cuon-sach" className="h3">
								{book.title}
							</h2>
							<dl className="tlhp-statue-facts">
								<div>
									<dt>Tác giả</dt>
									<dd>{book.author}</dd>
								</div>
								<div>
									<dt>Nhà xuất bản</dt>
									<dd>{book.publisher}</dd>
								</div>
								<div>
									<dt>Bản in</dt>
									<dd>{formatNumber(book.printedPages)} trang</dd>
								</div>
							</dl>
							{details.description ? <p className="tlhp-article-intro">{details.description}</p> : null}
							<div className="tlhp-article-actions">
								<ButtonPrimary text="Đọc toàn văn" url={book.readerUrl} />
								<Link className="tlhp-text-link" href={`${TRI_TUE.path}/${book.postSlug}`}>
									Bài giới thiệu sách
								</Link>
							</div>
						</div>
					</section>

					<section className="tlhp-article-section" aria-labelledby="muc-luc">
						<h2 id="muc-luc" className="tlhp-article-heading">
							Mục lục {book.volume} <span className="tlhp-article-count">{book.contents.length} chương mục</span>
						</h2>
						<ol className="tlhp-contents">
							{book.contents.map((entry, index) => (
								<li key={entry.title}>
									<a href={`#${chapterAnchor(index)}`}>{entry.title}</a>
									<span className="tlhp-contents-pages">Trang {entry.pages}</span>
								</li>
							))}
						</ol>
					</section>

					<section id="toan-van" className="tlhp-article-section tlhp-book-text" aria-labelledby="toan-van-tieu-de">
						<h2 id="toan-van-tieu-de" className="tlhp-article-heading">
							Toàn văn {book.volume}
						</h2>
						<p className="tlhp-book-text-note">Các bài thơ và bài viết của {book.volume}, như bản đọc văn bản của trang cũ.</p>
						{bookText.chapters.map((chapter, index) => (
							<section key={chapter.title} id={chapterAnchor(index)} className="tlhp-book-chapter" aria-labelledby={`${chapterAnchor(index)}-tieu-de`}>
								<p className="tlhp-book-chapter-pages">{chapter.pageRange}</p>
								<h3 id={`${chapterAnchor(index)}-tieu-de`}>{chapter.title}</h3>
								<figure className="tlhp-book-quote">
									<blockquote>
										<p>{chapter.quote}</p>
									</blockquote>
									<figcaption>— {chapter.quoteAuthor}</figcaption>
								</figure>
								{chapter.intro ? <p className="tlhp-article-intro">{chapter.intro}</p> : null}
								{chapter.sections.map((section) => (
									<Piece key={`${section.pageNumber}-${section.title}`} section={section} />
								))}
								<a className="tlhp-text-link" href="#muc-luc">
									Về mục lục
								</a>
							</section>
						))}
						<p className="tlhp-book-text-note">ISBN {bookText.isbn}</p>
					</section>
				</div>
			</article>
			<Cta />
		</main>
	);
}
