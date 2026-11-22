// Một trang danh sách Dòng chảy hoằng pháp (12 bài), cho phần phân trang, lọc và sắp xếp ở trình duyệt.
// ?trang=2&danh-muc=cong-tu&sap-xep=newest
import { NextRequest, NextResponse } from "next/server";
import { dongChayPage } from "@/lib/dong-chay";
import { PUBLIC_CACHE } from "@/lib/v3-data";

export async function GET(request: NextRequest) {
	const q = request.nextUrl.searchParams;
	const data = await dongChayPage({
		page: Number(q.get("trang") ?? 1),
		category: q.get("danh-muc") ?? undefined,
		sort: q.get("sap-xep") ?? undefined,
	});
	return NextResponse.json(data, { headers: PUBLIC_CACHE });
}
