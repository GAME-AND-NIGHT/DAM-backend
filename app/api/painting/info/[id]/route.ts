import { NextRequest, NextResponse } from 'next/server';
import { getPaintingById } from '../../../../lib/catalog';
import { getResourceIV } from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { painting, infoData } = getPaintingById(id);

    if (!painting) {
      return NextResponse.json(
        { error: `Painting not found for id: ${id}` },
        { status: 404 }
      );
    }

    const baseIV = getResourceIV(`painting_${painting.id}`);
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;

    const responseData = {
      ...infoData,
      id: painting.id,
      title: painting.title,
      artist: painting.artist,
      date: painting.date,
      museum: painting.museum,
      aspect_ratio: painting.aspect_ratio,
      original_width: painting.original_width,
      original_height: painting.original_height,
      encryption: {
        algorithm: 'aes-256-ctr',
        key_hint: 'hhghghdgfjgfgdahgd',
        iv_hex: baseIV.toString('hex'),
        stream_encrypted: true,
      },
      endpoints: {
        image_stream: `/painting/image/${painting.id}`,
        image_stream_full_url: `${baseUrl}/painting/image/${painting.id}`,
        image_raw: `/painting/image/${painting.id}?raw=true`,
        info: `/painting/info/${painting.id}`,
        chunks_example: `/painting/image/${painting.id}?chunk=0&chunkSize=65536`,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching painting info:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
