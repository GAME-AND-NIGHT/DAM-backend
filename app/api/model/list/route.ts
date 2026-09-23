import { NextRequest, NextResponse } from 'next/server';
import { getModelsCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase().trim();

    let allModels = getModelsCatalog();

    if (q) {
      allModels = allModels.filter(
        (m) =>
          m.title_ru.toLowerCase().includes(q) ||
          m.title_en.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.folder_name.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      total: allModels.length,
      models: allModels,
    });
  } catch (error: any) {
    console.error('Error fetching models list:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
