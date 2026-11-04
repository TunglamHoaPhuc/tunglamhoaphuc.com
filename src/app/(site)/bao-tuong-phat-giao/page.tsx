import type { Metadata } from "next";
import StatueFilters from "@/components/sections/bao-tuong/StatueFilters";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import ListStatus from "@/components/sections/posts/ListStatus";
import StatueCard from "@/components/sections/vu-tru/StatueCard";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import NoItems from "@/components/shared/others/NoItems";
import PageLinks from "@/components/shared/others/PageLinks";
import { site } from "@/config/site";
import { areaOfStatue, filterStatues, KINDS, readStatueQuery, STATUE_PAGE_SIZE, type StatueQuery, statueListHref, STATUES_PATH } from "@/libs/baoTuong";
import { getContentRepository } from "@/libs/content/repository";
import { formatNumber } from "@/libs/format";
import { templeAreas } from "@/libs/vuTru";

const TITLE = "Bảo Tượng Phật Giáo";
const HEADING_ID = "danh-sach-ton-tuong";
// The old page's words.
const LEAD = "Hệ thống tượng pháp dát vàng, sơn son thếp vàng tôn thờ tại Tùng Lâm Hòa Phúc.";

export const metadata: Metadata = {
	title: `${TITLE} – ${site.name}`,
	description: LEAD,
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The statues as Bexon team cards, 24 to a page, filtered on the server (assembly, area,
// kind, name or code) by a form that works without JavaScript; every filter and page has its
// own address. The old page loaded all 109 pictures at once.
export default async function BaoTuongPhatGiao({ searchParams }: Props) {
	const query = readStatueQuery(await searchParams);
	const repo = await getContentRepository();
	const [statues, areas] = await Promise.all([repo.listStatues(), repo.listAreas()]);
	const href = (change: Partial<StatueQuery>) => statueListHref({ ...query, ...change });

	const assemblies = [...new Map(statues.filter((statue) => statue.assembly.slug).map((statue) => [statue.assembly.slug, statue.assembly])).values()];
	const areaOptions = templeAreas(areas).filter((area) => statues.some((statue) => areaOfStatue(statue) === area.slug));
	const filtered = !!(query.q || query.assembly || query.area || query.kind);

	const matching = filterStatues(statues, query);
	const pageCount = Math.max(1, Math.ceil(matching.length / STATUE_PAGE_SIZE));
	const items = matching.slice((query.page - 1) * STATUE_PAGE_SIZE, query.page * STATUE_PAGE_SIZE);
	const status = `${formatNumber(matching.length)} tôn tượng${filtered ? " phù hợp" : ""}${pageCount > 1 && query.page <= pageCount ? ` · trang ${query.page}/${pageCount}` : ""}`;

	let empty: { title: string; text?: string; navText: string; navUrl: string } | null = null;
	if (!matching.length) {
		empty = {
			title: "Không có tôn tượng phù hợp",
			text: "Kính mời quý vị bỏ bớt điều kiện lọc, hoặc tìm bằng tên khác (gõ không dấu cũng được) hay mã tượng như TP0001.",
			navText: "Bỏ lọc",
			navUrl: STATUES_PATH,
		};
	} else if (query.page > pageCount) {
		empty = { title: `Không có trang ${query.page}`, text: `Danh sách này có ${pageCount} trang.`, navText: "Về trang đầu", navUrl: href({ page: 1 }) };
	}

	return (
		<main>
			<HeaderSpace />
			<HeroInner title={TITLE} text={TITLE} />
			<section className="tj-team-section section-gap tlhp-statues" aria-labelledby={HEADING_ID}>
				<div className="container">
					<p className="tlhp-section-lead tlhp-vu-tru-lead">{LEAD}</p>
					<StatueFilters
						action={STATUES_PATH}
						values={{ q: query.q, assembly: query.assembly, area: query.area, kind: query.kind }}
						assemblies={assemblies.map((assembly) => ({ value: assembly.slug, label: assembly.name }))}
						areas={areaOptions.map((area) => ({ value: area.slug, label: area.name }))}
						kinds={KINDS.map((kind) => ({ value: kind.param, label: kind.label }))}
					/>

					<h2 id={HEADING_ID} className="visually-hidden" tabIndex={-1}>
						Danh sách tôn tượng
					</h2>
					<div className="tlhp-list-bar">
						<ListStatus text={status} page={query.page} headingId={HEADING_ID} />
					</div>

					{empty ? (
						<NoItems {...empty} />
					) : (
						<ul className="row row-gap-4 tlhp-statue-grid">
							{items.map((statue) => (
								<li key={statue.id} className="col-6 col-md-4 col-lg-3">
									<StatueCard statue={statue} />
								</li>
							))}
						</ul>
					)}
					{!empty ? <PageLinks page={query.page} pageCount={pageCount} hrefFor={(page) => href({ page })} /> : null}
				</div>
			</section>
			<Cta />
		</main>
	);
}
