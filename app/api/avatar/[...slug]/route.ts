import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAvatarDir, getAvatarFile } from '../../../lib/catalog';

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

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.glb':
      return 'model/gltf-binary';
    case '.gltf':
      return 'model/gltf+json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.json':
      return 'application/json';
    case '.bin':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  try {
    const rawSegments = params.slug || [];
    const joinedPath = rawSegments.join('/').toLowerCase();

    // 1. Info / Metadata
    if (joinedPath === '' || joinedPath === 'info') {
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
    }

    // 2. Resolve target file
    let targetFile = '';
    if (joinedPath === 'model' || joinedPath.endsWith('avatar.glb')) {
      targetFile = 'avatar.glb';
    } else if (joinedPath === 'texture' || joinedPath.endsWith('head_diff_natural.png')) {
      targetFile = 'head_diff_natural.png';
    } else {
      targetFile = rawSegments.join('/');
    }

    const { filePath, exists, sizeBytes } = getAvatarFile(targetFile);

    if (!exists || !filePath) {
      return NextResponse.json(
        { error: `Avatar file not found: ${targetFile}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const mime = getMimeType(filePath);
    const range = request.headers.get('range');

    // Handle HTTP Range requests for fast mobile streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : sizeBytes - 1;

      if (start >= sizeBytes || end >= sizeBytes || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...CORS_HEADERS,
            'Content-Range': `bytes */${sizeBytes}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new Response(webStream, {
        status: 206,
        headers: {
          ...CORS_HEADERS,
          'Content-Range': `bytes ${start}-${end}/${sizeBytes}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Standard Full File Response
    const fullStream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        fullStream.on('data', (chunk) => controller.enqueue(chunk));
        fullStream.on('end', () => controller.close());
        fullStream.on('error', (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Accept-Ranges': 'bytes',
        'Content-Length': sizeBytes.toString(),
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
