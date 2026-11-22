// Một chủ đề Giới thiệu, đọc ở máy chủ từ D1 của www theo slug (không theo id hay vị trí). Chủ đề nháp, hẹn giờ chưa
// tới, trong thùng rác hay không có: 404. Không còn bản đóng gói trộn vào, và chủ đề mới tạo ở admin có địa chỉ ngay
// (gioi-thieu/[slug]); sáu địa chỉ cũ chỉ là lớp mỏng gọi lại đúng hàm này.
import { notFound } from 'next/navigation';
import { GioiThieuDetailLayout } from '@/components/gioi-thieu/GioiThieuDetailLayout';
import { TieuSuSuToOdysseyView } from '@/components/gioi-thieu/TieuSuSuToOdysseyView';
import { liveAbout } from '@/lib/v3-live';

/** Slug của chủ đề có giao diện riêng (hành trình Sư Tổ); mọi chủ đề khác dùng bố cục chung. */
export const SU_TO_SLUG = 'tieu-su-su-to';

export async function AboutTopicPage({ slug }: { slug: string }) {
  const topics = await liveAbout();
  const topic = topics.find((t) => t.slug === slug);
  if (!topic) notFound();
  const others = topics.filter((t) => t.slug !== topic.slug).map(({ id, slug: otherSlug, title, tag }) => ({ id, slug: otherSlug, title, tag }));
  return slug === SU_TO_SLUG ? (
    <TieuSuSuToOdysseyView detail={topic} others={others} slug={slug} />
  ) : (
    <GioiThieuDetailLayout detail={topic} others={others} slug={slug} />
  );
}
