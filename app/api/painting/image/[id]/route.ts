import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getPaintingById } from '../../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
  nodeStreamToWebStream,
  DEFAULT_CHUNK_SIZE,
  encryptChunk,
} from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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

    // If unencrypted raw response is requested
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

    // Segment / Chunk index specific request (e.g. ?chunk=0)
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

    // Full Streaming Encrypted response in chunks
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
  } catch (error: any) {
    console.error('Error streaming painting image:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
