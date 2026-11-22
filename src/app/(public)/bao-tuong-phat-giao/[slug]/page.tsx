// Địa chỉ cũ /bao-tuong-phat-giao/{slug}: cùng trang tượng như /bao-tuong/{slug}, cùng nguồn D1.
import SingleBaoTuongPage from '../../bao-tuong/[slug]/page';

export const revalidate = 60;

export default SingleBaoTuongPage;
