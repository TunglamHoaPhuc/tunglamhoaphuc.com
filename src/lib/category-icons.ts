// The icon the admin sets for a category (`icon_*` columns of the `category` table of www's D1) as an address a page can
// put in an <img>: a picture of the media library, a site path, or an SVG (the admin's own, or one of its icon library)
// turned into a data address. `''` when the category has no icon: the caller then keeps the icon V3 drew for it.
// Read only (one SELECT, like the other V3 readers); a failed read answers "no icons" and is logged, never an error page.
import { ICON_LIBRARY } from '@/lib/icon-library';
import { MEDIA_BASE, mediaUrl } from '@/lib/tlhp-content/media';
import type { D1Like } from '@/lib/tlhp-content/sources/d1';
import { absUrl } from '@/lib/v3-data';
import { siteDb } from '@/lib/v3-db';

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** The gold the pages draw their marks in: what an SVG icon's `currentColor` becomes when the admin chose no colour. */
export const DEFAULT_ICON_COLOR = '#F2C14E';

const byName = new Map(ICON_LIBRARY.map((icon) => [icon.name, icon]));

/** The library icon as a standalone <svg> (24 x 24, drawn with the current text colour), as www draws it; `null` for an unknown name. */
export function librarySvg(name: string): string | null {
  const icon = byName.get(name);
  if (!icon) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.body}</svg>`;
}

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * An SVG as an <img> address. An image cannot inherit the page's text colour, so `currentColor` is made the icon's colour
 * (the admin's, else gold). The address ends with "#": PostCard appends "?v=4" to icon addresses, which then falls into the
 * fragment (ignored) instead of into the SVG text, where it would break the picture.
 */
export function svgDataUri(svg: string, color = ''): string {
  const paint = HEX.test(color.trim()) ? color.trim() : DEFAULT_ICON_COLOR;
  let markup = svg.replace(/currentColor/gi, paint);
  if (!/<svg[^>]*\sxmlns=/i.test(markup)) markup = markup.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}#`;
}

/** The address of the icon one `category` row sets (joined with its icon's `media` row as `media_key`, `media_url`), or `''`. */
export function iconSrcOf(row: Row): string {
  const color = text(row.icon_color);
  switch (text(row.icon_type)) {
    case 'library': {
      const svg = librarySvg(text(row.icon_name));
      return svg ? svgDataUri(svg, color) : '';
    }
    case 'svg': {
      const svg = text(row.icon_svg).trim();
      return svg.startsWith('<svg') ? svgDataUri(svg, color) : '';
    }
    case 'image': {
      // A picture of the media library (by its key, read fresh so a replaced picture shows), else a site path or an address.
      const key = text(row.media_key);
      if (key) return `${MEDIA_BASE}/${key}`;
      const url = text(row.media_url) || text(row.icon_url);
      return url ? absUrl(mediaUrl(url) ?? url) : '';
    }
    default:
      return '';
  }
}

/** Category slug → icon address, for the categories of one kind and section that have an icon. */
export async function readCategoryIcons(db: D1Like, kind: string, section = ''): Promise<Map<string, string>> {
  const icons = new Map<string, string>();
  const statement = db.prepare(
    'select c.slug, c.icon_type, c.icon_name, c.icon_svg, c.icon_url, c.icon_color, m.r2_key as media_key, m.url as media_url ' +
      'from category c left join media m on m.id = c.icon_media_id where c.kind = ? and c.section = ? and c.deleted_at is null',
  );
  for (const row of (await statement.bind(kind, section).all<Row>()).results) {
    const src = iconSrcOf(row);
    if (src && text(row.slug)) icons.set(text(row.slug), src);
  }
  return icons;
}

/** The icons the admin set, or none when V3 does not read D1 here (local run, tests) or the read fails. */
export async function liveCategoryIcons(kind: string, section = '', db?: D1Like | null): Promise<Map<string, string>> {
  try {
    const source = db === undefined ? await siteDb() : db;
    return source ? await readCategoryIcons(source, kind, section) : new Map();
  } catch (error) {
    console.error('category-icons: cannot read the icons of the categories', error);
    return new Map();
  }
}
