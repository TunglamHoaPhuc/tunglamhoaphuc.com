// Tiêu đề, mô tả và ảnh khi chia sẻ liên kết hay mở thẻ trình duyệt của các trang chi tiết. V3 vẫn là bản xem trước
// (src/app/layout.tsx đặt robots noindex và các trang ở đây không đổi điều đó), nhưng liên kết gửi cho người khác phải mang
// đúng tên, lời giới thiệu và ảnh mà người biên tập đã lưu: SEO title, SEO description, ảnh chia sẻ; thiếu thì lùi về
// tiêu đề, tóm tắt, ảnh bìa.
//
// Phần dựng (`postMetadata`, `tongChiMetadata`, `aboutMetadata`) là hàm thuần trên bản ghi của lớp nội dung (Post,
// TongChiArticle, AboutTopic), để kiểm thử không cần D1. Phần đọc (`...For`) dùng chính kho nội dung và bộ đọc của
// src/lib/v3-live.ts (cùng bản đọc đang được giữ trong bộ nhớ, nên đọc thêm một lần ở đây không hỏi D1 lại); không có đường dữ
// liệu thứ hai. Không tìm thấy bài thì trả `{}`: chính trang sẽ trả 404 hay chuyển hướng.
import type { Metadata } from "next";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { AboutTopic, ContentRepository, MediaImage, Post, TongChiArticle } from "@/lib/tlhp-content/types";
import { absUrl } from "@/lib/v3-data";
import { liveArea, livePost, TONG_CHI_ALIASES } from "@/lib/v3-live";

/** Địa chỉ của V3: ảnh /anh-goc/ do chính V3 phục vụ (R2 gắn cùng bucket), nên ảnh chia sẻ trỏ về đây. */
export const V3_ORIGIN = "https://v3.tunglamhoaphuc.com";
export const SITE_SUFFIX = "Tùng Lâm Hòa Phúc";
const DESCRIPTION_MAX = 200;

/** Địa chỉ tuyệt đối của một ảnh, hoặc `undefined` khi không có. Cùng quy ước với `absUrl`: /anh-goc/ ở V3, đường dẫn khác ở www. */
export function metaImageUrl(src: string | null | undefined): string | undefined {
	const url = absUrl(src);
	if (!url) return undefined;
	if (url.startsWith("/anh-goc/")) return `${V3_ORIGIN}${url}`;
	return /^https?:\/\//i.test(url) ? url : undefined;
}

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

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

function build({ title, seoTitle, seoDescription, fallbacks, images }: Parts): Metadata {
	const name = clean(seoTitle) || clean(title);
	if (!name) return {};
	const saved = clean(seoDescription);
	const description = saved || shorten(fallbacks.map(clean).find(Boolean) ?? "");
	const image = images.map((i) => metaImageUrl(i?.src)).find(Boolean);
	const fullTitle = name.includes(SITE_SUFFIX) ? name : `${name} | ${SITE_SUFFIX}`;
	return {
		title: fullTitle,
		...(description ? { description } : {}),
		openGraph: {
			type: "article",
			siteName: SITE_SUFFIX,
			locale: "vi_VN",
			title: name,
			...(description ? { description } : {}),
			...(image ? { images: [image] } : {}),
		},
		twitter: { card: image ? "summary_large_image" : "summary", title: name, ...(description ? { description } : {}), ...(image ? { images: [image] } : {}) },
	};
}

/** Bài của Dòng chảy hoằng pháp hay Trí tuệ Phật pháp: SEO title → tiêu đề, SEO description → tóm tắt → phụ đề, ảnh chia sẻ → ảnh bìa → ảnh nhỏ. */
export function postMetadata(post: Pick<Post, "title" | "subtitle" | "summary" | "seoTitle" | "seoDescription" | "ogImage" | "banner" | "thumbnail">): Metadata {
	return build({ title: post.title, seoTitle: post.seoTitle, seoDescription: post.seoDescription, fallbacks: [post.summary, post.subtitle], images: [post.ogImage, post.banner, post.thumbnail] });
}

/** Bài Tông Chỉ Tu Học: SEO title → tiêu đề, SEO description → trích đoạn → phụ đề, ảnh chia sẻ → ảnh bìa. */
export function tongChiMetadata(article: Pick<TongChiArticle, "title" | "name" | "subtitle" | "excerpt" | "seoTitle" | "seoDescription" | "ogImage" | "banner">): Metadata {
	return build({ title: article.title || article.name, seoTitle: article.seoTitle, seoDescription: article.seoDescription, fallbacks: [article.excerpt, article.subtitle], images: [article.ogImage, article.banner] });
}

/** Các trường SEO mà một chủ đề Giới thiệu có thể mang (lớp nội dung hiện chưa có; có thì được ưu tiên). */
type AboutSeo = { seoTitle?: string; seoDescription?: string; ogImage?: MediaImage | null };

/** Chủ đề Giới thiệu: SEO title (nếu có) → tên chủ đề, SEO description (nếu có) → tổng quan → phụ đề, ảnh chia sẻ → ảnh bìa → ảnh chân dung. */
export function aboutMetadata(topic: Pick<AboutTopic, "title" | "subtitle" | "overview" | "banner" | "portrait"> & AboutSeo): Metadata {
	return build({ title: topic.title, seoTitle: topic.seoTitle, seoDescription: topic.seoDescription, fallbacks: [topic.overview, topic.subtitle], images: [topic.ogImage, topic.banner, topic.portrait] });
}

/** Một khu vực của Vũ Trụ Phật Giáo (chưa có trường SEO): tên, giới thiệu → phụ đề, ảnh khu vực (`imgUrl` đã qua `absUrl`). */
export function areaMetadata(area: { name: string; subtitle: string; description: string; imgUrl: string }): Metadata {
	return build({ title: area.name, fallbacks: [area.description, area.subtitle], images: [{ src: area.imgUrl, position: "" }] });
}

/** Một cuốn sách đóng gói của Trí Tuệ Phật Pháp (đọc song ngữ; chưa nằm trong D1): tên sách, mô tả, bìa. */
export function bookMetadata(book: { title: string; subtitle?: string; description?: string; coverImage?: string }): Metadata {
	return build({ title: book.title, fallbacks: [book.description, book.subtitle], images: [{ src: book.coverImage ?? "", position: "" }] });
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
	return post ? postMetadata(post) : {};
}

/** Metadata của một bài Tông Chỉ Tu Học còn hiển thị (kể cả địa chỉ cũ mà trang vẫn mở); `{}` nếu không có. */
export async function tongChiMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const r = await open(repo);
	const key = decode(slug);
	for (const candidate of [key, ...(TONG_CHI_ALIASES[key] ?? [])]) {
		const article = await r.getTongChi(candidate);
		if (article) return tongChiMetadata(article);
	}
	return {};
}

/** Metadata của một chủ đề Giới thiệu còn hiển thị, tìm theo slug; `{}` nếu không có. */
export async function aboutMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const key = decode(slug);
	const topic = (await (await open(repo)).listAboutTopics()).find((t) => t.slug === key);
	return topic ? aboutMetadata(topic) : {};
}

/** Metadata của một khu vực còn hiển thị (kể cả địa chỉ cũ); `{}` nếu không có. */
export async function areaMetadataFor(slug: string, repo?: ContentRepository): Promise<Metadata> {
	const area = await liveArea(slug, repo);
	return area ? areaMetadata(area) : {};
}
