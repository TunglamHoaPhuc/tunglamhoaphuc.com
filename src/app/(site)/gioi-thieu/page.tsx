import type { Metadata } from "next";
import AboutCard from "@/components/sections/about/AboutCard";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import type { AboutTopic, Category } from "@/libs/content/types";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;

const TITLE = "Giới thiệu";
// The old site's words for this page.
const LEAD = "Chốn già lam thanh tịnh – Nơi hội tụ truyền thống truyền thừa, tâm nguyện độ sanh và tinh hoa văn hóa Phật giáo Việt Nam.";

export const metadata: Metadata = {
	title: `${TITLE} – ${site.name}`,
	description: LEAD,
};

/** Topics by group, the groups in the order their first topic comes. */
function byGroup(topics: AboutTopic[]): { group: Category; topics: AboutTopic[] }[] {
	const groups = new Map<string, { group: Category; topics: AboutTopic[] }>();
	for (const topic of topics) {
		const entry = groups.get(topic.group.slug) ?? { group: topic.group, topics: [] };
		entry.topics.push(topic);
		groups.set(topic.group.slug, entry);
	}
	return [...groups.values()];
}

// Giới thiệu: the six topics as Bexon team cards, in their three groups. Each group heading
// is an anchor (the menu's Chư Tôn Đức leads to #nguoi-lien-quan).
export default async function GioiThieu() {
	const groups = byGroup(await (await getContentRepository()).listAboutTopics());
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={TITLE} text={TITLE} />
			<section className="tj-team-section section-gap tlhp-about-list" aria-labelledby="gioi-thieu-mo-dau">
				<div className="container">
					<p id="gioi-thieu-mo-dau" className="tlhp-section-lead tlhp-about-lead">
						{LEAD}
					</p>
					{groups.map(({ group, topics }) => (
						<section key={group.slug} id={group.slug || undefined} className="tlhp-about-group" aria-labelledby={`nhom-${group.slug}`} tabIndex={-1}>
							<h2 id={`nhom-${group.slug}`} className="tlhp-section-title">
								{group.name || TITLE}
							</h2>
							<ul className="row row-gap-4">
								{topics.map((topic) => (
									<li key={topic.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
										<AboutCard topic={topic} />
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</section>
			<Cta />
		</main>
	);
}
