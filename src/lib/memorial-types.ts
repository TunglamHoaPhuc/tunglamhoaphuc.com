export type MemorialCategorySlug =
  | 'nha-tu-an-ca-nhan'
  | 'nha-tu-an-to-tien'
  | 'vang-sinh-duong-nam'
  | 'vang-sinh-duong-nu'
  | 'phu-mau-xuat-gia';

export interface MemorialRecord {
  id: string;
  sheetName: string;
  category: string;
  categorySlug: MemorialCategorySlug;
  code: string;
  name: string;
  gender?: string;
  dharmaName?: string;
  lineageType?: string; // Dùng cho sheet Tổ Tiên: Nội tộc / Ngoại tộc
  birthDate?: string;
  deathDate?: string;
  age?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string; // Chỉ có trong gói máy chủ; toPublicMemorialRecord không chép ra ngoài
  contact?: string; // như trên
  burialLocation?: string;
}

/**
 * Những gì trang công khai /tra-cuu-bai-vi được thấy về một bài vị: đủ để thân nhân nhận ra mã số, không hơn.
 * KHÔNG có địa chỉ, nơi an táng, tên người liên hệ và số điện thoại (kể cả bản đã che): đó là dữ liệu riêng của người còn sống
 * hoặc của gia đình, và danh sách này quét được hàng loạt. Thêm trường vào đây là đưa nó ra công khai.
 */
export interface MemorialPublicRecord {
  id: string;
  category: string;
  categorySlug: MemorialCategorySlug;
  code: string;
  name: string;
  gender?: string;
  dharmaName?: string;
  lineageType?: string;
  birthDate?: string;
  deathDate?: string;
  age?: string;
}

export interface MemorialSyncMeta {
  driveUrl: string;
  driveFileId: string;
  lastSyncedAt: string;
  totalRecords: number;
  countsByCategory: Record<string, number>;
  sourceName?: string;
}

export const DEFAULT_MEMORIAL_DRIVE_FILE_ID = '1LHxPRSRKLgpQ31ld8PjBsYbMeqsGgPND';
export const DEFAULT_MEMORIAL_DRIVE_URL =
  'https://docs.google.com/spreadsheets/d/1LHxPRSRKLgpQ31ld8PjBsYbMeqsGgPND/edit?usp=drivesdk';

export const MEMORIAL_CATEGORY_OPTIONS: {
  id: string;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'all', label: 'Tất cả danh bộ', shortLabel: 'Tất cả' },
  { id: 'tu-an', label: 'Nhà Tưởng Ân (Tất cả)', shortLabel: 'Nhà Tưởng Ân' },
  { id: 'nha-tu-an-ca-nhan', label: 'Tưởng Ân - Cá Nhân', shortLabel: 'Tưởng Ân (Cá nhân)' },
  { id: 'nha-tu-an-to-tien', label: 'Tưởng Ân - Tổ Tiên', shortLabel: 'Tổ Tiên' },
  { id: 'vang-sinh-duong', label: 'Vãng Sinh Đường (Nam & Nữ)', shortLabel: 'Vãng Sinh Đường' },
  { id: 'vang-sinh-duong-nam', label: 'Vãng Sinh Đường (Nam)', shortLabel: 'VSĐ Nam' },
  { id: 'vang-sinh-duong-nu', label: 'Vãng Sinh Đường (Nữ)', shortLabel: 'VSĐ Nữ' },
  { id: 'phu-mau-xuat-gia', label: 'Phụ Mẫu Xuất Gia', shortLabel: 'Phụ Mẫu X.Gia' },
];

/**
 * Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không dấu, bỏ khoảng trắng thừa.
 */
export function normalizeVietnamese(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[.,\-_/()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuyển bản ghi đầy đủ thành bản ghi cho Client công khai: chỉ chép đúng các trường của MemorialPublicRecord,
 * từng trường một (không `...rec`), để trường mới thêm vào dữ liệu gốc không tự lọt ra ngoài.
 */
export function toPublicMemorialRecord(rec: MemorialRecord): MemorialPublicRecord {
  return {
    id: rec.id,
    category: rec.category,
    categorySlug: rec.categorySlug,
    code: rec.code,
    name: rec.name,
    gender: rec.gender,
    dharmaName: rec.dharmaName,
    lineageType: rec.lineageType,
    birthDate: rec.birthDate,
    deathDate: rec.deathDate,
    age: rec.age,
  };
}

/**
 * Kiểm tra bản ghi có thuộc bộ lọc khu vực `?khu=` không.
 */
export function matchesCategoryFilter(
  categorySlug: MemorialCategorySlug | string,
  filterKey: string
): boolean {
  if (!filterKey || filterKey === 'all') return true;
  if (filterKey === 'tu-an') {
    return (
      categorySlug === 'nha-tu-an-ca-nhan' ||
      categorySlug === 'nha-tu-an-to-tien' ||
      categorySlug === 'phu-mau-xuat-gia'
    );
  }
  if (filterKey === 'to-tien') {
    return categorySlug === 'nha-tu-an-to-tien';
  }
  if (filterKey === 'ca-nhan') {
    return categorySlug === 'nha-tu-an-ca-nhan';
  }
  if (filterKey === 'vang-sinh-duong') {
    return categorySlug === 'vang-sinh-duong-nam' || categorySlug === 'vang-sinh-duong-nu';
  }
  if (filterKey === 'phu-mau') {
    return categorySlug === 'phu-mau-xuat-gia';
  }
  return categorySlug === filterKey;
}
