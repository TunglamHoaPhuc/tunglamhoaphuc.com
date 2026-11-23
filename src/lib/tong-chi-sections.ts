// The sections of the Tông Chỉ Tu Học page, made from the live articles of D1. The groups are the ones the articles
// of D1 belong to (a group an editor creates in the admin appears as soon as it has a live article), and a group's
// name is the one the editors gave it. What stays in data/tong-chi-tu-hoc-data.ts is design only: the watermark and
// the number of the five groups the page was drawn for, and their order. A group with no live article is not shown.
import { INITIAL_SECTIONS_DATA, NAV_ITEMS } from '@/data/tong-chi-tu-hoc-data';
import type { NavItem, SectionData } from '@/types/tong-chi-tu-hoc';
import type { V3TongChi } from '@/lib/v3-data';

/** The group slug D1 gives an article → the id of its section on the page (the five groups the design knows). */
export const GROUP_TO_SECTION: Record<string, string> = {
  'tong-phong-truyen-thua': 'tong-phong',
  'nen-tang-tu-hoc': 'nen-tang',
  'phuong-phap-hanh-tri': 'phap-mon',
  'lo-trinh-tu-hoc': 'lo-trinh',
  'nep-song-thien-gia': 'nep-song',
};

/** The short label of the five known groups on the tabs of the navigation panel; any other group shows its own name. */
const SHORT_NAME: Record<string, string> = {
  'tong-phong-truyen-thua': 'TÔNG PHONG',
  'nen-tang-tu-hoc': 'NỀN TẢNG',
  'phuong-phap-hanh-tri': 'HÀNH TRÌ',
  'lo-trinh-tu-hoc': 'LỘ TRÌNH',
  'nep-song-thien-gia': 'NẾP SỐNG',
};

type Article = Pick<V3TongChi, 'id' | 'slug' | 'title' | 'subtitle' | 'excerpt' | 'category' | 'categoryName' | 'bannerImage' | 'bannerPosition'>;

const upper = (text: string) => text.trim().toLocaleUpperCase('vi');

/** One group of D1, in the order the editors' articles first show it (known groups: the order of the design). */
interface Group<A> {
  slug: string;
  name: string;
  articles: A[];
}

function groupsOf<A extends { category: string; categoryName?: string }>(articles: A[]): Group<A>[] {
  const bySlug = new Map<string, Group<A>>();
  for (const article of articles) {
    if (!article.category) continue;
    const group = bySlug.get(article.category) ?? { slug: article.category, name: (article.categoryName || '').trim(), articles: [] };
    if (!group.name) group.name = (article.categoryName || '').trim();
    group.articles.push(article);
    bySlug.set(group.slug, group);
  }
  // The five groups the page was drawn for keep their place; groups the editors added follow, in the order they appear.
  const known = INITIAL_SECTIONS_DATA.flatMap((section) => {
    const slug = Object.keys(GROUP_TO_SECTION).find((s) => GROUP_TO_SECTION[s] === section.id);
    const group = slug ? bySlug.get(slug) : undefined;
    return group ? [group] : [];
  });
  const added = [...bySlug.values()].filter((group) => !(group.slug in GROUP_TO_SECTION));
  return [...known, ...added];
}

/** The id of a group's section on the page: the design's id for the five known groups, `nhom-<slug>` for the others. */
export const sectionIdOf = (groupSlug: string): string => GROUP_TO_SECTION[groupSlug] ?? `nhom-${groupSlug}`;

export function buildTongChiSections(articles: Article[]): SectionData[] {
  const fallback = INITIAL_SECTIONS_DATA[0];
  const lastNumber = Math.max(0, ...INITIAL_SECTIONS_DATA.map((s) => s.stt ?? 0));
  let added = 0;
  return groupsOf(articles).map((group) => {
    const design = INITIAL_SECTIONS_DATA.find((s) => s.id === GROUP_TO_SECTION[group.slug]);
    return {
      id: sectionIdOf(group.slug),
      // The name the editors gave the group; the design's title only when D1 has none.
      title: group.name ? upper(group.name) : design?.title ?? upper(group.slug.replace(/-/g, ' ')),
      bgWatermark: design?.bgWatermark ?? fallback.bgWatermark,
      stt: design?.stt ?? lastNumber + ++added,
      cards: group.articles.map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle || a.excerpt || '',
        imageUrl: a.bannerImage || '/images/toan-canh-chua.jpg',
        imagePosition: a.bannerPosition || 'center 20%',
        thumbnailPosition: a.bannerPosition || 'center 20%',
        link: `/tong-chi-tu-hoc/${a.slug}`,
      })),
    };
  });
}

/** The navigation of the page: its introduction, then the sections that exist (named as the sections are). */
export function tongChiNavItems(sections: SectionData[]): NavItem[] {
  const intro = NAV_ITEMS.find((item) => item.id === 'tong-chi-tu-hoc') ?? { id: 'tong-chi-tu-hoc', label: 'GIỚI THIỆU' };
  return [intro, ...sections.map((s) => ({ id: s.id, label: s.title }))];
}

// ── The navigation panel (the list that opens from the bar under the header) ─────────────────────────────────

export interface NavPanelItem {
  id: string | number;
  slug: string;
  title: string;
  subtitle?: string;
  /** Place in the whole list, from 1: the number the panel shows beside the title. */
  number: number;
}

export interface NavPanelGroup {
  /** The group's slug in D1. */
  slug: string;
  /** The id of the group's section on the Tông Chỉ page (for the panel to open at the section being read). */
  sectionId: string;
  name: string;
  short: string;
  items: NavPanelItem[];
}

/** The groups of the panel, with their live articles: exactly what D1 holds now, in the order of the page's sections. */
export function buildTongChiNavGroups(articles: (Article & { number?: number })[]): NavPanelGroup[] {
  const numbered = articles.map((a, i) => ({ ...a, number: a.number ?? i + 1 }));
  return groupsOf(numbered).map((group) => {
    const name = group.name ? upper(group.name) : upper(group.slug.replace(/-/g, ' '));
    return {
      slug: group.slug,
      sectionId: sectionIdOf(group.slug),
      name,
      short: SHORT_NAME[group.slug] ?? name,
      items: group.articles.map((a) => ({ id: a.id, slug: a.slug, title: a.title, subtitle: a.subtitle || undefined, number: a.number })),
    };
  });
}

const lastSegment = (pathname: string) => {
  const segment = pathname.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * The group the panel opens at: the one holding the article being read (by the end of the address, then by title),
 * else the one of the section being scrolled on the Tông Chỉ page, else the first group.
 */
export function defaultTongChiGroup(groups: NavPanelGroup[], where: { pathname?: string; pageTitle?: string; activeSection?: string }): string {
  const segment = lastSegment(where.pathname ?? '');
  const title = (where.pageTitle ?? '').toLowerCase().trim();
  const byPath = segment ? groups.find((g) => g.items.some((item) => item.slug === segment)) : undefined;
  if (byPath) return byPath.slug;
  const byTitle = title ? groups.find((g) => g.items.some((item) => item.title.toLowerCase().trim() === title)) : undefined;
  if (byTitle) return byTitle.slug;
  const bySection = where.activeSection ? groups.find((g) => g.sectionId === where.activeSection) : undefined;
  return (bySection ?? groups[0])?.slug ?? '';
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The introduction as the `<p>`s PageIntro draws (text only, escaped). */
export function introHtml(paragraphs: readonly string[]): string {
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}
