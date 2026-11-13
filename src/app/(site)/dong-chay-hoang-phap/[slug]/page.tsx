import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostArticle from "@/components/sections/posts/PostArticle";
import { DONG_CHAY } from "@/config/sections";
import { findSectionPost, sectionPostMetadata } from "@/libs/sectionPosts";

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
	const post = await findSectionPost(DONG_CHAY, (await params).slug);
	if (!post) notFound();
	return <PostArticle section={DONG_CHAY} post={post} />;
}
