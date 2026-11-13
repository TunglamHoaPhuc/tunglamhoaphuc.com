// A section's own posts for its article pages: each section serves only its posts, so a Trí
// Tuệ slug under /dong-chay-hoang-phap is a 404, and the other way round.
import type { Metadata } from "next";
import type { PostSection } from "@/config/sections";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import type { Post } from "@/libs/content/types";

export async function findSectionPost(section: PostSection, slug: string): Promise<Post | null> {
	const post = await (await getContentRepository()).getPostBySlug(slug);
	return post?.section === section.slug ? post : null;
}

export function sectionPostMetadata(section: PostSection, post: Post): Metadata {
	return {
		title: `${post.title} – ${section.name} – ${site.name}`,
		description: post.summary,
		openGraph: { title: post.title, description: post.summary, images: post.banner ? [post.banner.src] : undefined },
	};
}
