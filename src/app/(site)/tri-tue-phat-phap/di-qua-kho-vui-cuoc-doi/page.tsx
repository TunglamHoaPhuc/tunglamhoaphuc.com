import type { Metadata } from "next";
import Link from "next/link";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { TRI_TUE } from "@/config/sections";
import { site } from "@/config/site";
import { book } from "@/config/triTue";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { formatNumber } from "@/libs/format";
import { bookDetails } from "@/libs/triTue";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

const TITLE = `${book.title} (${book.volume})`;

export async function generateMetadata(): Promise<Metadata> {
	const { description } = await bookDetails();
	return { title: `${TITLE} – ${TRI_TUE.name} – ${site.name}`, description: description || undefined };
}

// The book at its old address, made on the server: its cover, who wrote it, what it is and
// its contents, with the way to the old site's reader (the whole text, and the book to leaf
// through). The old page drew all of it in the browser.
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
								<ButtonPrimary text="Đọc toàn văn" url={book.readerUrl} newTab />
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
							{book.contents.map((entry) => (
								<li key={entry.title}>
									<span>{entry.title}</span>
									<span className="tlhp-contents-pages">Trang {entry.pages}</span>
								</li>
							))}
						</ol>
					</section>
				</div>
			</article>
			<Cta />
		</main>
	);
}
