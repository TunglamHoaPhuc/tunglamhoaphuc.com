// Một bài Trí Tuệ Phật Pháp, đọc ở máy chủ từ D1 của www. Bài nháp, hẹn giờ chưa tới, trong thùng rác, của chuyên
// mục khác hay không có: 404 (không còn rơi về bài đóng gói thứ 6). D1 được hỏi trước; chỉ khi D1 không có bài mới
// xét năm ấn phẩm đóng gói (đọc song ngữ), vì ấn phẩm chưa nằm trong D1.
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import JsonLd from '@/components/public/JsonLd';
import sachAnPhamData from '@/data/sach-an-pham-data.json';
import { BookDualReader } from '@/components/tri-tue-phat-phap/BookDualReader';
import { legacyIdTarget } from '@/lib/v3-canonical';
import { postJsonLdFor } from '@/lib/v3-jsonld';
import { livePost, livePosts } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { bookMetadata, postMetadataFor } from '@/lib/v3-seo';
import { relatedWisdom, TRI_TUE_SECTION } from '@/lib/wisdom';
import TriTueDetailClient from './TriTueDetailClient';

// Làm mới tối đa mỗi 30 giây. V3 không có chỗ nào để admin xóa cache, còn bản đọc D1 trong bộ nhớ làm mới mỗi 15 giây
// (D1_RENEW_MS): bài sửa hay gỡ ở /quan-tri của www hiện ở đây sau khoảng 30 giây, chậm nhất khoảng 45 giây.
export const revalidate = 30;

// Không tạo trang nào lúc build: khai báo này chỉ để vinext coi tuyến có tham số là "tạo tĩnh theo yêu cầu" (ISR), nhờ đó
// bộ nhớ đệm của Workers giữ bản trang theo `revalidate` thay vì dựng lại ở mỗi lượt xem (TTFB trang chi tiết ~1 s → ~0,3 s).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const fromPost = await postMetadataFor(slug, TRI_TUE_SECTION);
  if (fromPost.title) return fromPost;
  // Năm ấn phẩm đóng gói (đọc song ngữ) chưa nằm trong D1: lấy tên sách, mô tả và bìa của chúng.
  const book = sachAnPhamData.find((b) => b.slug === slug);
  return book ? bookMetadata(book, `/tri-tue-phat-phap/${book.slug}`) : {};
}

export default async function WisdomDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await livePost(slug, TRI_TUE_SECTION);
  if (post) {
    // Mở bằng mã cũ ("4862") thì chuyển 301 về địa chỉ bằng slug ("4862-2"): một bài một địa chỉ (src/lib/v3-canonical.ts).
    const moved = legacyIdTarget(rawSlug, post.slug, '/tri-tue-phat-phap');
    if (moved) permanentRedirect(moved);
    const item = { ...post, primaryCategoryTag: post.subtitle || post.categoryName || 'Trí Tuệ Phật Pháp', publishDate: post.publishedDate };
    return (
      <>
        <JsonLd data={await postJsonLdFor(slug, TRI_TUE_SECTION, 'Trí Tuệ Phật Pháp', '/tri-tue-phat-phap')} />
        <TriTueDetailClient item={item} relatedFormatted={relatedWisdom(post, await livePosts(TRI_TUE_SECTION))} />
      </>
    );
  }
  const book = sachAnPhamData.find((b) => b.slug === slug);
  if (book) return <BookDualReader book={book as never} />;
  return notFoundOrMoved(`/tri-tue-phat-phap/${slug}`);
}
