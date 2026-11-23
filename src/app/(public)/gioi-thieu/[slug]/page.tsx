// Địa chỉ của mọi chủ đề Giới thiệu, kể cả chủ đề mới tạo ở admin. Hỏi D1 theo slug; không có thì 404.
import type { Metadata } from 'next';
import { liveAboutTopic } from '@/lib/v3-live';
import { AboutTopicPage } from '../AboutTopicPage';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const topic = await liveAboutTopic((await params).slug);
  return topic ? { title: `${topic.title} | Tùng Lâm Hòa Phúc`, description: topic.overviewSummary || topic.subtitle } : {};
}

export default async function GioiThieuTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AboutTopicPage slug={decodeURIComponent(slug)} />;
}
