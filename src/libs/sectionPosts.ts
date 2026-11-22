// A section's own posts for its article pages: each section serves only its posts, so a Trí
// Tuệ slug under /dong-chay-hoang-phap is a 404, and the other way round.
import type { Metadata } from "next";
import type { PostSection } from "@/config/sections";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import type { Post } from "@/libs/content/types";

export async function findSectionPost(section: PostSection, slug: string): Promise<Post | null> {
	// Slugs are unique per section: ask for this section's post, not the first post anywhere with the slug.
	return (await getContentRepository()).getPostBySlug(slug, section.slug);
}

/** The page's metadata: the SEO title, description and share picture the editors saved, else the title, summary and banner. */
export function sectionPostMetadata(section: PostSection, post: Post): Metadata {
	const title = post.seoTitle || post.title;
	const description = post.seoDescription || post.summary;
	const image = post.ogImage ?? post.banner;
	return {
		title: `${title} – ${section.name} – ${site.name}`,
		description,
		openGraph: { title, description, images: image ? [image.src] : undefined },
	};
}
