import { loadServerlessJsonAsync } from './serverless-db';
import {
  DEFAULT_MEMORIAL_DRIVE_FILE_ID,
  DEFAULT_MEMORIAL_DRIVE_URL,
  type MemorialPublicRecord,
  type MemorialRecord,
  type MemorialSyncMeta,
  matchesCategoryFilter,
  normalizeVietnamese,
  toPublicMemorialRecord,
} from './memorial-types';

const MEMORIAL_DB_CONFIG = {
  fileName: 'memorial-data.json',
  localRelativePath: 'src/data/memorial-data.json',
  s3Key: 'tunglamhoaphuc2/database/memorial-data.json',
  defaultData: [] as MemorialRecord[],
};

const MEMORIAL_META_CONFIG = {
  fileName: 'memorial-sync-meta.json',
  localRelativePath: 'src/data/memorial-sync-meta.json',
  s3Key: 'tunglamhoaphuc2/database/memorial-sync-meta.json',
  defaultData: {
    driveUrl: DEFAULT_MEMORIAL_DRIVE_URL,
    driveFileId: DEFAULT_MEMORIAL_DRIVE_FILE_ID,
    lastSyncedAt: '',
    totalRecords: 0,
    countsByCategory: {},
    sourceName: '(QUAN TRỌNG) DANH SÁCH BÀI VỊ CHƯ H.LINH.xlsx',
  } as MemorialSyncMeta,
};

export async function getAllMemorialRecords(): Promise<MemorialRecord[]> {
  return await loadServerlessJsonAsync<MemorialRecord[]>(MEMORIAL_DB_CONFIG);
}

export async function getMemorialSyncMeta(): Promise<MemorialSyncMeta> {
  return await loadServerlessJsonAsync<MemorialSyncMeta>(MEMORIAL_META_CONFIG);
}

/** Ít nhất bấy nhiêu ký tự (sau khi bỏ dấu, bỏ khoảng trắng) mới tra: chặn việc gõ "a" để kéo cả danh sách. */
export const MEMORIAL_MIN_QUERY = 3;
/** Nhiều nhất bấy nhiêu bài vị trả về một lần tra; còn nữa thì báo tổng số và nhờ gõ cụ thể hơn. */
export const MEMORIAL_MAX_RESULTS = 30;
/** Cắt chuỗi tra ở độ dài này trước mọi xử lý. */
export const MEMORIAL_MAX_QUERY = 80;

/**
 * Tìm kiếm bài vị phía Server, bỏ dấu tiếng Việt. Chỉ so với các trường CÔNG KHAI (chính những gì
 * toPublicMemorialRecord trả ra): không so với địa chỉ, nơi an táng, người liên hệ hay số điện thoại, nên không dò ra
 * những thứ đó bằng cách thử từng chữ và không lộ bản ghi nào qua phần ẩn của nó.
 */
export function filterMemorialRecords(
  records: MemorialRecord[],
  query: string
): MemorialPublicRecord[] {
  const normQ = normalizeVietnamese(query);
  const publicRecords = records.map(toPublicMemorialRecord);
  if (!normQ) return publicRecords;

  const tokens = normQ.split(' ').filter(Boolean);

  return publicRecords.filter((rec) => {
    const haystack = normalizeVietnamese(
      [rec.code, rec.name, rec.dharmaName, rec.lineageType, rec.age, rec.deathDate, rec.birthDate, rec.category]
        .filter(Boolean)
        .join(' ')
    );

    return tokens.every((tok) => haystack.includes(tok));
  });
}

export type MemorialSearch =
  | { state: 'idle' }
  | { state: 'short'; query: string }
  | { state: 'limited'; query: string }
  | { state: 'done'; query: string; records: MemorialPublicRecord[]; total: number };

/**
 * Một lần tra của trang công khai: không có từ khóa thì không trả bản ghi nào, từ khóa quá ngắn thì nhờ gõ thêm,
 * còn lại trả tối đa MEMORIAL_MAX_RESULTS bản ghi công khai (kèm tổng số khớp). Không bao giờ trả cả danh sách.
 */
export function searchMemorialRecords(
  records: MemorialRecord[],
  rawQuery: string,
  category = 'all'
): MemorialSearch {
  const query = rawQuery.trim().slice(0, MEMORIAL_MAX_QUERY);
  if (!query) return { state: 'idle' };
  if (normalizeVietnamese(query).replace(/ /g, '').length < MEMORIAL_MIN_QUERY) return { state: 'short', query };
  const inCategory = records.filter((rec) => matchesCategoryFilter(rec.categorySlug, category));
  const found = filterMemorialRecords(inCategory, query);
  return { state: 'done', query, records: found.slice(0, MEMORIAL_MAX_RESULTS), total: found.length };
}
