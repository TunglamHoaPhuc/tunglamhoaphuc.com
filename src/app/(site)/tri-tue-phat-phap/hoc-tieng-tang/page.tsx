import type { Metadata } from "next";
import Link from "next/link";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import Tibetan from "@/components/sections/tri-tue/Tibetan";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { TRI_TUE } from "@/config/sections";
import { site } from "@/config/site";
import { tibetan } from "@/config/triTue";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

export const metadata: Metadata = {
	title: `${tibetan.title} – ${TRI_TUE.name} – ${site.name}`,
	description: tibetan.lead,
};

// The Tibetan course at its old address, made on the server: what it is, what the study room
// offers and the lessons of the book, with the way into the room. The old page was an empty
// frame around the room (a separate app, still on the old site).
export default function HocTiengTang() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={tibetan.title} text={tibetan.title} breadcrums={[{ name: TRI_TUE.name, path: TRI_TUE.path }]} />
			<article className="section-gap tlhp-article tlhp-tibetan-course">
				<div className="container">
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							<Link className="tlhp-back-link" href={TRI_TUE.path}>
								<i className="tji-arrow-left-long" aria-hidden="true"></i> Quay lại {TRI_TUE.name}
							</Link>
							<section className="tlhp-article-section" aria-labelledby="gioi-thieu-khoa-hoc">
								<p className="tlhp-about-book-label">Học thuật · Phật pháp</p>
								<h2 id="gioi-thieu-khoa-hoc" className="h3">
									Giáo trình Sara Book, {tibetan.pages} trang
								</h2>
								<p className="tlhp-article-intro">{tibetan.lead}</p>
								<h3 className="h5">Trong phòng học</h3>
								<ul className="tlhp-feature-list">
									{tibetan.features.map((feature) => (
										<li key={feature}>{feature}</li>
									))}
								</ul>
								<div className="tlhp-article-actions">
									<ButtonPrimary text="Vào học ngay" url={tibetan.appUrl} newTab />
								</div>
							</section>

							<section className="tlhp-article-section" aria-labelledby="muc-luc">
								<h2 id="muc-luc" className="tlhp-article-heading">
									Mục lục giáo trình <span className="tlhp-article-count">{tibetan.contents.filter((entry) => entry.title.startsWith("Bài ")).length} bài</span>
								</h2>
								<ol className="tlhp-contents">
									{tibetan.contents.map((entry) => (
										<li key={entry.title}>
											<span>
												<Tibetan text={entry.title} />
											</span>
											<span className="tlhp-contents-pages">Trang {entry.pages}</span>
										</li>
									))}
								</ol>
							</section>
						</div>
					</div>
				</div>
			</article>
			<Cta />
		</main>
	);
}
