'use client';

import React, { useMemo } from 'react';
import { richHtml } from '@/lib/article-html';
import { optimizeBodyImages } from '@/lib/body-images';

interface Popup {
  keyword: string;
}

/**
 * Thân bài hiển thị bằng HTML (bảng, video, âm thanh, chú thích ảnh, liên kết). Đây là chỗ duy nhất đưa HTML vào trang:
 * chuỗi luôn đi qua bộ lọc của admin (richHtml → tlhp-admin/content/html.ts) ngay trước khi hiển thị, dù nó đã được
 * lọc khi lưu và khi đọc từ D1.
 */
export function RichHtmlBody({
  html,
  popups = [],
  onKeywordClick,
}: {
  html: string;
  popups?: Popup[];
  onKeywordClick?: (keyword: string) => void;
}) {
  // Sau bộ lọc: ảnh /anh-goc/ trong thân bài nhận biến thể vừa cỡ, srcset, sizes và lazy (src/lib/body-images.ts).
  const safe = useMemo(() => optimizeBodyImages(richHtml(html)), [html]);
  if (!safe) return null;

  // Bấm vào chữ đậm trùng một từ khóa thì mở chú thích, như ở đường dựng cũ.
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onKeywordClick || popups.length === 0) return;
    const bold = (event.target as HTMLElement).closest('strong');
    const text = bold?.textContent?.replace(/[.,;:]+$/, '').trim().toLowerCase();
    if (!text) return;
    const hit = popups.find((p) => (p.keyword || '').replace(/[.,;:]+$/, '').trim().toLowerCase() === text);
    if (hit) onKeywordClick(hit.keyword);
  };

  return <div className="tlhp-rich" onClick={handleClick} dangerouslySetInnerHTML={{ __html: safe }} />;
}

export default RichHtmlBody;
