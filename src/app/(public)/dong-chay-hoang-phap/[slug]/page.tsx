// Một bài Dòng chảy hoằng pháp, đọc ở máy chủ từ D1 của www. Bài nháp, hẹn giờ chưa tới, trong thùng rác,
// của chuyên mục khác hay không có: 404. Không còn 35 bài đóng gói để thay vào.
import { notFound } from 'next/navigation';
import { allArticles, DONG_CHAY_SECTION, relatedArticles } from '@/lib/dong-chay';
import { livePost } from '@/lib/v3-live';
import DongChayDetailClient from './DongChayDetailClient';

export const revalidate = 60;

export default async function DongChayHoangPhapDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await livePost(slug, DONG_CHAY_SECTION);
  if (!article) notFound();
  const related = relatedArticles(article, await allArticles());
  return <DongChayDetailClient article={article} relatedArticlesFormatted={related} />;
}
