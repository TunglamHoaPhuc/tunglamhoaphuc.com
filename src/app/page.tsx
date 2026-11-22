// Trang chủ: phần khung tĩnh được cache ở edge 5 phút (Workers Cache); tin, lịch, pháp thoại
// do trình duyệt tải từ các API đọc D1 nên vẫn cập nhật trong khoảng một phút.
import HomeClient from "./HomeClient";

export const revalidate = 300;

export default function Page() {
  return <HomeClient />;
}
