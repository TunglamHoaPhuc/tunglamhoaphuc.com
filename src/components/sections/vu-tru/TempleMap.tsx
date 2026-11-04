import Link from "next/link";
import { vuTru } from "@/config/vuTru";
import { mediaUrl } from "@/libs/content/media";
import { areaHref, type MapArea } from "@/libs/vuTru";

type Props = {
	areas: MapArea[];
	/** Only this area's pin, as a mark rather than a link: the small map of an area page. */
	only?: string;
};

const MAP_SRC = mediaUrl(vuTru.map.src) as string;

// The 2D drawing of the temple with a numbered pin on each area (the old site's "Sơ đồ 2D").
// The pins are links in map order, 48px to touch, placed in % of the drawing so they stay
// on their building at any width. Below 992px the drawing keeps a size where the pins stay
// apart, and its frame scrolls sideways; the list of areas under it says the same in text.
//
// The drawing is lazy and never "high" priority, even at the top of /vu-tru-phat-giao: links
// fetch that page ahead, and React would then preload its 410 KB drawing on every page that
// has a link here (the menu does).
export default function TempleMap({ areas, only }: Props) {
	const pinned = areas.filter((area) => area.pin && (!only || area.slug === only));
	return (
		<div className={only ? "tlhp-map-frame tlhp-map-frame-small" : "tlhp-map-frame"}>
			<div className="tlhp-map" style={{ aspectRatio: `${vuTru.map.width} / ${vuTru.map.height}` }}>
				<img src={MAP_SRC} alt="Sơ đồ 2D khuôn viên Tùng Lâm Hòa Phúc" width={vuTru.map.width} height={vuTru.map.height} loading="lazy" decoding="async" />
				{only ? (
					pinned.map((area) => (
						<span key={area.slug} className="tlhp-map-pin is-current" style={{ left: `${area.pin!.x}%`, top: `${area.pin!.y}%` }} aria-hidden="true">
							<span className="tlhp-map-pin-dot">{area.number}</span>
						</span>
					))
				) : (
					<ol className="tlhp-map-pins" aria-label="Các khu vực trên sơ đồ">
						{pinned.map((area) => (
							<li key={area.slug} style={{ left: `${area.pin!.x}%`, top: `${area.pin!.y}%` }}>
								<Link className="tlhp-map-pin" href={areaHref(area.slug)}>
									<span className="tlhp-map-pin-dot" aria-hidden="true">
										{area.number}
									</span>
									<span className="tlhp-map-pin-label">
										<span className="visually-hidden">{area.number}. </span>
										{area.name}
									</span>
								</Link>
							</li>
						))}
					</ol>
				)}
			</div>
		</div>
	);
}
