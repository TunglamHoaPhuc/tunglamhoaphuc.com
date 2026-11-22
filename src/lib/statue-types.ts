// Hình dạng bản ghi tượng mà các trang và thành phần của V3 đọc (giữ nguyên từ bản đóng gói cũ), cùng hàm chuẩn hóa mã khu vực.
// Chỉ có kiểu và hàm thuần: thành phần phía trình duyệt nhập được tệp này mà không kéo theo lớp đọc D1.
// Dữ liệu thật do src/lib/v3-statues.ts dựng từ D1.

export interface StatueRecord {
  code: string;
  assembly: string;
  group: string;
  title: string;
  categoryType: 'TƯỢNG CHÍNH' | 'NTPG' | string;
  characterGroup: string;
  areaId: string;
  description?: string;
  quote?: string;
  notes?: string;

  id: string;
  slug: string;
  name: string;
  titleName: string;
  subtitle?: string;
  assemblyId: string;
  assemblyName: string;
  clusterName: string;
  type: string;
  hasSinglePage?: boolean;
  clusterMembers: Array<{ name: string; imgUrl: string; slug: string }>;
  areaSlug: string;
  areaName: string;
  location?: string;
  areaImgUrl?: string;
  imgUrl: string;
  avatarUrl: string;
  imgPosition?: string;
  imgRotation?: number;
  articleContent?: string;
  quoteAuthor: string;
  summary: string;
  fullHistoryHtml: string;
  caption?: string;
  category?: string;
  video?: {
    title: string;
    thumbnailUrl: string;
    summary: string;
    videoUrl: string;
  };
  article?: {
    title: string;
    author: string;
    bannerUrl: string;
    url: string;
  };
  artVariations?: Array<{
    id: string;
    title: string;
    location: string;
    meaning: string;
    imgUrl: string;
  }>;
  viewsCount?: number;
}

export interface StatueItem extends StatueRecord {}

export function normalizeAreaId(rawSlugOrId?: string): string {
  if (!rawSlugOrId) return '';
  const key = rawSlugOrId.toUpperCase().replace(/-/g, '_').trim();
  
  if (['TAM_BAO', 'TAMBAO', 'TAM_BAO_PHAT_GIAO', 'CHANH_DIEN', 'ĐẠI_HÙNG_BẢO_ĐIỆN'].includes(key)) return 'TAM_BAO';
  if (['GIANG_DUONG', 'GIANGDUONG', 'GIẢNG_ĐƯỜNG'].includes(key)) return 'GIANG_DUONG';
  if (['BAO_TANG', 'BAOTANG', 'BAO_TANG_PHAT_GIAO', 'BẢO_TÀNG_PHẬT_GIÁO', 'BẢO_TÀNG'].includes(key)) return 'BAO_TANG';
  if (['SAN_DI_DA', 'SANDIDA', 'SÂN_DI_ĐÀ', 'SÙNG_DI_ĐÀ'].includes(key)) return 'SAN_DI_DA';
  if (['SAN_DI_LAC', 'SANDILAC', 'SÂN_DI_LẶC', 'CONG_TAM_QUAN', 'CỔNG_TAM_QUAN', 'CONG_TAM_QUAN_SAN_DI_LAC', 'CỔNG_TAM_QUAN___SÂN_DI_LẶC', 'CỔNG_TAM_QUAN_SÂN_DI_LẶC', 'CONGTAMQUAN'].includes(key)) return 'CONG_TAM_QUAN_SAN_DI_LAC';
  if (['NHA_MAU', 'NHAMAU', 'NHÀ_MẪU', 'DAI_NAM_QUOC_MAU', 'ĐẠI_NAM_QUỐC_MẪU'].includes(key)) return 'NHA_MAU';
  if (['TO_DUONG', 'TODUONG', 'TỔ_ĐƯỜNG'].includes(key)) return 'TO_DUONG';
  if (['VANG_SINH_DUONG', 'VANGSINHDUONG', 'VẠN_SINH_ĐƯỜNG', 'TU_AN', 'TỨ_ÂN', 'VẮNG_SINH_ĐƯỜNG', 'TỨ_ÂN_VÃNG_SINH_ĐƯỜNG', 'TU_AN_DUONG'].includes(key)) return 'VANG_SINH_DUONG';
  if (['BAO_THAP', 'BAOTHAP', 'BẢO_THÁP', 'BAO_THAP_VAN_PHAT_XA_LOI'].includes(key)) return 'BAO_THAP';
  if (['LAM_TI_NI', 'LAMTINI', 'LÂM_TỲ_NI'].includes(key)) return 'LAM_TI_NI';
  if (['CONG_THAP', 'CONGTHAP', 'CỔNG_THÁP'].includes(key)) return 'CONG_THAP';
  return key;
}
