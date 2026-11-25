// Tiêu đề, mô tả, canonical và ảnh khi chia sẻ liên kết hay mở thẻ trình duyệt của các trang. V3 là trang công khai: lập chỉ mục
// hay không do tiêu đề X-Robots-Tag theo host (next.config.ts), không do trang nào ở đây; canonical, og:url và og:image luôn là
// địa chỉ của host công khai (PUBLIC_ORIGIN), kể cả khi trang được mở từ v3. Liên kết gửi cho người khác mang đúng tên, lời giới
// thiệu và ảnh mà người biên tập đã lưu: SEO title, SEO description, ảnh chia sẻ; thiếu thì lùi về tiêu đề, tóm tắt, ảnh bìa,
// rồi ảnh chia sẻ chung của chùa. Một trang truyền `path` thì có canonical tự trỏ vào chính nó (không chuỗi truy vấn).
//
// Phần dựng (`postMetadata`, `tongChiMetadata`, `aboutMetadata`) là hàm thuần trên bản ghi của lớp nội dung (Post,
// TongChiArticle, AboutTopic), để kiểm thử không cần D1. Phần đọc (`...For`) dùng chính kho nội dung và bộ đọc của
// src/lib/v3-live.ts (cùng bản đọc đang được giữ trong bộ nhớ, nên đọc thêm một lần ở đây không hỏi D1 lại); không có đường dữ
// liệu thứ hai. Không tìm thấy bài thì trả `{}`: chính trang sẽ trả 404 hay chuyển hướng.
import type { Metadata } from "next";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { AboutTopic, ContentRepository, MediaImage, Post, RegularProgram, ScheduleEvent, Statue, TongChiArticle } from "@/lib/tlhp-content/types";
import { toSlug } from "@/lib/schedule-detail";
import { canonicalUrl, PUBLIC_ORIGIN, SITE_NAME } from "@/lib/site-url";
import { absUrl } from "@/lib/v3-data";
import { liveArea, livePost, TONG_CHI_ALIASES } from "@/lib/v3-live";

export const SITE_SUFFIX = SITE_NAME;
const DESCRIPTION_MAX = 200;

/** Ảnh chia sẻ chung của chùa (1200×630), dùng khi trang không có ảnh riêng. Tệp nằm ở public/brand. */
export const DEFAULT_OG_IMAGE = `${PUBLIC_ORIGIN}/brand/og-tung-lam-hoa-phuc.jpg`;

/**
 * Địa chỉ tuyệt đối của một ảnh trên host công khai, hoặc `undefined` khi không có. /anh-goc/ và đường dẫn tương đối khác đều
 * ghép PUBLIC_ORIGIN (R2 và /brand cùng được phục vụ ở đó); địa chỉ https giữ nguyên.
 */
