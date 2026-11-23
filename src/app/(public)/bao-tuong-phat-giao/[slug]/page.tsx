// Địa chỉ cũ /bao-tuong-phat-giao/{slug}: cùng trang tượng như /bao-tuong/{slug}, cùng nguồn D1.
import SingleBaoTuongPage from '../../bao-tuong/[slug]/page';

export const revalidate = 60;

// Địa chỉ này chuyển 308 về /bao-tuong/{slug} ở next.config.ts; giữ metadata (canonical về /bao-tuong/{slug}) cho trường hợp luật không chạy.
export { generateMetadata } from '../../bao-tuong/[slug]/page';

export default SingleBaoTuongPage;
