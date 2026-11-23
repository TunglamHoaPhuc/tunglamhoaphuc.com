// Một bài Trí Tuệ Phật Pháp, đọc ở máy chủ từ D1 của www. Bài nháp, hẹn giờ chưa tới, trong thùng rác, của chuyên
// mục khác hay không có: 404 (không còn rơi về bài đóng gói thứ 6). D1 được hỏi trước; chỉ khi D1 không có bài mới
// xét năm ấn phẩm đóng gói (đọc song ngữ), vì ấn phẩm chưa nằm trong D1.
import sachAnPhamData from '@/data/sach-an-pham-data.json';
import { BookDualReader } from '@/components/tri-tue-phat-phap/BookDualReader';
import { livePost, livePosts } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { relatedWisdom, TRI_TUE_SECTION } from '@/lib/wisdom';
import TriTueDetailClient from './TriTueDetailClient';

export const revalidate = 60;

export default async function WisdomDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await livePost(slug, TRI_TUE_SECTION);
  if (post) {
    const item = { ...post, primaryCategoryTag: post.subtitle || post.categoryName || 'Trí Tuệ Phật Pháp', publishDate: post.publishedDate };
    return <TriTueDetailClient item={item} relatedFormatted={relatedWisdom(post, await livePosts(TRI_TUE_SECTION))} />;
  }
  const book = sachAnPhamData.find((b) => b.slug === slug);
  if (book) return <BookDualReader book={book as never} />;
  return notFoundOrMoved(`/tri-tue-phat-phap/${slug}`);
}
