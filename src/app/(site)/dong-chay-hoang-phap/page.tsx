import type { Metadata } from "next";
import PostListPage from "@/components/sections/posts/PostListPage";
import { DONG_CHAY } from "@/config/sections";

export const metadata: Metadata = {
	title: `${DONG_CHAY.name} – Tùng Lâm Hòa Phúc`,
	description: DONG_CHAY.description,
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DongChayHoangPhap({ searchParams }: Props) {
	return <PostListPage section={DONG_CHAY} searchParams={await searchParams} />;
}
