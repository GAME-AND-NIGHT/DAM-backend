import { NextRequest, NextResponse } from 'next/server';
import { getQuestData, getAudioCatalog } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  try {
    const data = getQuestData();
    if (!data) {
      return NextResponse.json(
        { error: 'Quest data not found on server' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const audioPrefix = searchParams.get('audioPrefix');

    // Опционально префиксируем пути к аудио абсолютным URL бэкенда
    let responseData = data;
    if (audioPrefix) {
      const prefix = audioPrefix.replace(/\/+$/, '');
      const serialized = JSON.stringify(data).replace(/"\/audio\//g, `"${prefix}/audio/`);
      responseData = JSON.parse(serialized);
    }

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
