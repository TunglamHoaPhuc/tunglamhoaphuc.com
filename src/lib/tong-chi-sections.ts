// The sections of the Tông Chỉ Tu Học page, made from the live articles of D1. The sections' look (title,
// watermark) is design and stays in data/tong-chi-tu-hoc-data.ts; the cards are only ever D1's articles, so a
// section whose articles are all hidden or in the trash is not shown rather than showing bundled cards.
import { INITIAL_SECTIONS_DATA, NAV_ITEMS } from '@/data/tong-chi-tu-hoc-data';
import type { NavItem, SectionData } from '@/types/tong-chi-tu-hoc';
import type { V3TongChi } from '@/lib/v3-data';

/** The group slug D1 gives an article → the id of its section on the page. */
export const GROUP_TO_SECTION: Record<string, string> = {
  'tong-phong-truyen-thua': 'tong-phong',
  'nen-tang-tu-hoc': 'nen-tang',
  'phuong-phap-hanh-tri': 'phap-mon',
  'lo-trinh-tu-hoc': 'lo-trinh',
  'nep-song-thien-gia': 'nep-song',
};

export function buildTongChiSections(articles: Pick<V3TongChi, 'id' | 'slug' | 'title' | 'subtitle' | 'excerpt' | 'category' | 'bannerImage' | 'bannerPosition'>[]): SectionData[] {
  return INITIAL_SECTIONS_DATA.map((section) => ({
    id: section.id,
    title: section.title,
    bgWatermark: section.bgWatermark,
    stt: section.stt,
    cards: articles
      .filter((a) => GROUP_TO_SECTION[a.category] === section.id)
      .map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle || a.excerpt || '',
        imageUrl: a.bannerImage || '/images/toan-canh-chua.jpg',
        imagePosition: a.bannerPosition || 'center 20%',
        thumbnailPosition: a.bannerPosition || 'center 20%',
        link: `/tong-chi-tu-hoc/${a.slug}`,
      })),
  })).filter((section) => section.cards.length > 0);
}

/** The navigation of the page: its introduction, then the sections that exist. */
export function tongChiNavItems(sections: SectionData[]): NavItem[] {
  const present = new Set(sections.map((s) => s.id));
  return NAV_ITEMS.filter((item) => item.id === 'tong-chi-tu-hoc' || present.has(item.id));
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The introduction as the `<p>`s PageIntro draws (text only, escaped). */
export function introHtml(paragraphs: readonly string[]): string {
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}
