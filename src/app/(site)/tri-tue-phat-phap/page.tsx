import type { Metadata } from "next";
import PostListPage from "@/components/sections/posts/PostListPage";
import StudyRooms from "@/components/sections/tri-tue/StudyRooms";
import { TRI_TUE } from "@/config/sections";

export const metadata: Metadata = {
	title: `${TRI_TUE.name} – Tùng Lâm Hòa Phúc`,
	description: TRI_TUE.description,
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The 158 posts in their four categories (Bài Viết, Pháp Âm, Video Phật Pháp, Ấn Phẩm & Sách),
// as Dòng Chảy lists its own; then the book and the Tibetan course. The old page showed seven
// featured items written into its code instead of the posts.
export default async function TriTuePhatPhap({ searchParams }: Props) {
	return (
		<PostListPage section={TRI_TUE} searchParams={await searchParams}>
			<StudyRooms />
		</PostListPage>
	);
}
