import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostArticle from "@/components/sections/posts/PostArticle";
import PostExtras from "@/components/sections/posts/PostExtras";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import { TRI_TUE } from "@/config/sections";
import { book } from "@/config/triTue";
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
	const post = await findSectionPost(TRI_TUE, (await params).slug);
	return post ? sectionPostMetadata(TRI_TUE, post) : {};
}

// A post of Trí Tuệ Phật Pháp, as Dòng Chảy shows its own. The post that presents the book
// leads to the book. What the editors fill in for a category shows under the opening: the
// sound of a Pháp Âm post and the book of an Ấn Phẩm & Sách post (the video of a Video Phật
// Pháp post is among the post's videos).
export default async function TriTueArticle({ params }: Props) {
	const { slug } = await params;
	const post = await findSectionPost(TRI_TUE, slug);
	if (!post) {
		await redirectIfMoved(`${TRI_TUE.path}/${slug}`);
		notFound();
	}
	const extra = (
		<>
			{post.slug === book.postSlug ? (
				<div className="tlhp-article-actions">
					<ButtonPrimary text="Đọc sách" url={book.path} />
				</div>
			) : null}
			<PostExtras extra={post.extra} />
		</>
	);
	return <PostArticle section={TRI_TUE} post={post} extra={extra} />;
}
