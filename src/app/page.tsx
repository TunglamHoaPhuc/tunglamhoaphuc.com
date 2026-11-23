// Trang chủ: khung được cache ở edge (Workers Cache) một phút; tin, lịch, pháp thoại do trình duyệt tải từ các API đọc D1.
// Khu vực và bảo tượng nổi bật đọc từ D1 ở đây: khu vực ẩn, tượng nháp hay đã xóa không còn trên dải trượt.
import { siteDb } from "@/lib/v3-db";
import { homeGallery, readFeaturedAreaIds } from "@/lib/v3-home";
import { liveAreas } from "@/lib/v3-live";
import { liveStatueRecords } from "@/lib/v3-statues";
import HomeClient from "./HomeClient";

export const revalidate = 60;

export default async function Page() {
  const [areas, statues, db] = await Promise.all([liveAreas(), liveStatueRecords(), siteDb()]);
  // Khu vực nổi bật do admin chọn (area.featured); chưa chọn khu vực nào thì dải trượt giữ danh sách có sẵn của V3.
  const featuredIds = db ? await readFeaturedAreaIds(db) : [];
  return <HomeClient gallery={homeGallery(areas, statues, featuredIds)} />;
}
