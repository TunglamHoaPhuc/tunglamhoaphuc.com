// Địa chỉ cũ /bao-tuong-phat-giao/{slug}: cùng trang tượng như /bao-tuong/{slug}, cùng nguồn D1.
import SingleBaoTuongPage from '../../bao-tuong/[slug]/page';

export const revalidate = 60;

// Không tạo trang nào lúc build: khai báo này chỉ để vinext coi tuyến có tham số là "tạo tĩnh theo yêu cầu" (ISR), nhờ đó
// bộ nhớ đệm của Workers giữ bản trang theo `revalidate` thay vì dựng lại ở mỗi lượt xem.
export async function generateStaticParams() {
  return [];
}

// Địa chỉ này chuyển 308 về /bao-tuong/{slug} ở next.config.ts; giữ metadata (canonical về /bao-tuong/{slug}) cho trường hợp luật không chạy.
export { generateMetadata } from '../../bao-tuong/[slug]/page';

export default SingleBaoTuongPage;
