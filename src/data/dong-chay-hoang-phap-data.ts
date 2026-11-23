export interface HoangPhapArticle {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  category: string;
  subCategory: string;
  subCategoryIcon?: string;
  templeLogo: "tung-lam-hoa-phuc" | "quynh-nhai-cam-lo-tu";
  templeName: string;
  thumbnailUrl: string;
  thumbnailPosition?: string;
  imagePosition?: string;
  bannerUrl?: string;
  bannerPosition?: string;
  date: string;
  views: number;
  author?: string;
  location?: string;
  summary: string;
  contentHtml?: string;
  imageCaptions?: string[];
  videoBlock?: {
    title: string;
    videoUrl: string;
    thumbnailUrl: string;
    summary: string;
  };
}

// ── Categories of the section ───────────────────────────────────────────────
// The categories, their names and their icons are D1's (what the editors keep in the admin); what is written here is the
// design the four original categories were drawn with, kept as the fallback: their order and the icon of their card badge.

/** A category of the section as the filter and the cards' badge draw it. */
export interface DongChayCategoryInfo {
  /** The category's slug in D1, also what the list filters on. */
  id: string;
  /** The name on the filter's tab, as the editors wrote it. */
  label: string;
  /** The name on the card's badge (capitals). */
  name: string;
  /** The badge's picture: the icon the admin set, else the one drawn for the original categories, else the section's own. */
  iconSrc: string;
}

export const DONG_CHAY_DEFAULT_NAME = 'DÒNG CHẢY HOẰNG PHÁP';
export const DONG_CHAY_DEFAULT_ICON = '/images/icons/icon-dong-chay-hoang-phap.webp';

const LEGACY_CATEGORIES = [
  { id: 'cong-tu', label: 'Cộng tu', name: 'CỘNG TU ĐỊNH KỲ', icon: '/images/icons/icon-cong-tu.png' },
  { id: 'khoa-le-truyen-thong', label: 'Khóa lễ truyền thống', name: 'KHÓA LỄ TRUYỀN THỐNG', icon: '/images/icons/icon-khoa-le-truyen-thong.png' },
  { id: 'dai-le-su-kien', label: 'Đại lễ sự kiện', name: 'ĐẠI LỄ SỰ KIỆN', icon: '/images/icons/icon-dai-le-su-kien.png' },
  { id: 'tinh-do-nhan-gian', label: 'Tịnh độ nhân gian', name: 'TỊNH ĐỘ NHÂN GIAN', icon: '/images/icons/icon-tinh-do-nhan-gian.png' },
] as const;

const upper = (text: string) => text.trim().toLocaleUpperCase('vi');

/**
 * The categories of the filter, from the categories D1 has live posts in (`listCategories`): the original four first in
 * their old order, those the editors added after them. A category with no live post is not offered. `icons` maps a category
 * slug to the address of the icon the admin set for it (missing or empty: none).
 */
export function buildDongChayCategories(live: readonly { slug: string; name: string; position?: number }[], icons: ReadonlyMap<string, string> = new Map()): DongChayCategoryInfo[] {
  const legacyIndex = (slug: string) => LEGACY_CATEGORIES.findIndex((c) => c.id === slug);
  // When the reader gives the editors' positions (D1), their order is the order of the tabs; without positions (files) the original four first.
  const editorsOrder = live.some((c) => typeof c.position === 'number');
  const ordered = [...live.filter((c) => c.slug)].map((c, i) => ({ c, i })).sort((a, b) => {
    if (editorsOrder) return a.i - b.i;
    const x = legacyIndex(a.c.slug);
    const y = legacyIndex(b.c.slug);
    if (x >= 0 && y >= 0) return x - y;
    if (x >= 0) return -1;
    if (y >= 0) return 1;
    return a.i - b.i;
  });
  return ordered.map(({ c }) => {
    const legacy = LEGACY_CATEGORIES.find((l) => l.id === c.slug);
    const name = c.name.trim();
    return {
      id: c.slug,
      label: name || legacy?.label || c.slug,
      name: name ? upper(name) : legacy?.name ?? upper(c.slug.replace(/-/g, ' ')),
      iconSrc: icons.get(c.slug) || legacy?.icon || DONG_CHAY_DEFAULT_ICON,
    };
  });
}

/** What the badge of a card shows for a post of this category: the category's own name and icon, else the original design's. */
export function dongChayBadge(slug: string | undefined, categories: readonly DongChayCategoryInfo[]): { name: string; iconSrc: string } {
  const key = (slug || '').trim();
  const own = categories.find((c) => c.id === key);
  if (own) return { name: own.name, iconSrc: own.iconSrc };
  const cat = key.toLowerCase();
  // A category D1 no longer lists (or a slug written the old way): match the original four by the words in it.
  const legacy =
    LEGACY_CATEGORIES.find((l) => cat.includes(l.id)) ??
    (/cộng tu/.test(cat) ? LEGACY_CATEGORIES[0] : undefined) ??
    (/khóa lễ|khoa le/.test(cat) ? LEGACY_CATEGORIES[1] : undefined) ??
    (/đại lễ|dai le|sự kiện/.test(cat) ? LEGACY_CATEGORIES[2] : undefined) ??
    (/tịnh độ|tinh do/.test(cat) ? LEGACY_CATEGORIES[3] : undefined);
  return legacy ? { name: legacy.name, iconSrc: legacy.icon } : { name: DONG_CHAY_DEFAULT_NAME, iconSrc: DONG_CHAY_DEFAULT_ICON };
}

// ── The navigation panel ────────────────────────────────────────────────────

export interface DongChayNavItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
}

/** The newest `limit` live articles for the panel, with how many there are in all (the panel links to the full list). */
export function buildDongChayNavList(articles: readonly Pick<HoangPhapArticle, 'id' | 'slug' | 'title' | 'subtitle' | 'subCategory'>[], limit = 40): { total: number; items: DongChayNavItem[] } {
  return {
    total: articles.length,
    items: articles.slice(0, limit).map((a) => ({ id: a.id, slug: a.slug, title: a.title, subtitle: a.subtitle || a.subCategory || undefined })),
  };
}
