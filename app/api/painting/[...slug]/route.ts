import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getPaintingsCatalog, getPaintingById } from '../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
  nodeStreamToWebStream,
  DEFAULT_CHUNK_SIZE,
  encryptChunk,
} from '../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const slug = params.slug || [];
    const action = slug[0]; // 'list' | 'info' | 'image'
    const id = slug[1];

    // 1. GET /api/painting/list
    if (action === 'list') {
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
    }

    // 2. GET /api/painting/info/[id]
    if (action === 'info' && id) {
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
    }

    // 3. GET /api/painting/image/[id]
    if (action === 'image' && id) {
      const { searchParams } = new URL(request.url);
      const { painting, imagePath } = getPaintingById(id);

      if (!painting || !imagePath) {
        return NextResponse.json(
          { error: `Painting not found for id: ${id}` },
          { status: 404 }
        );
      }

      const stat = fs.statSync(imagePath);
      const totalSize = stat.size;
      const chunkSize = Number(searchParams.get('chunkSize')) || DEFAULT_CHUNK_SIZE;
      const isRaw = searchParams.get('raw') === 'true' || searchParams.get('raw') === '1';
      const chunkParam = searchParams.get('chunk');

      const baseIV = getResourceIV(`painting_${painting.id}`);
      const ivHex = baseIV.toString('hex');
      const totalChunks = Math.ceil(totalSize / chunkSize);

      if (isRaw) {
        const fileBuffer = fs.readFileSync(imagePath);
        return new Response(fileBuffer, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': totalSize.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      if (chunkParam !== null && !isNaN(Number(chunkParam))) {
        const chunkIndex = parseInt(chunkParam, 10);
        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
          return NextResponse.json(
            { error: `Invalid chunk index ${chunkIndex}. Total chunks: ${totalChunks}` },
            { status: 400 }
          );
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const fileBuffer = fs.readFileSync(imagePath);
        const encryptedSegment = encryptChunk(fileBuffer, start, end, baseIV);

        return new Response(encryptedSegment, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': encryptedSegment.length.toString(),
            'X-Encrypted': 'true',
            'X-Encryption-Algorithm': 'aes-256-ctr',
            'X-Encryption-IV': ivHex,
            'X-Original-Content-Type': 'image/jpeg',
            'X-Chunk-Index': chunkIndex.toString(),
            'X-Total-Chunks': totalChunks.toString(),
            'X-Chunk-Size': chunkSize.toString(),
            'X-Total-Size': totalSize.toString(),
            'X-Item-Id': painting.id.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      const { stream } = createEncryptedFileStream(imagePath, baseIV, {
        chunkSize,
      });

      const webStream = nodeStreamToWebStream(stream);

      return new Response(webStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
          'X-Encrypted': 'true',
          'X-Encryption-Algorithm': 'aes-256-ctr',
          'X-Encryption-IV': ivHex,
          'X-Original-Content-Type': 'image/jpeg',
          'X-Total-Size': totalSize.toString(),
          'X-Chunk-Size': chunkSize.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Item-Id': painting.id.toString(),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return NextResponse.json(
      { error: `Invalid painting route: /${slug.join('/')}` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error handling painting route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
