import { NextRequest, NextResponse } from 'next/server';
import { getAvatarFile } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, X-Requested-With',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  try {
    const glbStat = getAvatarFile('avatar.glb');
    const texStat = getAvatarFile('head_diff_natural.png');
    return NextResponse.json(
      {
        status: 'ok',
        avatar: {
          name: 'Digital Art Museum Interactive AR Guide',
          model_url: '/api/avatar/model',
          texture_url: '/api/avatar/texture',
          model_file: 'avatar.glb',
          model_size_bytes: glbStat.sizeBytes,
          model_size_mb: (glbStat.sizeBytes / (1024 * 1024)).toFixed(2),
          texture_file: 'head_diff_natural.png',
          texture_size_bytes: texStat.sizeBytes,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