export function metaImageUrl(src: string | null | undefined): string | undefined {
	const url = absUrl(src);
	if (!url) return undefined;
	if (url.startsWith("/anh-goc/")) return `${PUBLIC_ORIGIN}${url}`;
	return /^https?:\/\//i.test(url) ? url : undefined;
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const plain = (html: string | null | undefined) => clean((html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "));

/** Mô tả lùi về tóm tắt cắt gọn; mô tả người biên tập đã viết thì giữ nguyên. */
function shorten(text: string, max = DESCRIPTION_MAX) {
	if (text.length <= max) return text;
	const cut = text.slice(0, max - 1);
	const space = cut.lastIndexOf(" ");
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

type Parts = {
	title: string;
	seoTitle?: string | null;
	seoDescription?: string | null;
	/** Các lời có thể dùng làm mô tả khi không có SEO description, theo thứ tự ưu tiên. */
	fallbacks: Array<string | null | undefined>;
	/** Ảnh theo thứ tự ưu tiên: ảnh chia sẻ, ảnh bìa, ảnh nhỏ. */
	images: Array<MediaImage | null | undefined>;
};

function build({ title, seoTitle, seoDescription, fallbacks, images }: Parts, path?: string, type: "article" | "website" = "article"): Metadata {
	const name = clean(seoTitle) || clean(title);
	if (!name) return {};
	const saved = clean(seoDescription);
	const description = saved || shorten(fallbacks.map(clean).find(Boolean) ?? "");
	// Trang không có ảnh riêng vẫn mang ảnh chia sẻ chung: openGraph của trang thay hẳn openGraph của layout, không trộn với nó.
	const image = images.map((i) => metaImageUrl(i?.src)).find(Boolean) ?? DEFAULT_OG_IMAGE;
	const fullTitle = name.includes(SITE_SUFFIX) ? name : `${name} | ${SITE_SUFFIX}`;
	const url = path ? canonicalUrl(path) : undefined;
	return {
		title: fullTitle,
		...(description ? { description } : {}),
		...(url ? { alternates: { canonical: url } } : {}),
		openGraph: {
			type,
			siteName: SITE_SUFFIX,
			locale: "vi_VN",
			title: name,
			...(description ? { description } : {}),
			...(url ? { url } : {}),
			images: [image],
		},
		twitter: { card: "summary_large_image", title: name, ...(description ? { description } : {}), images: [image] },
	};
}

/**
 * Trang danh sách hoặc trang tĩnh (không có bản ghi riêng): tiêu đề, mô tả, canonical tự trỏ vào chính nó, og:url, ảnh chia sẻ
 * chung (hoặc `image`). `noindex` cho trang nội bộ (mã bài vị, đối soát ảnh).
 */
export function pageMetadata({ title, description, path, image, noindex }: { title: string; description?: string; path: string; image?: string | null; noindex?: boolean }): Metadata {
	const meta = build({ title, seoDescription: description, fallbacks: [], images: [{ src: image ?? "", position: "" }] }, path, "website");
	return noindex ? { ...meta, robots: { index: false, follow: false } } : meta;
}

/** Bài của Dòng chảy hoằng pháp hay Trí tuệ Phật pháp: SEO title → tiêu đề, SEO description → tóm tắt → phụ đề, ảnh chia sẻ → ảnh bìa → ảnh nhỏ. */
export function postMetadata(post: Pick<Post, "title" | "subtitle" | "summary" | "seoTitle" | "seoDescription" | "ogImage" | "banner" | "thumbnail">, path?: string): Metadata {
	return build({ title: post.title, seoTitle: post.seoTitle, seoDescription: post.seoDescription, fallbacks: [post.summary, post.subtitle], images: [post.ogImage, post.banner, post.thumbnail] }, path);
}

/** Bài Tông Chỉ Tu Học: SEO title → tiêu đề, SEO description → trích đoạn → phụ đề, ảnh chia sẻ → ảnh bìa. */
export function tongChiMetadata(article: Pick<TongChiArticle, "title" | "name" | "subtitle" | "excerpt" | "seoTitle" | "seoDescription" | "ogImage" | "banner">, path?: string): Metadata {
	return build({ title: article.title || article.name, seoTitle: article.seoTitle, seoDescription: article.seoDescription, fallbacks: [article.excerpt, article.subtitle], images: [article.ogImage, article.banner] }, path);
}

/** Các trường SEO mà một chủ đề Giới thiệu có thể mang (lớp nội dung hiện chưa có; có thì được ưu tiên). */
type AboutSeo = { seoTitle?: string; seoDescription?: string; ogImage?: MediaImage | null };

/** Chủ đề Giới thiệu: SEO title (nếu có) → tên chủ đề, SEO description (nếu có) → tổng quan → phụ đề, ảnh chia sẻ → ảnh bìa → ảnh chân dung. */
export function aboutMetadata(topic: Pick<AboutTopic, "title" | "subtitle" | "overview" | "banner" | "portrait"> & AboutSeo, path?: string): Metadata {
	return build({ title: topic.title, seoTitle: topic.seoTitle, seoDescription: topic.seoDescription, fallbacks: [topic.overview, topic.subtitle], images: [topic.ogImage, topic.banner, topic.portrait] }, path);
}

/** Một khu vực của Vũ Trụ Phật Giáo (chưa có trường SEO): tên, giới thiệu → phụ đề, ảnh khu vực (`imgUrl` đã qua `absUrl`). */
export function areaMetadata(area: { name: string; subtitle: string; description: string; imgUrl: string }, path?: string): Metadata {
	return build({ title: area.name, fallbacks: [area.description, area.subtitle], images: [{ src: area.imgUrl, position: "" }] }, path);
}

/** Một cuốn sách đóng gói của Trí Tuệ Phật Pháp (đọc song ngữ; chưa nằm trong D1): tên sách, mô tả, bìa. */
export function bookMetadata(book: { title: string; subtitle?: string; description?: string; coverImage?: string }, path?: string): Metadata {
	return build({ title: book.title, fallbacks: [book.description, book.subtitle], images: [{ src: book.coverImage ?? "", position: "" }] }, path);
}

/** Một bảo tượng: SEO title → tên (kèm phụ đề), SEO description → phụ đề · nhóm · chúng hội (như www), ảnh tượng. Canonical là địa chỉ của chính tượng. */
export function statueMetadata(statue: Pick<Statue, "name" | "subtitle" | "cluster" | "assembly" | "image" | "href" | "seoTitle" | "seoDescription" | "contentHtml">): Metadata {
	const facts = [statue.subtitle, statue.cluster, statue.assembly.name].filter(Boolean).join(" · ");
	const title = clean(statue.seoTitle) || (statue.subtitle ? `${statue.name} – ${statue.subtitle}` : statue.name);
	return build({ title, seoDescription: statue.seoDescription, fallbacks: [facts, plain(statue.contentHtml)], images: [statue.image] }, statue.href);
}

/** Một sự kiện trên lịch tu học: tên, mô tả (hoặc loại và ngày), ảnh sự kiện. */
export function eventMetadata(event: Pick<ScheduleEvent, "title" | "subtitle" | "description" | "category" | "start" | "end" | "image" | "slug">): Metadata {
	const when = event.end && event.end !== event.start ? `${event.start} – ${event.end}` : event.start;
	return build({ title: event.title, fallbacks: [plain(event.description), event.subtitle, [event.category.name, when].filter(Boolean).join(" · ")], images: [event.image] }, `/lich-tu-hoc/${event.slug}`);
}

/** Một khóa lễ định kỳ: tên, tóm tắt (hoặc phụ đề), ảnh. `slug` là địa chỉ chuẩn của khóa lễ. */
export function programMetadata(program: Pick<RegularProgram, "title" | "subtitle" | "summary" | "image">, slug: string): Metadata {
	return build({ title: program.title, fallbacks: [plain(program.summary), program.subtitle], images: [program.image] }, `/lich-tu-hoc/${slug}`);
}

const open = (repo?: ContentRepository) => repo ?? getContentRepository();

const decode = (slug: string) => {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
};

/** Metadata của một bài còn hiển thị của `section` (đường dẫn bằng slug, hoặc bằng mã như "post-1060"); `{}` nếu không có. */
export async function postMetadataFor(slugOrId: string, section: string, repo?: ContentRepository): Promise<Metadata> {
	const r = await open(repo);
	const key = decode(slugOrId);
	const post = (await r.getPostBySlug(key, section)) ?? (await (async () => {
		const hit = await livePost(key, section, r);
		return hit ? r.getPostBySlug(hit.slug, section) : null;
	})());
	// Canonical là địa chỉ bằng slug thật của bài, kể cả khi mở bằng mã cũ ("17649", "post-17649").
	return post ? postMetadata(post, `/${section}/${post.slug}`) : {};
}

/** Metadata của một bài Tông Chỉ Tu Học còn hiển thị (kể cả địa chỉ cũ mà trang vẫn mở); `{}` nếu không có. */
export async function tongChiMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const r = await open(repo);
	const key = decode(slug);
	for (const candidate of [key, ...(TONG_CHI_ALIASES[key] ?? [])]) {
		const article = await r.getTongChi(candidate);
		if (article) return tongChiMetadata(article, `/tong-chi-tu-hoc/${article.slug}`);
	}
	return {};
}

/** Metadata của một chủ đề Giới thiệu còn hiển thị, tìm theo slug; `{}` nếu không có. */
export async function aboutMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const key = decode(slug);
	const topic = (await (await open(repo)).listAboutTopics()).find((t) => t.slug === key);
	return topic ? aboutMetadata(topic, `/gioi-thieu/${topic.slug}`) : {};
}

/** Metadata của một khu vực còn hiển thị (kể cả địa chỉ cũ); `{}` nếu không có. */
export async function areaMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const area = await liveArea(slug, repo);
	return area ? areaMetadata(area, `/vu-tru-phat-giao/${area.slug}`) : {};
}

/** Metadata của một bảo tượng còn hiển thị (tìm theo slug, mã hay id như trang); `{}` nếu không có. */
export async function statueMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const r = await open(repo);
	const key = decode(slug);
	const lower = key.toLowerCase();
	const hit = (await r.listStatues()).find((s) => s.slug === key || s.id.toLowerCase() === lower || (s.code && s.code.toLowerCase() === lower));
	const statue = hit && (await r.getStatue(hit.slug));
	return statue ? statueMetadata(statue) : {};
}

/** Metadata của một sự kiện hay khóa lễ định kỳ trên lịch (tìm như trang: slug, mã hoặc tên); `{}` nếu không có. */
export async function scheduleMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const key = decode(slug).trim();
	if (!key) return {};
	const schedule = await (await open(repo)).getSchedule();
	const event = schedule.events.find((e) => !e.programId && (e.slug === key || e.id === key || toSlug(e.title) === key));
	if (event) return eventMetadata(event);
	const program = schedule.programs.find((p) => p.id === key || toSlug(p.title) === key || `khoa-le-${p.id}` === key);
	return program ? programMetadata(program, toSlug(program.title)) : {};
}
