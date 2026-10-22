import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getAudioFile } from '../../../../lib/catalog';
import {
  createEncryptedFileStream,
  getResourceIV,
  nodeStreamToWebStream,
  DEFAULT_CHUNK_SIZE,
  encryptChunk,
} from '../../../../lib/encryption';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, X-Encryption-IV',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type, X-Encryption-IV, X-Encrypted, X-Original-Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const rawSegments = params.path || [];
    const relPath = rawSegments.map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    }).join('/');

    const { audioPath, fileName, sizeBytes } = getAudioFile(relPath);

    if (!audioPath || !fs.existsSync(audioPath)) {
      return NextResponse.json(
        { error: `Audio file not found: ${relPath}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const totalSize = sizeBytes;
    const isEncrypted = searchParams.get('encrypted') === 'true' || searchParams.get('encrypted') === '1';
    const chunkParam = searchParams.get('chunk');
    const chunkSize = Number(searchParams.get('chunkSize')) || DEFAULT_CHUNK_SIZE;

    const baseIV = getResourceIV(`audio_${relPath}`);
    const ivHex = baseIV.toString('hex');
    const totalChunks = Math.ceil(totalSize / chunkSize);

    // 1. Опциональная сегментная зашифрованная передача (AES-256-CTR) по спецификации DAM
    if (isEncrypted) {
      if (chunkParam !== null && !isNaN(Number(chunkParam))) {
        const chunkIndex = parseInt(chunkParam, 10);
        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
          return NextResponse.json(
            { error: `Invalid chunk index ${chunkIndex}. Total chunks: ${totalChunks}` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const alignedStart = Math.floor(start / 16) * 16;
        const readLength = end - alignedStart;
        const readBuffer = Buffer.alloc(readLength);

        const fd = fs.openSync(audioPath, 'r');
        fs.readSync(fd, readBuffer, 0, readLength, alignedStart);
        fs.closeSync(fd);

        const encrypted = encryptChunk(readBuffer, start - alignedStart, end - alignedStart, baseIV);

        return new Response(new Uint8Array(encrypted), {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/octet-stream',
            'X-Original-Content-Type': 'audio/mpeg',
            'X-Encryption-IV': ivHex,
            'X-Chunk-Index': chunkIndex.toString(),
            'X-Total-Chunks': totalChunks.toString(),
            'X-Chunk-Size': chunkSize.toString(),
            'X-Total-Size': totalSize.toString(),
            'X-Encrypted': 'true',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      const { stream, iv } = createEncryptedFileStream(audioPath, baseIV, { chunkSize });
      const webStream = nodeStreamToWebStream(stream);

      return new Response(webStream, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/octet-stream',
          'X-Original-Content-Type': 'audio/mpeg',
          'X-Encryption-IV': iv.toString('hex'),
          'X-Total-Size': totalSize.toString(),
          'X-Encrypted': 'true',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Стандартная поддержка HTTP Range для HTML5 Audio / Safari iOS
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkLength = end - start + 1;

      const nodeStream = fs.createReadStream(audioPath, { start, end });
      const webStream = nodeStreamToWebStream(nodeStream);

      return new Response(webStream, {
        status: 206,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'audio/mpeg',
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkLength.toString(),
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 3. Полный прямой аудиопоток
    const nodeStream = fs.createReadStream(audioPath);
    const webStream = nodeStreamToWebStream(nodeStream);

    return new Response(webStream, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Content-Length': totalSize.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
