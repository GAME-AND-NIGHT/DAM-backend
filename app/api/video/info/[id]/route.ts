import { NextRequest, NextResponse } from 'next/server';
import { getVideoById } from '../../../../lib/catalog';
import { getResourceIV } from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawId = params.id;
    let id = rawId;
    try {
      id = decodeURIComponent(rawId);
    } catch {}

    const { video, infoData } = getVideoById(id);

    if (!video) {
      return NextResponse.json(
        { error: `Video not found for id: ${id}` },
        { status: 404 }
      );
    }

    const baseIV = getResourceIV(`video_${video.id}`);
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;

    const responseData = {
      ...infoData,
      id: video.id,
      file_name: video.file_name,
      title: video.title,
      category: video.category,
      description: video.description,
      size_mb: video.size_mb,
      format: video.format,
      encryption: {
        algorithm: 'aes-256-ctr',
        key_hint: 'hhghghdgfjgfgdahgd',
        iv_hex: baseIV.toString('hex'),
        stream_encrypted: true,
      },
      endpoints: {
        video_stream: `/video/file/${video.id}`,
        video_stream_full_url: `${baseUrl}/video/file/${video.id}`,
        video_raw: `/video/file/${video.id}?raw=true`,
        info: `/video/info/${video.id}`,
        chunks_example: `/video/file/${video.id}?chunk=0&chunkSize=524288`,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching video info:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
