import Link from "next/link";
import { book, tibetan } from "@/config/triTue";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { bookDetails } from "@/libs/triTue";

// Under the list of Trí Tuệ Phật Pháp: the book to read and the Tibetan course, the two
// reading rooms of the old site, in the look of the book beside a Giới thiệu topic.
export default async function StudyRooms() {
	const details = await bookDetails();
	return (
		<section className="section-gap pt-0 tlhp-study-rooms" aria-labelledby="sach-va-giao-trinh">
			<div className="container">
				<h2 id="sach-va-giao-trinh" className="tlhp-section-title">
					Sách và giáo trình
				</h2>
				<ul className="row row-gap-4 tlhp-study-grid">
					<li className="col-12 col-lg-6">
						<article className="tlhp-about-book tlhp-study-card">
							{details.cover ? <img src={imageAt(details.cover, IMAGE_WIDTH.small)} alt="" width={120} height={160} loading="lazy" decoding="async" /> : null}
							<div>
								<p className="tlhp-about-book-label">Sách · {book.volume}</p>
								<h3 className="tlhp-about-book-title">
									<Link href={book.path}>{book.title}</Link>
								</h3>
								<p className="tlhp-about-book-author">{book.author}</p>
								{details.description ? <p>{details.description}</p> : null}
							</div>
						</article>
					</li>
					<li className="col-12 col-lg-6">
						<article className="tlhp-about-book tlhp-study-card">
							<span className="tlhp-study-mark" lang="bo" aria-hidden="true">
								༄༅
							</span>
							<div>
								<p className="tlhp-about-book-label">Học thuật · Phật pháp</p>
								<h3 className="tlhp-about-book-title">
									<Link href={tibetan.path}>{tibetan.title}</Link>
								</h3>
								<p>{tibetan.lead}</p>
							</div>
						</article>
					</li>
				</ul>
			</div>
		</section>
	);
}
