import { NextResponse } from 'next/server';
import { loadServerlessJsonAsync } from '@/lib/serverless-db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DB_CONFIG = {
  fileName: 'danh-tang-database.json',
  localRelativePath: 'src/data/danh-tang-database.json',
  s3Key: 'tunglamhoaphuc2/database/danh-tang-database.json',
  defaultData: [] as any[],
};

async function getMonks(): Promise<any[]> {
  return await loadServerlessJsonAsync<any[]>(DB_CONFIG);
}

// 🪷 Lấy danh sách Danh Tăng
export async function GET(req: Request) {
  try {
    const monks = await getMonks();
    return NextResponse.json(
      { success: true, total: monks.length, data: monks },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
