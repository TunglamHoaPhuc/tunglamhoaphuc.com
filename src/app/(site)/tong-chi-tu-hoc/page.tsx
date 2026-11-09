import type { Metadata } from "next";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import Services2 from "@/components/sections/services/Services2";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { tongChi } from "@/config/tongChi";
import { getContentRepository } from "@/libs/content/repository";
import { groupTongChi } from "@/libs/tongChiGroups";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

export const metadata: Metadata = {
	title: `${tongChi.title} – ${site.name}`,
	description: tongChi.intro[0],
};

// Tông Chỉ Tu Học: the old page's intro, then the five groups as Bexon's dark service cards
// beside a heading that stays in place, each card listing its articles. The heading's links
// lead to the groups (#tong-phong-truyen-thua …), which the articles also link to.
export default async function TongChiTuHoc() {
	const groups = groupTongChi(await (await getContentRepository()).listTongChi());
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={tongChi.title} text={tongChi.title} />
			<section className="section-gap tlhp-tong-chi-intro" aria-labelledby="tong-chi-mo-dau">
				<div className="container">
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-8">
							<h2 id="tong-chi-mo-dau" className="visually-hidden">
								Lời dẫn
							</h2>
							<p className="tlhp-section-lead">{tongChi.intro[0]}</p>
							{tongChi.intro.slice(1).map((paragraph) => (
								<p key={paragraph}>{paragraph}</p>
							))}
						</div>
					</div>
				</div>
			</section>
			<Services2 groups={groups} page />
			<Cta />
		</main>
	);
}
