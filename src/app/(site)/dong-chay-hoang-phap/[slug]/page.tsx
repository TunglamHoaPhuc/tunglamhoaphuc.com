import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostArticle from "@/components/sections/posts/PostArticle";
import PostExtras from "@/components/sections/posts/PostExtras";
import { DONG_CHAY } from "@/config/sections";
import { findSectionPost, sectionPostMetadata } from "@/libs/sectionPosts";
import { redirectIfMoved } from "@/libs/siteRedirect";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;
// No pages at build time; each is made on its first visit, then cached (ISR).
export async function generateStaticParams() {
	return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const post = await findSectionPost(DONG_CHAY, (await params).slug);
	return post ? sectionPostMetadata(DONG_CHAY, post) : {};
}

export default async function DongChayArticle({ params }: Props) {
	const { slug } = await params;
	const post = await findSectionPost(DONG_CHAY, slug);
	if (!post) {
		await redirectIfMoved(`${DONG_CHAY.path}/${slug}`);
		notFound();
	}
	return <PostArticle section={DONG_CHAY} post={post} extra={<PostExtras extra={post.extra} />} />;
}
