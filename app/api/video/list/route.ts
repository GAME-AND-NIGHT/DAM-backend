import { NextRequest, NextResponse } from 'next/server';
import { getVideosCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase().trim();

    let allVideos = getVideosCatalog();

    if (q) {
      allVideos = allVideos.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.file_name.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      total: allVideos.length,
      videos: allVideos,
    });
  } catch (error: any) {
    console.error('Error fetching videos list:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
