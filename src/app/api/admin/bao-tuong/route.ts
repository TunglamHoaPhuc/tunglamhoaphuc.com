import { NextRequest, NextResponse } from 'next/server';
// Read only: V3 has no write route here (edit statues in www's admin).
import { OFFICIAL_STATUE_DATASET, StatueRecord } from '@/data/statue-data';
import { loadServerlessJson } from '@/lib/serverless-db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DB_CONFIG = {
  fileName: 'statues-database.json',
  localRelativePath: 'src/data/statues-database.json',
  s3Key: 'tunglamhoaphuc2/database/statues-database.json',
  defaultData: OFFICIAL_STATUE_DATASET,
};

function getStatues(): StatueRecord[] {
  const data = loadServerlessJson<StatueRecord[]>(DB_CONFIG);
  return Array.isArray(data) && data.length > 0 ? data : OFFICIAL_STATUE_DATASET;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assembly = searchParams.get('assembly');
    const areaId = searchParams.get('areaId');
    const categoryType = searchParams.get('type');
    const search = searchParams.get('search');

    let statues = getStatues();

    if (assembly && assembly !== 'all') {
      statues = statues.filter((s) => s.assembly === assembly || s.assemblyId === assembly);
    }

    if (areaId && areaId !== 'all') {
      statues = statues.filter((s) => s.areaId === areaId || s.areaSlug === areaId);
    }

    if (categoryType && categoryType !== 'all') {
      statues = statues.filter((s) => s.categoryType === categoryType);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase();
      statues = statues.filter(
        (s) =>
          s.code?.toLowerCase().includes(q) ||
          s.name?.toLowerCase().includes(q) ||
          s.subtitle?.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          s.quote?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      total: statues.length,
      statues,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
