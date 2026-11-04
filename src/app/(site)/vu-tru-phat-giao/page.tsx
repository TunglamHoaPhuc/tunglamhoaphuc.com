import type { Metadata } from "next";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import AreaCard from "@/components/sections/vu-tru/AreaCard";
import TempleMap from "@/components/sections/vu-tru/TempleMap";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { vuTru } from "@/config/vuTru";
import { getContentRepository } from "@/libs/content/repository";
import { templeAreas } from "@/libs/vuTru";

export const metadata: Metadata = {
	title: `${vuTru.title} – ${site.name}`,
	description: vuTru.lead,
};

// Vũ Trụ Phật Giáo: the 2D drawing of the temple with a pin on each area, then the same
// areas as Bexon project cards, numbered as on the map.
export default async function VuTruPhatGiao() {
	const areas = templeAreas(await (await getContentRepository()).listAreas());
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={vuTru.title} text={vuTru.title} />
			<section className="section-gap tlhp-vu-tru" aria-labelledby="so-do">
				<div className="container">
					<p className="tlhp-section-lead tlhp-vu-tru-lead">{vuTru.lead}</p>
					<h2 id="so-do" className="tlhp-section-title" tabIndex={-1}>
						Sơ đồ 2D
					</h2>
					<p className="tlhp-map-hint">Chọn một số trên sơ đồ để xem khu vực. Trên điện thoại, kéo sơ đồ sang hai bên để xem hết.</p>
					<TempleMap areas={areas} />
				</div>
			</section>
			<section className="tj-project-section section-gap pt-0 tlhp-areas" aria-labelledby="cac-khu-vuc">
				<div className="container">
					<h2 id="cac-khu-vuc" className="tlhp-section-title">
						{areas.length} khu vực
					</h2>
					<ol className="row row-gap-4 tlhp-area-grid">
						{areas.map((area) => (
							<li key={area.slug} className="col-12 col-md-6 col-lg-4">
								<AreaCard area={area} />
							</li>
						))}
					</ol>
				</div>
			</section>
			<Cta />
		</main>
	);
}
