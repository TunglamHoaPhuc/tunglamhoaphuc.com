// Read only (V3 on www's data): views are not counted here; www's data is never written from v3.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true, counted: false });
}
