'use client';

import type { FC } from 'react';
import { TAM_BAO_VIDEOS } from '@/data/tam-bao-detail-data';
import { RelatedStoriesSection } from './RelatedStoriesSection';

// Câu chuyện liên quan của khu vực Tam Bảo: dữ liệu video Tam Bảo nằm riêng ở đây
// để các khu vực khác không phải tải nó cùng mã trang.
export const TamBaoStories: FC<{ areaTitle: string }> = ({ areaTitle }) => (
  <RelatedStoriesSection
    areaTitle={areaTitle}
    stories={TAM_BAO_VIDEOS.map((v) => ({
      id: v.id,
      title: v.title,
      subtitle: 'Tùng Lâm Hòa Phúc',
      summary: v.summary,
      thumbnailUrl: v.thumbnailUrl,
      videoUrl: v.videoUrl,
    }))}
  />
);
