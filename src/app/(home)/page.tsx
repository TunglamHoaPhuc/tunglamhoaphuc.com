import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Blogs2 from "@/components/sections/blogs/Blogs2";
import Brands2 from "@/components/sections/brands/Brands2";
import Hero2 from "@/components/sections/hero/Hero2";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import { type HomeData, loadHomeData } from "@/libs/home";

export const metadata: Metadata = {
	title: `${site.name} – ${site.slogan}`,
	description: site.intro,
};

type Block = { id: string; render: (data: HomeData) => ReactNode };

// The home page blocks, top to bottom, in the order decided in plan.md ("ưu tiên nội dung
// chùa"). A block joins the page with its task: one line here.
const BLOCKS: Block[] = [
	{ id: "hero", render: (data) => <Hero2 slides={data.hero} /> },
	{ id: "loi-vao", render: () => <Brands2 /> },
	// T12: khóa tu sắp tới (PricingPlan)
	{ id: "tin-tuc", render: (data) => <Blogs2 latest={data.latest} popular={data.popular} /> },
	// T13b: lời chào (About2) · T14: Tông Chỉ Tu Học (Services2) · T15: khu vực nổi bật (Portfolios2)
	// T14: lộ trình tu học (Process) · T12: Lời Thầy dạy (Testimonials2) · T13b: Chư Tôn Đức (Team1)
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
