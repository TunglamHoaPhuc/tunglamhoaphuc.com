import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import About2 from "@/components/sections/about/About2";
import Blogs2 from "@/components/sections/blogs/Blogs2";
import Brands2 from "@/components/sections/brands/Brands2";
import Hero2 from "@/components/sections/hero/Hero2";
import Portfolios2 from "@/components/sections/portfolios/Portfolios2";
import PricingPlan from "@/components/sections/pricing-plan/PricingPlan";
import Process from "@/components/sections/process/Process";
import Services2 from "@/components/sections/services/Services2";
import Team1 from "@/components/sections/teams/Team1";
import Testimonials2 from "@/components/sections/testimonials/Testimonials2";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import { type HomeData, loadHomeData } from "@/libs/home";

export const metadata: Metadata = {
	title: `${site.name} – ${site.slogan}`,
	description: site.intro,
};

// The countdowns ("Còn 3 ngày"), the next retreat and the month's verse follow the day in
// Vietnam, so the page is made for each visit. vinext would otherwise take it for static
// (it reads no request data) and serve the first copy for a year.
export const dynamic = "force-dynamic";

type Block = { id: string; render: (data: HomeData) => ReactNode };

// The home page blocks, top to bottom, in the order decided in plan.md ("ưu tiên nội dung
// chùa"). A block joins the page with its task: one line here.
const BLOCKS: Block[] = [
	{ id: "hero", render: (data) => <Hero2 slides={data.hero} /> },
	{ id: "loi-vao", render: () => <Brands2 /> },
	{ id: "khoa-tu", render: (data) => <PricingPlan events={data.upcoming} /> },
	{ id: "tin-tuc", render: (data) => <Blogs2 latest={data.latest} popular={data.popular} /> },
	{ id: "loi-chao", render: (data) => <About2 welcome={data.welcome} /> },
	{ id: "tong-chi", render: (data) => <Services2 groups={data.tongChi} /> },
	{ id: "khu-vuc", render: (data) => <Portfolios2 areas={data.areas} /> },
	{ id: "lo-trinh", render: (data) => <Process group={data.paths ?? undefined} /> },
	{ id: "loi-thay-day", render: (data) => <Testimonials2 verses={data.verses} /> },
	{ id: "chu-ton-duc", render: (data) => <Team1 members={data.teachers} /> },
];

export default async function Home() {
	const data = await loadHomeData(await getContentRepository());
	return (
		<main>
			<div className="top-space-15"></div>
			{BLOCKS.map((block) => (
				<Fragment key={block.id}>{block.render(data)}</Fragment>
			))}
		</main>
	);
}
