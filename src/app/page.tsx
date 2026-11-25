// Trang chủ: khung được cache ở edge (Workers Cache) một phút; tin và lịch do trình duyệt tải từ các API đọc D1.
// Khu vực và bảo tượng nổi bật đọc từ D1 ở đây: khu vực ẩn, tượng nháp hay đã xóa không còn trên dải trượt.
// Chữ và video đầu trang đọc từ các khối home.* của admin, Dấu ấn hoằng pháp theo lượt xem thật: cả hai cũng dựng ở đây.
import type { Metadata } from "next";
import JsonLd from "@/components/public/JsonLd";
import { getSettings } from "@/lib/tlhp-site/siteData";
import { dharmaTilesFrom, loadDharmaFeatured } from "@/lib/v3-dharma";
import { siteDb } from "@/lib/v3-db";
import { homeGallery, readFeaturedAreaIds } from "@/lib/v3-home";
import { heroFromSettings } from "@/lib/v3-home-content";
import { loadHeroSources } from "@/lib/v3-home-hero";
import { loadHomeNews } from "@/lib/v3-home-news";
import { loadHomeQuotes } from "@/lib/v3-home-quotes";
import { loadHomeWelcome } from "@/lib/v3-home-welcome";
import { liveAreas } from "@/lib/v3-live";
import { organizationJsonLd } from "@/lib/v3-jsonld";
import { pageMetadata } from "@/lib/v3-seo";
import { liveStatueRecords } from "@/lib/v3-statues";
import HomeClient from "./HomeClient";

export const revalidate = 60;

// Tiêu đề như trang chủ của www (đã được lập chỉ mục dưới tên này); mô tả lùi về mô tả chung của layout.
export const metadata: Metadata = pageMetadata({
  title: "Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên",
  description: "Kênh thông tin chính thức của Chùa Tùng Lâm Hòa Phúc - Lịch tu học, lễ hội, bài giảng Phật pháp và hoạt động Phật sự.",
  path: "/",
});

export default async function Page() {
  const [areas, statues, db, settings, dharma, heroSources, welcome, quotes, news] = await Promise.all([
    liveAreas(),
    liveStatueRecords(),
    siteDb(),
    getSettings().catch(() => ({})),
    // Đọc hỏng thì khối giữ bộ thẻ dự phòng, trang không vỡ.
    loadDharmaFeatured().catch((error: unknown) => {
      console.error("page: không đọc được Dấu ấn hoằng pháp", error);
      return null;
    }),
    // Lịch và bài mới nhất cho các khung tự động của đầu trang (đọc hỏng thì chỉ còn các khung của admin).
    loadHeroSources(),
    // Lời chào + số liệu + Phật lịch, Lời Thầy và Tin mới nhất: đọc hỏng thì khối không vẽ (Tin mới tự hỏi API), trang không vỡ.
    loadHomeWelcome().catch((error: unknown) => {
      console.error("page: không đọc được Lời chào", error);
      return null;
    }),
    loadHomeQuotes().catch((error: unknown) => {
      console.error("page: không đọc được Lời Thầy", error);
      return null;
    }),
    loadHomeNews().catch((error: unknown) => {
      console.error("page: không đọc được Tin mới nhất", error);
      return null;
    }),
  ]);
  // Khu vực nổi bật do admin chọn (area.featured); chưa chọn khu vực nào thì dải trượt giữ danh sách có sẵn của V3.
  const featuredIds = db ? await readFeaturedAreaIds(db) : [];
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <HomeClient gallery={homeGallery(areas, statues, featuredIds)} hero={heroFromSettings(settings, heroSources)} dharma={dharmaTilesFrom(dharma)} welcome={welcome} quotes={quotes} news={news} />
    </>
  );
}
