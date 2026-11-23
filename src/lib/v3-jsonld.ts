// Dữ liệu có cấu trúc (JSON-LD) cho máy tìm kiếm: ngôi chùa (Organization/BuddhistTemple, Place), bài viết (Article), sự kiện
// (Event) và đường dẫn (BreadcrumbList). Chép từ src/libs/seo.ts của www, thay `site` bằng hằng số TEMPLE bên dưới (V3 chưa có
// tệp cấu hình site; số điện thoại và địa chỉ khớp src/config/site.ts của www). Mọi địa chỉ là địa chỉ công khai tuyệt đối.
//
// Phần dựng là hàm thuần để kiểm thử không cần D1; `postJsonLdFor` và `eventJsonLdFor` đọc kho nội dung giống v3-seo.ts.
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { ContentRepository, Post, ScheduleEvent } from "@/lib/tlhp-content/types";
import { absoluteUrl, PUBLIC_ORIGIN, SITE_NAME } from "@/lib/site-url";

/** Thông tin ngôi chùa dùng cho dữ liệu có cấu trúc (khớp src/config/site.ts của www). */
export const TEMPLE = {
	name: SITE_NAME,
	alternateName: "Chùa Tùng Lâm Hòa Phúc",
	slogan: "Nơi để trở về – Chốn thiêng bình yên",
	intro: "Chốn tu học và lễ bái giữa đất trời Phú Cát, kính mời quý Phật tử gần xa về tham dự khóa tu, cộng tu và các đại lễ trong năm.",
	phone: "0979345373",
	logo: "/brand/logo-moc-an.webp",
	image: "/brand/og-tung-lam-hoa-phuc.jpg",
	mapsUrl: "https://maps.app.goo.gl/PSTtcjcJsaXvLCp37",
	address: { "@type": "PostalAddress", streetAddress: "Thôn Hòa Trúc", addressLocality: "Xã Phú Cát", addressRegion: "Hà Nội", addressCountry: "VN" },
	openingHours: ["Mo-Fr 07:30-10:30", "Mo-Fr 13:30-17:30"],
} as const;

/** Ngôi chùa như một tổ chức và một địa điểm, cho trang chủ. */
export function organizationJsonLd(origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": ["Organization", "BuddhistTemple"],
		"@id": `${origin}/#chua`,
		name: TEMPLE.name,
		alternateName: TEMPLE.alternateName,
		slogan: TEMPLE.slogan,
		description: TEMPLE.intro,
		url: absoluteUrl("/", origin),
		logo: absoluteUrl(TEMPLE.logo, origin),
		image: absoluteUrl(TEMPLE.image, origin),
		telephone: `+84${TEMPLE.phone.replace(/^0/, "")}`,
		address: TEMPLE.address,
		openingHours: TEMPLE.openingHours,
		hasMap: TEMPLE.mapsUrl,
	};
}

/** Cùng ngôi chùa như một `Place`, cho trang Liên hệ. */
export function placeJsonLd(origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": "Place",
		name: `${TEMPLE.name} – Vũ Trụ Phật Giáo`,
		address: TEMPLE.address,
		hasMap: TEMPLE.mapsUrl,
		url: absoluteUrl("/lien-he", origin),
	};
}

type ArticleLike = Pick<Post, "title" | "summary" | "author" | "publishedDate" | "banner" | "thumbnail">;

/** Một bài của Dòng Chảy hay Trí Tuệ; `path` là trang riêng của nó. */
export function articleJsonLd(post: ArticleLike, path: string, origin: string = PUBLIC_ORIGIN) {
	const picture = post.banner ?? post.thumbnail;
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: post.title.slice(0, 110),
		description: post.summary,
		datePublished: post.publishedDate,
		author: { "@type": post.author ? "Person" : "Organization", name: post.author || TEMPLE.name },
		publisher: { "@type": "Organization", name: TEMPLE.name, logo: { "@type": "ImageObject", url: absoluteUrl(TEMPLE.logo, origin) } },
		mainEntityOfPage: absoluteUrl(path, origin),
		inLanguage: "vi",
		...(picture ? { image: [absoluteUrl(picture.src, origin)] } : {}),
	};
}

/** Một khóa tu hay khóa lễ trên lịch. Chỉ có ngày: giờ là chữ tự do. */
export function eventJsonLd(event: ScheduleEvent, origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": "Event",
		name: event.title,
		description: event.description || event.subtitle || undefined,
		startDate: event.start,
		endDate: event.end,
		eventStatus: "https://schema.org/EventScheduled",
		eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
		location: { "@type": "Place", name: event.location || TEMPLE.name, address: TEMPLE.address },
		organizer: { "@type": "Organization", name: TEMPLE.name, url: absoluteUrl("/", origin) },
		isAccessibleForFree: true,
		...(event.image ? { image: [absoluteUrl(event.image.src, origin)] } : {}),
	};
}

export type Crumb = { name: string; path: string };

/** Đường dẫn trang: Trang chủ → ... → trang hiện tại. Trang chủ luôn là mục đầu. */
export function breadcrumbJsonLd(trail: Crumb[], origin: string = PUBLIC_ORIGIN) {
	const items = [{ name: TEMPLE.name, path: "/" }, ...trail.filter((crumb) => crumb.name.trim() && crumb.path !== "/")];
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: absoluteUrl(crumb.path, origin) })),
	};
}

/** JSON cho `<script type="application/ld+json">`: `<` được thoát để chữ không đóng được thẻ. */
export function jsonLdText(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const decode = (slug: string) => {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
};

/** Article + BreadcrumbList của một bài còn hiển thị của `section`; `[]` nếu không có bài. Đường dẫn dùng slug thật của bài. */
export async function postJsonLdFor(slugOrId: string, section: string, sectionName: string, sectionPath: string, repo?: ContentRepository): Promise<object[]> {
	const r = repo ?? (await getContentRepository());
	const key = decode(slugOrId);
	const post = (await r.getPostBySlug(key, section)) ?? (await legacyPost(r, key, section));
	if (!post) return [];
	const path = `${sectionPath}/${post.slug}`;
	return [articleJsonLd(post, path), breadcrumbJsonLd([{ name: sectionName, path: sectionPath }, { name: post.title, path }])];
}

/** Bài mở bằng mã cũ ("17649" hay "post-17649"): chỉ bài đang hiển thị của chuyên mục đó. */
async function legacyPost(r: ContentRepository, key: string, section: string): Promise<Post | null> {
	for (let page = 1; ; page++) {
		const result = await r.listPosts({ section, pageSize: 60, page });
		const hit = result.items.find((p) => p.id === key || p.id === `post-${key}`);
		if (hit) return r.getPostBySlug(hit.slug, section);
		if (page >= result.pageCount) return null;
	}
}

/**
 * Event + BreadcrumbList của một sự kiện (không phải khóa lễ định kỳ) theo slug; `[]` nếu không có. Đường dẫn không có mục
 * "Lịch tu học" vì /lich-tu-hoc hiện chuyển hướng về trang chủ (thêm vào khi có trang danh sách thật).
 */
export async function eventJsonLdFor(slug: string, repo?: ContentRepository): Promise<object[]> {
	const r = repo ?? (await getContentRepository());
	const key = decode(slug);
	const event = (await r.getSchedule()).events.find((item) => !item.programId && item.slug === key);
	if (!event) return [];
	const path = `/lich-tu-hoc/${event.slug}`;
	return [eventJsonLd(event), breadcrumbJsonLd([{ name: event.title, path }])];
}
