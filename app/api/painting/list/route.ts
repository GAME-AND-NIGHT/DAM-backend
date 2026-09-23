import { NextRequest, NextResponse } from 'next/server';
import { getPaintingsCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const q = (searchParams.get('q') || '').toLowerCase().trim();

    let allPaintings = getPaintingsCatalog();

    if (q) {
      allPaintings = allPaintings.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.artist.toLowerCase().includes(q) ||
          p.folder_name.toLowerCase().includes(q)
      );
    }

    const total = allPaintings.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const items = allPaintings.slice(offset, offset + limit);

    return NextResponse.json({
      total,
      page,
      limit,
      totalPages,
      paintings: items,
    });
  } catch (error: any) {
    console.error('Error fetching paintings list:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
