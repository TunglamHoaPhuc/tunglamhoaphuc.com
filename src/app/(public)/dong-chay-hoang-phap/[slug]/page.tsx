// Một bài Dòng chảy hoằng pháp, đọc ở máy chủ từ D1 của www. Bài nháp, hẹn giờ chưa tới, trong thùng rác,
// của chuyên mục khác hay không có: 404. Không còn 35 bài đóng gói để thay vào.
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import JsonLd from '@/components/public/JsonLd';
import { NavPanelProvider } from '@/components/tong-chi-tu-hoc/NavPanelData';
import { buildDongChayNavList } from '@/data/dong-chay-hoang-phap-data';
import { allArticles, DONG_CHAY_SECTION, relatedArticles } from '@/lib/dong-chay';
import { legacyIdTarget } from '@/lib/v3-canonical';
import { postJsonLdFor } from '@/lib/v3-jsonld';
import { livePost } from '@/lib/v3-live';
import { postMetadataFor } from '@/lib/v3-seo';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import DongChayDetailClient from './DongChayDetailClient';

// Làm mới tối đa mỗi 30 giây. V3 không có chỗ nào để admin xóa cache, còn bản đọc D1 trong bộ nhớ làm mới mỗi 15 giây
// (D1_RENEW_MS): bài sửa hay gỡ ở /quan-tri của www hiện ở đây sau khoảng 30 giây, chậm nhất khoảng 45 giây.
export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return postMetadataFor((await params).slug, DONG_CHAY_SECTION);
}

export default async function DongChayHoangPhapDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await livePost(slug, DONG_CHAY_SECTION);
  if (!article) return notFoundOrMoved(`/dong-chay-hoang-phap/${slug}`);
  // Mở bằng mã cũ ("17649") thì chuyển 301 về địa chỉ bằng slug ("17649-2"): một bài một địa chỉ (src/lib/v3-canonical.ts).
  const moved = legacyIdTarget(slug, article.slug, '/dong-chay-hoang-phap');
  if (moved) permanentRedirect(moved);
  const all = await allArticles();
  const related = relatedArticles(article, all);
  return (
    <NavPanelProvider data={{ dongChay: buildDongChayNavList(all) }}>
      <JsonLd data={await postJsonLdFor(slug, DONG_CHAY_SECTION, 'Dòng Chảy Hoằng Pháp', '/dong-chay-hoang-phap')} />
      <DongChayDetailClient article={article} relatedArticlesFormatted={related} />
    </NavPanelProvider>
  );
}
