// Tìm kiếm trên toàn site, chạy ở máy chủ (/tim-kiem?q=&muc=&trang=), cùng luật xếp hạng với www: lib/v3-search.ts là bản chép
// của www, lib/v3-search-index.ts dựng chỉ mục từ kho nội dung đọc D1. Trang kết quả không để máy tìm kiếm lập chỉ mục.
import type { Metadata } from "next";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import { readSearchQuery, searchItems } from "@/lib/v3-search";
import { searchIndex } from "@/lib/v3-search-index";
import SearchView from "./SearchView";

export const metadata: Metadata = {
  title: "Tìm kiếm – Tùng Lâm Hòa Phúc",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TimKiemPage({ searchParams }: Props) {
  const query = readSearchQuery(await searchParams);
  const results = query.q ? searchItems(await searchIndex(await getContentRepository()), query.q) : [];
  return <SearchView query={query} results={results} />;
}
