// Trang chủ: khung được cache ở edge (Workers Cache) một phút; tin và lịch do trình duyệt tải từ các API đọc D1.
// Khu vực và bảo tượng nổi bật đọc từ D1 ở đây: khu vực ẩn, tượng nháp hay đã xóa không còn trên dải trượt.
// Chữ và video đầu trang đọc từ các khối home.* của admin, Dấu ấn hoằng pháp theo lượt xem thật: cả hai cũng dựng ở đây.
import { getSettings } from "@/lib/tlhp-site/siteData";
import { dharmaTilesFrom, loadDharmaFeatured } from "@/lib/v3-dharma";
import { siteDb } from "@/lib/v3-db";
import { homeGallery, readFeaturedAreaIds } from "@/lib/v3-home";
import { heroFromSettings } from "@/lib/v3-home-content";
import { liveAreas } from "@/lib/v3-live";
import { liveStatueRecords } from "@/lib/v3-statues";
import HomeClient from "./HomeClient";

export const revalidate = 60;

export default async function Page() {
  const [areas, statues, db, settings, dharma] = await Promise.all([
    liveAreas(),
    liveStatueRecords(),
    siteDb(),
    getSettings().catch(() => ({})),
    // Đọc hỏng thì khối giữ bộ thẻ dự phòng, trang không vỡ.
    loadDharmaFeatured().catch((error: unknown) => {
      console.error("page: không đọc được Dấu ấn hoằng pháp", error);
      return null;
    }),
  ]);
  // Khu vực nổi bật do admin chọn (area.featured); chưa chọn khu vực nào thì dải trượt giữ danh sách có sẵn của V3.
  const featuredIds = db ? await readFeaturedAreaIds(db) : [];
  return <HomeClient gallery={homeGallery(areas, statues, featuredIds)} hero={heroFromSettings(settings)} dharma={dharmaTilesFrom(dharma)} />;
}
