import { loadServerlessJsonAsync } from './serverless-db';
import {
  DEFAULT_MEMORIAL_DRIVE_FILE_ID,
  DEFAULT_MEMORIAL_DRIVE_URL,
  type MemorialPublicRecord,
  type MemorialRecord,
  type MemorialSyncMeta,
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

export async function getPublicMemorialRecords(): Promise<MemorialPublicRecord[]> {
  const records = await getAllMemorialRecords();
  return records.map(toPublicMemorialRecord);
}

export async function getMemorialSyncMeta(): Promise<MemorialSyncMeta> {
  return await loadServerlessJsonAsync<MemorialSyncMeta>(MEMORIAL_META_CONFIG);
}

/**
 * Tìm kiếm bài vị phía Server, bỏ dấu tiếng Việt. Chỉ so với các trường CÔNG KHAI (chính những gì
 * toPublicMemorialRecord trả ra, SĐT đã che): không so với SĐT gốc, nên không dò ra số điện thoại bằng cách thử từng
 * chữ số và không lộ bản ghi nào qua phần ẩn của nó.
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
      [
        rec.code,
        rec.name,
        rec.dharmaName,
        rec.lineageType,
        rec.age,
        rec.deathDate,
        rec.birthDate,
        rec.address,
        rec.burialLocation,
        rec.contactName,
        rec.contactMasked,
      ]
        .filter(Boolean)
        .join(' ')
    );

    return tokens.every((tok) => haystack.includes(tok));
  });
}
