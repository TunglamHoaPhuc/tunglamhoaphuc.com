// Danh sách Bảo Tượng Phật Giáo: lọc và xếp tượng vào các khối của trang. Chỉ có kiểu và hàm thuần (không đọc D1), để
// thành phần phía trình duyệt nhập được và để test chạy thẳng.
//
// Quy tắc của danh sách (khớp với www /bao-tuong-phat-giao): MỌI tượng đang hiển thị đều có chỗ trên trang.
//   - Tượng chính (is_main = 1, "TƯỢNG CHÍNH") nằm trong các khối theo chúng hội, như trước.
//   - Tượng chính chưa có chúng hội nằm ở khối cuối "Chưa xếp chúng hội", để vẫn tìm thấy được.
//   - Mọi tượng còn lại (Nghệ thuật Phật giáo, "NTPG") nằm ở khối riêng "Nghệ thuật Phật giáo" sau các chúng hội.
// Tượng nháp, ẩn, hẹn giờ hay đã xóa không bao giờ tới đây: lib/v3-statues.ts chỉ đưa ra tượng đang hiển thị.
import type { StatueRecord } from '@/lib/statue-types';

export const MAIN_STATUE = 'TƯỢNG CHÍNH';
export const UNPLACED_ASSEMBLY = { id: '__chua-xep-chung-hoi', name: 'Chưa xếp chúng hội' } as const;

export type StatueKind = 'all' | 'main' | 'art';

export const KIND_OPTIONS: Array<{ id: StatueKind; name: string }> = [
  { id: 'all', name: 'Tất cả' },
  { id: 'main', name: 'Tượng chính' },
  { id: 'art', name: 'Nghệ thuật Phật giáo' },
];

export type StatueFilterState = {
  query: string;
  /** Mã chúng hội, hoặc 'all'. */
  assembly: string;
  /** Tên khu vực, hoặc 'all'. */
  area: string;
  kind: StatueKind;
};

export const NO_FILTER: StatueFilterState = { query: '', assembly: 'all', area: 'all', kind: 'all' };

type Listed = Pick<StatueRecord, 'id' | 'name' | 'subtitle' | 'areaName' | 'group' | 'clusterName' | 'assemblyId' | 'assembly' | 'assemblyName' | 'categoryType'>;

export const isMainStatue = (s: Pick<StatueRecord, 'categoryType'>) => s.categoryType === MAIN_STATUE;

export function normalizeStr(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[-_\s]/g, '');
}

/** Mã chúng hội của một tượng (đã chuẩn hóa), rỗng khi tượng chưa có chúng hội. */
export const assemblyKey = (s: Pick<StatueRecord, 'assemblyId'>) => normalizeStr(s.assemblyId);

/** Tượng có nằm trong chúng hội này không. So đúng mã đã chuẩn hóa: tượng không có chúng hội không rơi vào chúng hội nào. */
export function inAssembly(s: Pick<StatueRecord, 'assemblyId'>, assemblyId: string): boolean {
  const key = assemblyKey(s);
  return key !== '' && key === normalizeStr(assemblyId);
}

/** Các tượng khớp với bộ lọc (chưa chia khối), giữ đúng thứ tự biên tập. */
export function filterStatueList<T extends Listed>(list: T[], filter: StatueFilterState): T[] {
  const q = filter.query.trim().toLowerCase();
  return list.filter((s) => {
    if (filter.kind === 'main' && !isMainStatue(s)) return false;
    if (filter.kind === 'art' && isMainStatue(s)) return false;
    if (q) {
      const hit =
        s.name.toLowerCase().includes(q) ||
        !!s.subtitle?.toLowerCase().includes(q) ||
        !!s.areaName?.toLowerCase().includes(q) ||
        (s.group || s.clusterName || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filter.assembly !== 'all' && !inAssembly(s, filter.assembly)) return false;
    if (filter.area !== 'all' && s.areaName !== filter.area) return false;
    return true;
  });
}

/** Có đang tìm theo chữ hay lọc theo khu vực không: lúc đó trang hiện một lưới phẳng thay cho các khối. */
export const isNarrowed = (filter: StatueFilterState) => filter.query.trim() !== '' || filter.area !== 'all';

export type StatueGroup<T> = { id: string; name: string; statues: T[] };

export type StatueLayout<T> = {
  /** Tổng số tượng hiện ra (đúng bằng số tượng khớp bộ lọc). */
  total: number;
  /** Lưới phẳng khi đang tìm chữ hay lọc khu vực (tượng chính trước, rồi Nghệ thuật Phật giáo); `null` khi hiện theo khối. */
  flat: T[] | null;
  /** Các khối chúng hội của tượng chính, theo thứ tự `assemblies`, thêm khối "Chưa xếp chúng hội" nếu có; không có khối rỗng. */
  groups: Array<StatueGroup<T>>;
  /** Khối Nghệ thuật Phật giáo: mọi tượng không phải tượng chính. */
  art: T[];
};

/**
 * Xếp các tượng khớp bộ lọc vào các khối của trang. Mỗi tượng khớp có đúng một chỗ:
 * một khối chúng hội, khối "Chưa xếp chúng hội", khối Nghệ thuật Phật giáo, hoặc lưới phẳng.
 */
export function layoutStatues<T extends Listed>(list: T[], assemblies: Array<{ id: string; name: string }>, filter: StatueFilterState): StatueLayout<T> {
  const matched = filterStatueList(list, filter);
  const main = matched.filter(isMainStatue);
  const art = matched.filter((s) => !isMainStatue(s));
  if (isNarrowed(filter)) return { total: matched.length, flat: [...main, ...art], groups: [], art: [] };

  const groups: Array<StatueGroup<T>> = [];
  const placed = new Set<T>();
  const wanted = filter.assembly === 'all' ? assemblies : assemblies.filter((a) => normalizeStr(a.id) === normalizeStr(filter.assembly));
  for (const asm of wanted) {
    const statues = main.filter((s) => inAssembly(s, asm.id));
    statues.forEach((s) => placed.add(s));
    if (statues.length) groups.push({ id: asm.id, name: asm.name, statues });
  }
  const rest = main.filter((s) => !placed.has(s));
  if (rest.length && filter.assembly === 'all') groups.push({ id: UNPLACED_ASSEMBLY.id, name: UNPLACED_ASSEMBLY.name, statues: rest });
  return { total: matched.length, flat: null, groups, art };
}

/**
 * Trang một tượng: các tác phẩm (biến thể) của tượng hiện ra hết, mỗi tác phẩm đúng một lần.
 * Từ 5 tác phẩm trở lên, 5 tác phẩm đầu vào lưới "bento" quen thuộc và phần còn lại vào lưới thẻ bên dưới;
 * ít hơn 5 thì chỉ có lưới thẻ (không lặp một tác phẩm cho đủ 5 ô như trước).
 */
export function artGallerySlots(count: number): { bento: number[]; grid: number[] } {
  const n = Math.max(0, Math.floor(count));
  const bentoCount = n >= 5 ? 5 : 0;
  const indices = Array.from({ length: n }, (_, i) => i);
  return { bento: indices.slice(0, bentoCount), grid: indices.slice(bentoCount) };
}
