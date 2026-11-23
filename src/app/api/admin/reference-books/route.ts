import { NextRequest, NextResponse } from 'next/server';
import { THU_VIEN_BOOKS } from '@/data/thu-vien-data';
import { loadServerlessJsonAsync } from '@/lib/serverless-db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DB_CONFIG = {
  fileName: 'reference-books-data.json',
  localRelativePath: 'src/data/reference-books-data.json',
  s3Key: 'tunglamhoaphuc2/database/reference-books-data.json',
  defaultData: [] as any[],
};

async function getCustomBooks(): Promise<any[]> {
  return await loadServerlessJsonAsync<any[]>(DB_CONFIG);
}

// 🪷 GET: Lấy danh sách toàn bộ sách (kết hợp Tủ sách Tuyển chọn + Kho 400+ sách Tàng Kinh Các)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('q') || '').toLowerCase().trim();
    const category = searchParams.get('category') || '';

    const customBooks = await getCustomBooks();

    // Chuẩn hóa 400+ đầu sách từ Tàng Kinh Các
    const tangKinhCacBooks = (THU_VIEN_BOOKS || []).map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle || '',
      author: b.author,
      description: b.description || `Ấn phẩm Phật học lưu trữ tại Tàng Kinh Các Tùng Lâm Hòa Phúc (${b.pages || 0} trang).`,
      coverImage: b.coverUrl,
      category: b.category,
      linkUrl: `/vu-tru-phat-giao/tang-kinh-cac?sach=${b.id}`,
      isTangKinhCac: true,
    }));

    // Gộp cả hai nguồn (ưu tiên sách tuyển chọn của Sư Phụ lên đầu)
    let allBooks = [...customBooks, ...tangKinhCacBooks];

    if (category && category !== 'Tất cả') {
      allBooks = allBooks.filter((b) => b.category === category);
    }

    if (search) {
      allBooks = allBooks.filter(
        (b) =>
          b.title?.toLowerCase().includes(search) ||
          b.author?.toLowerCase().includes(search) ||
          b.description?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: allBooks,
        total: allBooks.length,
        customCount: customBooks.length,
        tangKinhCacCount: tangKinhCacBooks.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
